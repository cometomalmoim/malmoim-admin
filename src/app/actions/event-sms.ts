'use server';
import {getAdminAccess} from '@/lib/auth';
import {createClient} from '@/lib/supabase/server';
import {smsConfig,smsPrice,maskPhone} from '@/lib/solapi';
import {smsUuid,validSmsText} from '@/lib/sms-contract';
import {renderEventSms,smsMessageType,type EventSmsTemplate,eventSmsCategories} from '@/lib/event-sms';
async function client(){if((await getAdminAccess()).status!=='admin')throw new Error('관리자 권한이 필요합니다.');return createClient();}
function checked(error:unknown){if(error)throw new Error('문자 DB를 읽지 못했습니다. 051 마이그레이션 적용과 관리자 권한을 확인해주세요.');}
export async function eventSmsData(eventId:string,source?:string,id?:string){
 const db=await client();if(!smsUuid(eventId))throw new Error('행사 오류');
 const [e,t,d]=await Promise.all([db.from('recruitment_events').select('id,title,slug,starts_at,ends_at,location,fee_notice').eq('id',eventId).eq('is_archived',false).single(),db.from('event_sms_current').select('*').eq('event_id',eventId),db.from('event_sms_details').select('*').eq('event_id',eventId).maybeSingle()]);
 checked(e.error||t.error||d.error);
 const prefs=source&&id?await db.from('applicant_sms_details').select('language,fee').eq('event_id',eventId).eq('source',source).eq('application_id',id).maybeSingle():null;
 if(prefs)checked(prefs.error);
 return {event:e.data!,templates:t.data as EventSmsTemplate[],details:(d.data?.values??{}) as Record<string,string>,revision:d.data?.revision??0,preference:prefs?.data??null};
}
export async function saveEventSmsTemplate(eventId:string,key:string|null,version:number,input:Pick<EventSmsTemplate,'category'|'language'|'title'|'body'|'active'|'is_default'>){
 const db=await client();if(!smsUuid(eventId)||(key&&!smsUuid(key))||!Object.hasOwn(eventSmsCategories,input.category)||!['ko','en'].includes(input.language)||!input.title.trim()||input.title.length>120||!input.body.trim()||new TextEncoder().encode(input.body).length>2000)throw new Error('템플릿 입력을 확인해주세요. 본문은 UTF-8 2,000바이트 이내입니다.');
 const r=await db.rpc('save_event_sms_template',{p_event:eventId,p_key:key,p_version:version,p_input:input});if(r.error)throw new Error('저장 실패: 다른 운영진이 수정했는지 확인하고 다시 불러오세요.');return r.data as string;
}
export async function saveEventSmsDetails(eventId:string,revision:number,values:Record<string,string>){const db=await client();const r=await db.rpc('save_event_sms_details',{p_event:eventId,p_revision:revision,p_values:values});if(r.error)throw new Error('저장 실패: 최신 정보를 불러온 뒤 다시 저장해주세요.');}
export async function eventSmsVersions(key:string){const db=await client();const r=await db.from('event_sms_templates').select('*').eq('template_key',key).order('version',{ascending:false});checked(r.error);return r.data as EventSmsTemplate[];}
export async function prepareApplicantSms(input:{batch:string;event:string;source:string;id:string;template:string;language:'ko'|'en';fee:string;resend:boolean}){
 const db=await client();const config=smsConfig();if(!config)throw new Error('SOLAPI_API_KEY, SOLAPI_API_SECRET, SOLAPI_SENDER_NUMBER, SOLAPI_ADMIN_NOTIFY_NUMBER 설정이 필요합니다.');
 if(![input.batch,input.event,input.id,input.template].every(smsUuid)||!['season9','registration','manual'].includes(input.source)||input.fee.length>100)throw new Error('입력 오류');
 const data=await eventSmsData(input.event,input.source,input.id);
 const a=await db.from('event_application_admin_list').select('name,contact,contact_type,revision,status,payment_status').eq('event_id',input.event).eq('source',input.source).eq('id',input.id).eq('is_archived',false).single();checked(a.error);
 const template=data.templates.find(t=>t.id===input.template&&t.active&&t.language===input.language);if(!template)throw new Error('활성 템플릿을 다시 선택해주세요.');
 if(template.category==='confirmation'&&(a.data!.status!=='accepted'||a.data!.payment_status!=='paid'))throw new Error('입금 완료와 참가 승인이 모두 필요합니다.');
 const rendered=renderEventSms(template,data.event,a.data!.name,data.details,input.fee);
 if(rendered.missing.length||!validSmsText(rendered.text))throw new Error('미입력 변수 또는 잘못된 본문: '+rendered.missing.join(', '));
 const type=smsMessageType(rendered.text),rates=await smsPrice();
 const r=await db.rpc('prepare_applicant_sms',{p_batch:input.batch,p_event:input.event,p_source:input.source,p_app:input.id,p_revision:a.data!.revision,p_template:template.id,p_text:rendered.text,p_price:rates[type],p_type:type,p_resend:input.resend,p_language:input.language,p_fee:input.fee});
 if(r.error)throw new Error('준비 실패: 기존 발송·결과 불명·신청자 변경을 확인하세요. 열린 미리보기는 취소 후 다시 준비해주세요.');
 // Return the saved snapshot, including on a retry of the same batch ID.
 const j=await db.from('sms_jobs').select('body,message_type,recipient').eq('batch_id',input.batch).single();checked(j.error);
 const b=await db.from('sms_batches').select('unit_price').eq('id',input.batch).single();checked(b.error);
 return {id:input.batch,text:j.data!.body,type:j.data!.message_type,cost:Number(b.data!.unit_price),sender:maskPhone(config.sender),to:maskPhone(j.data!.recipient)};
}
export async function cancelApplicantSms(batch:string){const db=await client();const r=await db.rpc('cancel_applicant_sms_preview',{p_batch:batch});checked(r.error);}
export type EventSmsLog={id:string;kind:string;event_id:string|null;application_source:string|null;application_id:string|null;applicant_name:string|null;template_id:string|null;language:string|null;recipient:string|null;body:string;state:string;created_at:string;updated_at:string;provider_group:string|null;resend:boolean;failure_reason:string|null;message_type:string;batch_id:string|null};
export async function eventSmsLogs(filters:{event?:string;source?:string;id?:string;name?:string;language?:string;state?:string;date?:string;until?:string;category?:string;page?:number}={}){
 const db=await client();let q=db.from('sms_jobs').select('*,event_sms_templates(category,title,version),sms_batches(created_by)',{count:'exact'}).order('created_at',{ascending:false}).order('id');
 if(filters.event)q=q.eq('event_id',filters.event);if(filters.source)q=q.eq('application_source',filters.source);if(filters.id)q=q.eq('application_id',filters.id);
 if(filters.name)q=q.ilike('applicant_name','%'+filters.name.replace(/[%_]/g,'').slice(0,100)+'%');if(filters.language)q=q.eq('language',filters.language);if(filters.state)q=q.eq('state',filters.state);
 if(filters.date&&/^\d{4}-\d{2}-\d{2}$/.test(filters.date))q=q.gte('created_at',filters.date+'T00:00:00+09:00');
 if(filters.until&&/^\d{4}-\d{2}-\d{2}$/.test(filters.until))q=q.lt('created_at',new Date(new Date(filters.until+'T00:00:00+09:00').getTime()+86400000).toISOString());
 if(filters.category){const t=await db.from('event_sms_templates').select('id').eq('category',filters.category);checked(t.error);if(!t.data?.length)return {rows:[],count:0};q=q.in('template_id',t.data.map(v=>v.id));}
 const page=Math.max(0,Math.min(10000,Math.floor(filters.page??0)));const r=await q.range(page*30,page*30+29);checked(r.error);
 return {rows:r.data as (EventSmsLog&{event_sms_templates:{category:string;title:string;version:number}|null;sms_batches:{created_by:string}|null})[],count:r.count??0};
}
export async function eventSmsHistory(id:string){const db=await client();const r=await db.from('sms_job_history').select('*').eq('job_id',id).order('id');checked(r.error);return r.data as {id:number;state:string;happened_at:string;actor:string|null;provider_group:string|null;failure_reason:string|null}[];}
