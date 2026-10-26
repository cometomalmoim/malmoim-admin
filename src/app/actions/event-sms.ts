'use server';
import {getAdminAccess} from '@/lib/auth';
import {createClient} from '@/lib/supabase/server';
import {smsConfig,smsPrice,maskPhone} from '@/lib/solapi';
import {domesticPhone,smsUuid,validSmsText} from '@/lib/sms-contract';
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
async function prepareApplicantSmsCore(input:{batch:string;event:string;source:string;id:string;template:string;language:'ko'|'en';fee:string;resend:boolean;body?:string;purpose?:'payment_received'},context?:{db:Awaited<ReturnType<typeof client>>;config:NonNullable<ReturnType<typeof smsConfig>>;rates:Awaited<ReturnType<typeof smsPrice>>}){
 const db=context?.db??await client();const config=context?.config??smsConfig();if(!config)throw new Error('SOLAPI_API_KEY, SOLAPI_API_SECRET, SOLAPI_SENDER_NUMBER, SOLAPI_ADMIN_NOTIFY_NUMBER 설정이 필요합니다.');
 if(![input.batch,input.event,input.id,input.template].every(smsUuid)||!['season9','registration','manual'].includes(input.source)||input.fee.length>100||(input.body!==undefined&&(typeof input.body!=='string'||new TextEncoder().encode(input.body).length>2000)))throw new Error('입력 오류');
 const data=await eventSmsData(input.event,input.source,input.id);
 const a=await db.from('event_application_admin_list').select('name,contact,contact_type,revision,status,payment_status').eq('event_id',input.event).eq('source',input.source).eq('id',input.id).eq('is_archived',false).single();checked(a.error);
 const template=data.templates.find(t=>t.id===input.template&&t.active&&t.language===input.language);if(!template)throw new Error('활성 템플릿을 다시 선택해주세요.');
 if(template.category==='confirmation'&&(a.data!.status!=='accepted'||a.data!.payment_status!=='paid'))throw new Error('입금 완료와 참가 승인이 모두 필요합니다.');
 if(input.purpose!==undefined&&input.purpose!=='payment_received')throw new Error('문자 목적 오류');
 if(input.purpose==='payment_received'&&(a.data!.payment_status!=='paid'||!['custom','confirmation'].includes(template.category)))throw new Error('입금 완료 상태와 안내 템플릿을 다시 확인해주세요.');
 const fee=input.fee||data.preference?.fee||'';
 const rendered=renderEventSms({...template,body:input.body??template.body},data.event,a.data!.name,data.details,fee);
 if(rendered.missing.length||!validSmsText(rendered.text))throw new Error('미입력 변수 또는 잘못된 본문: '+rendered.missing.join(', '));
 const type=smsMessageType(rendered.text),rates=context?.rates??await smsPrice();
 const r=await db.rpc('prepare_applicant_sms',{p_batch:input.batch,p_event:input.event,p_source:input.source,p_app:input.id,p_revision:a.data!.revision,p_template:template.id,p_text:rendered.text,p_price:rates[type],p_type:type,p_resend:input.resend,p_language:input.language,p_fee:fee});
 if(r.error)throw new Error('준비 실패: 기존 발송·결과 불명·신청자 변경을 확인하세요. 열린 미리보기는 취소 후 다시 준비해주세요.');
 // Return the saved snapshot, including on a retry of the same batch ID.
 const j=await db.from('sms_jobs').select('body,message_type,recipient').eq('batch_id',input.batch).single();checked(j.error);
 const b=await db.from('sms_batches').select('unit_price').eq('id',input.batch).single();checked(b.error);
 return {id:input.batch,text:j.data!.body,type:j.data!.message_type,cost:Number(b.data!.unit_price),sender:maskPhone(config.sender),to:maskPhone(j.data!.recipient)};
}
export async function prepareApplicantSms(input:Parameters<typeof prepareApplicantSmsCore>[0]){return prepareApplicantSmsCore(input);}
export async function prepareApplicantSmsBatch(input:{event:string;template:string;language:'ko'|'en';fee:string;body:string;resend:boolean;items:{batch:string;id:string;source:string}[]}){
 const db=await client(),config=smsConfig();
 if(!config)throw new Error('문자 서비스 연결 설정을 확인해주세요.');
 if(!smsUuid(input.event)||!smsUuid(input.template)||!['ko','en'].includes(input.language)||typeof input.body!=='string'||new TextEncoder().encode(input.body).length>2000||typeof input.fee!=='string'||input.fee.length>100||!Array.isArray(input.items)||input.items.length<1||input.items.length>50||input.items.some(item=>!item||![item.batch,item.id].every(smsUuid)||!['season9','registration','manual'].includes(item.source))||new Set(input.items.map(item=>item.batch)).size!==input.items.length||new Set(input.items.map(item=>item.source+':'+item.id)).size!==input.items.length)throw new Error('대상은 중복 없이 최대 50명까지 선택해주세요.');
 const rates=await smsPrice(),context={db,config,rates};
 const ready:{name:string;id:string;text:string;type:string;cost:number;sender:string;to:string}[]=[],errors:{name:string;message:string}[]=[];
 const phones=new Set<string>();
 async function prepareItem(item:(typeof input.items)[number]){
  let name='선택한 신청자';
  try{
   const row=await db.from('event_application_admin_list').select('name,contact,contact_type').eq('event_id',input.event).eq('source',item.source).eq('id',item.id).eq('is_archived',false).single();name=row.data?.name??name;
   if(row.error||row.data?.contact_type!=='phone')throw new Error('신청자 또는 연락처를 다시 확인해주세요.');
   const phone=domesticPhone(row.data.contact);if(!phone)throw new Error('국내 휴대폰 번호가 아닙니다.');if(phones.has(phone))throw new Error('같은 번호가 이미 포함되어 있습니다.');phones.add(phone);
   const result=await prepareApplicantSmsCore({...input,...item},context);ready.push({name,...result});
  }catch(error){let cleanupFailed=false;try{const cleanup=await db.rpc('cancel_applicant_sms_preview',{p_batch:item.batch});cleanupFailed=!!cleanup.error;}catch{cleanupFailed=true;}errors.push({name,message:(error instanceof Error?error.message:'준비하지 못했습니다.')+(cleanupFailed?' · 초안 취소 상태를 발송 기록에서 확인해주세요.':'')});}
 }
 let cursor=0;await Promise.all(Array.from({length:Math.min(3,input.items.length)},async()=>{while(cursor<input.items.length){const item=input.items[cursor++];await prepareItem(item);}}));
 return {ready,errors};
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
