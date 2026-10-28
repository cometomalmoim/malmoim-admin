'use server';
import {season9ClassSmsTemplates} from '@/lib/season9-sms-templates';
import {smsPurposes,smsTemplatePurpose} from '@/lib/sms-purpose';
import {getAdminAccess} from '@/lib/auth';
import {createClient} from '@/lib/supabase/server';
import {smsConfig,smsPrice,maskPhone} from '@/lib/solapi';
import {SmsPreparationError,smsPreparationIssue,type SmsPreparationCode} from '@/lib/sms-preparation-error';
import {paymentNoticeTemplate,refundNoticeTemplate} from '@/lib/payment-notice';
import {domesticPhone,smsUuid,validSmsText} from '@/lib/sms-contract';
import {renderEventSms,smsMessageType,type EventSmsTemplate,eventSmsCategories} from '@/lib/event-sms';
async function client(){if((await getAdminAccess()).status!=='admin')throw new Error('관리자 권한이 필요합니다.');return createClient();}
function batchOwner(value:unknown){const row=(Array.isArray(value)?value[0]:value) as {created_by?:string}|null;return row?.created_by;}
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
async function prepareApplicantSmsCore(input:{batch:string;event:string;source:string;id:string;template:string;language:'ko'|'en';fee:string;resend:boolean;body?:string;purpose?:'payment_received'|'refund_completed';refundConfirmed?:boolean},context?:{db:Awaited<ReturnType<typeof client>>;config:NonNullable<ReturnType<typeof smsConfig>>;rates:Awaited<ReturnType<typeof smsPrice>>}){
 const db=context?.db??await client();const config=context?.config??smsConfig();if(!config)throw new Error('SOLAPI_API_KEY, SOLAPI_API_SECRET, SOLAPI_SENDER_NUMBER, SOLAPI_ADMIN_NOTIFY_NUMBER 설정이 필요합니다.');
 if(![input.batch,input.event,input.id,input.template].every(smsUuid)||!['season9','registration','manual'].includes(input.source)||input.fee.length>100||(input.body!==undefined&&(typeof input.body!=='string'||new TextEncoder().encode(input.body).length>2000)))throw new Error('입력 오류');
 const data=await eventSmsData(input.event,input.source,input.id);
 const a=await db.from('event_application_admin_list').select('name,contact,contact_type,revision,status,payment_status').eq('event_id',input.event).eq('source',input.source).eq('id',input.id).eq('is_archived',false).single();checked(a.error);
 const template=data.templates.find(t=>t.id===input.template&&t.active&&t.language===input.language);if(!template)throw new Error('활성 템플릿을 다시 선택해주세요.');
 if(template.category==='confirmation'&&(a.data!.status!=='accepted'||a.data!.payment_status!=='paid'))throw new Error('입금 완료와 참가 승인이 모두 필요합니다.');
 if(input.purpose!==undefined&&!['payment_received','refund_completed'].includes(input.purpose))throw new Error('문자 목적 오류');
 if(paymentNoticeTemplate(template,'received')&&input.purpose!=='payment_received')throw new Error('입금 확인 문자는 입금 완료 상태 확인이 필요합니다.');
 if(input.purpose==='payment_received'&&(a.data!.payment_status!=='paid'||!paymentNoticeTemplate(template,a.data!.status)))throw new Error('입금 완료 상태와 안내 템플릿을 다시 확인해주세요.');
 if(refundNoticeTemplate(template)&&input.purpose!=='refund_completed')throw new Error('환불 완료 문자는 실제 환불 완료 확인이 필요합니다.');
 if(input.purpose==='refund_completed'){
  if(input.refundConfirmed!==true||a.data!.payment_status!=='refunded'||!refundNoticeTemplate(template))throw new Error('실제 환불 완료 확인과 환불 상태·완료 안내 문구가 필요합니다.');
  await recordRefundSmsConfirmation(db,input,data.event.slug);
  const latest=await db.from('event_application_admin_list').select('revision,payment_status').eq('event_id',input.event).eq('source',input.source).eq('id',input.id).eq('is_archived',false).single();checked(latest.error);if(latest.data?.payment_status!=='refunded')throw new Error('환불 상태가 변경되었습니다. 최신 상태를 확인해주세요.');a.data!.revision=latest.data.revision;
 }
 const fee=input.fee||data.preference?.fee||'';
 const rendered=renderEventSms({...template,body:input.body??template.body},data.event,a.data!.name,data.details,fee);
 if(rendered.missing.length||!validSmsText(rendered.text))throw new Error('미입력 변수 또는 잘못된 본문: '+rendered.missing.join(', '));
 const type=smsMessageType(rendered.text),rates=context?.rates??await smsPrice();
 const r=await db.rpc('prepare_applicant_sms',{p_batch:input.batch,p_event:input.event,p_source:input.source,p_app:input.id,p_revision:a.data!.revision,p_template:template.id,p_text:rendered.text,p_price:rates[type],p_type:type,p_resend:input.resend,p_language:input.language,p_fee:fee});
 if(r.error){
  let blocking:{state:string;own:boolean}[]|undefined;
  if(r.error.message?.includes('pending_or_unknown')){
   try{const user=await db.auth.getUser();const jobs=await db.from('sms_jobs').select('state,sms_batches(created_by)').eq('event_id',input.event).eq('application_source',input.source).eq('application_id',input.id).not('template_id','is',null).in('state',['draft','queued','dispatching','accepted','unknown']);if(!jobs.error)blocking=(jobs.data??[]).map(j=>({state:j.state,own:!!user.data.user&&batchOwner(j.sms_batches)===user.data.user.id}));}catch{/* Keep the blocker unresolved if diagnostics are unavailable. */}
  }
  const issue=smsPreparationIssue(r.error.message??'',blocking);throw new SmsPreparationError(issue.code,issue.message);
 }
 // Return the saved snapshot, including on a retry of the same batch ID.
 const j=await db.from('sms_jobs').select('body,message_type,recipient').eq('batch_id',input.batch).single();checked(j.error);
 const b=await db.from('sms_batches').select('unit_price').eq('id',input.batch).single();checked(b.error);
 return {id:input.batch,text:j.data!.body,type:j.data!.message_type,cost:Number(b.data!.unit_price),sender:maskPhone(config.sender),to:maskPhone(j.data!.recipient)};
}
export async function prepareApplicantSms(input:Parameters<typeof prepareApplicantSmsCore>[0]){return prepareApplicantSmsCore(input);}
export async function prepareApplicantSmsBatch(input:{event:string;template:string;language:'ko'|'en';fee:string;body:string;resend:boolean;purpose?:'payment_received'|'refund_completed';refundConfirmed?:boolean;items:{batch:string;id:string;source:string}[]}){
 const db=await client(),config=smsConfig();
 if(!config)throw new Error('문자 서비스 연결 설정을 확인해주세요.');
 if(!smsUuid(input.event)||!smsUuid(input.template)||!['ko','en'].includes(input.language)||typeof input.body!=='string'||new TextEncoder().encode(input.body).length>2000||typeof input.fee!=='string'||input.fee.length>100||!Array.isArray(input.items)||input.items.length<1||input.items.length>50||input.items.some(item=>!item||![item.batch,item.id].every(smsUuid)||!['season9','registration','manual'].includes(item.source))||new Set(input.items.map(item=>item.batch)).size!==input.items.length||new Set(input.items.map(item=>item.source+':'+item.id)).size!==input.items.length)throw new Error('대상은 중복 없이 최대 50명까지 선택해주세요.');
 const rates=await smsPrice(),context={db,config,rates};
 const ready:{name:string;id:string;text:string;type:string;cost:number;sender:string;to:string}[]=[],errors:{name:string;message:string;code:SmsPreparationCode;id:string;source:string}[]=[];
 const phones=new Set<string>();
 async function prepareItem(item:(typeof input.items)[number]){
  let name='선택한 신청자';
  try{
   const row=await db.from('event_application_admin_list').select('name,contact,contact_type').eq('event_id',input.event).eq('source',item.source).eq('id',item.id).eq('is_archived',false).single();name=row.data?.name??name;
   if(row.error||row.data?.contact_type!=='phone')throw new Error('신청자 또는 연락처를 다시 확인해주세요.');
   const phone=domesticPhone(row.data.contact);if(!phone)throw new Error('국내 휴대폰 번호가 아닙니다.');if(phones.has(phone))throw new Error('같은 번호가 이미 포함되어 있습니다.');phones.add(phone);
   const result=await prepareApplicantSmsCore({...input,...item},context);ready.push({name,...result});
  }catch(error){let cleanupFailed=false;try{const cleanup=await db.rpc('cancel_applicant_sms_preview',{p_batch:item.batch});cleanupFailed=!!cleanup.error;}catch{cleanupFailed=true;}errors.push({name,id:item.id,source:item.source,code:error instanceof SmsPreparationError?error.code:'unavailable',message:(error instanceof Error?error.message:'준비하지 못했습니다.')+(cleanupFailed?' · 초안 취소 상태를 발송 기록에서 확인해주세요.':'')});}
 }
 let cursor=0;await Promise.all(Array.from({length:Math.min(3,input.items.length)},async()=>{while(cursor<input.items.length){const item=input.items[cursor++];await prepareItem(item);}}));
 return {ready,errors};
}
export async function cancelApplicantSms(batch:string){const db=await client();const r=await db.rpc('cancel_applicant_sms_preview',{p_batch:batch});checked(r.error);}
export type EventSmsLog={id:string;kind:string;event_id:string|null;application_source:string|null;application_id:string|null;applicant_name:string|null;template_id:string|null;language:string|null;recipient:string|null;body:string;state:string;created_at:string;updated_at:string;provider_group:string|null;resend:boolean;failure_reason:string|null;message_type:string;batch_id:string|null};
export async function eventSmsLogs(filters:{event?:string;source?:string;id?:string;name?:string;language?:string;state?:string;date?:string;until?:string;category?:string;page?:number;batches?:string[];purpose?:string}={}){
 const db=await client();if(filters.batches&&(!Array.isArray(filters.batches)||!filters.batches.length||filters.batches.length>50||!filters.batches.every(smsUuid)))throw new Error('발송 기록 선택을 확인해주세요.');let q=db.from('sms_jobs').select('*,event_sms_templates(category,title,version),sms_batches(created_by)',{count:'exact'}).order('created_at',{ascending:false}).order('id');
 if(filters.purpose){
  if(!Object.hasOwn(smsPurposes,filters.purpose))throw new Error('문자 카테고리를 확인해주세요.');
  const templates=await db.from('event_sms_templates').select('id,category,title');checked(templates.error);
  const keys=(templates.data??[]).filter(template=>smsTemplatePurpose(template)===filters.purpose).map(template=>template.id).filter(smsUuid);
  const parts=keys.length?['template_id.in.('+keys.join(',')+')']:[];
  if(filters.purpose==='receipt')parts.push('kind.eq.notification');
  if(filters.purpose==='direct')parts.push('and(template_id.is.null,kind.neq.notification)');
  if(!parts.length)return {rows:[],count:0};q=q.or(parts.join(','));
 }
 if(filters.batches)q=q.in('batch_id',filters.batches);
 if(filters.event)q=q.eq('event_id',filters.event);if(filters.source)q=q.eq('application_source',filters.source);if(filters.id)q=q.eq('application_id',filters.id);
 if(filters.name)q=q.ilike('applicant_name','%'+filters.name.replace(/[%_]/g,'').slice(0,100)+'%');if(filters.language)q=q.eq('language',filters.language);if(filters.state)q=q.eq('state',filters.state);
 if(filters.date&&/^\d{4}-\d{2}-\d{2}$/.test(filters.date))q=q.gte('created_at',filters.date+'T00:00:00+09:00');
 if(filters.until&&/^\d{4}-\d{2}-\d{2}$/.test(filters.until))q=q.lt('created_at',new Date(new Date(filters.until+'T00:00:00+09:00').getTime()+86400000).toISOString());
 if(filters.category){const t=await db.from('event_sms_templates').select('id').eq('category',filters.category);checked(t.error);if(!t.data?.length)return {rows:[],count:0};q=q.in('template_id',t.data.map(v=>v.id));}
 const page=Math.max(0,Math.min(10000,Math.floor(filters.page??0)));const r=await q.range(page*30,page*30+29);checked(r.error);
 const actor=await db.auth.getUser();
 const delivered=r.data?.length?await db.from('sms_job_history').select('job_id,happened_at').in('job_id',r.data.map(row=>row.id)).in('state',['accepted','delivered']).order('happened_at'):null;
 if(delivered)checked(delivered.error);
 return {rows:((r.data??[]) as unknown as (EventSmsLog&{event_sms_templates:{category:string;title:string;version:number}|null;sms_batches:{created_by:string}|null})[]).map(row=>({...row,sent_at:delivered?.data?.find(item=>item.job_id===row.id)?.happened_at??null,can_cancel:row.state==='draft'&&!!actor.data.user&&batchOwner(row.sms_batches)===actor.data.user.id})),count:r.count??0};
}
export async function eventSmsHistory(id:string){const db=await client();const r=await db.from('sms_job_history').select('*').eq('job_id',id).order('id');checked(r.error);return r.data as {id:number;state:string;happened_at:string;actor:string|null;provider_group:string|null;failure_reason:string|null}[];}

export async function failedSmsApplicants(jobIds:string[]){
 const db=await client();if(!Array.isArray(jobIds)||!jobIds.length||jobIds.length>30||!jobIds.every(smsUuid))throw new Error('실패 문자 선택을 확인해주세요.');
 const jobs=await db.from('sms_jobs').select('id,state,event_id,application_source,application_id').in('id',jobIds).eq('state','failed');checked(jobs.error);
 const targets=[];const seen=new Set<string>();
 for(const job of jobs.data??[]){
  if(!job.event_id||!job.application_id||!['season9','registration','manual'].includes(job.application_source??''))continue;
  const key=job.event_id+':'+job.application_source+':'+job.application_id;if(seen.has(key))continue;seen.add(key);
  const row=await db.from('event_application_admin_list').select('id,source,event_id,name,contact,contact_type,status,payment_status').eq('id',job.application_id).eq('source',job.application_source!).eq('event_id',job.event_id).eq('is_archived',false).maybeSingle();checked(row.error);
  if(!row.data)continue;
  const event=await db.from('recruitment_events').select('title').eq('id',job.event_id).eq('is_archived',false).maybeSingle();checked(event.error);
  if(event.data)targets.push({...row.data,event_title:event.data.title});
 }
 return targets as {id:string;source:string;event_id:string;event_title:string;name:string;contact:string;contact_type:string;status:string;payment_status:string}[];
}

async function recordRefundSmsConfirmation(db:Awaited<ReturnType<typeof client>>,input:{event:string;source:string;id:string;batch:string},slug:string){
 const current=await db.from('event_application_admin_list').select('name,contact,contact_type,birth_year,nationality,status,payment_status,internal_note,source_note,revision').eq('event_id',input.event).eq('source',input.source).eq('id',input.id).eq('is_archived',false).single();checked(current.error);
 const row=current.data!;if(row.payment_status!=='refunded')throw new Error('환불 상태가 변경되었습니다. 최신 목록을 확인해주세요.');
 const marker='[환불 안내 확인 '+input.batch+']';if((row.internal_note??'').includes(marker))return;
 const note=[row.internal_note,marker+' 운영진이 실제 환불 완료를 확인함 · '+new Date().toISOString()+' · 문자 준비 기록이며 이체 증빙 아님'].filter(Boolean).join('\n');if(note.length>3000)throw new Error('내부 메모가 길어 환불 확인 기록을 추가하지 못했습니다. 기존 메모를 확인해주세요.');
 const saved=await db.rpc('manage_event_application',{p_slug:slug,p_source:input.source,p_id:input.id,p_revision:row.revision,p_name:row.name,p_contact:row.contact,p_contact_type:row.contact_type,p_birth_year:row.birth_year,p_nationality:row.nationality,p_status:row.status,p_payment:row.payment_status,p_note:note,p_source_note:row.source_note});checked(saved.error);if(saved.data?.code!=='saved')throw new Error('환불 확인 기록을 저장하지 못했습니다. 다른 운영진의 변경을 확인하고 다시 준비해주세요.');
}
export async function resolveApplicantSmsDraft(input:{event:string;source:string;id:string}){
 const db=await client();if(![input.event,input.id].every(smsUuid)||!['season9','registration','manual'].includes(input.source))throw new Error('신청자 선택을 확인해주세요.');
 const user=await db.auth.getUser();if(!user.data.user)throw new Error('관리자 계정을 확인해주세요.');
 const jobs=await db.from('sms_jobs').select('batch_id,sms_batches(created_by)').eq('event_id',input.event).eq('application_source',input.source).eq('application_id',input.id).not('template_id','is',null).eq('state','draft');checked(jobs.error);
 if(jobs.data?.some(j=>batchOwner(j.sms_batches)!==user.data.user!.id))throw new Error('다른 운영진의 초안은 취소하지 않습니다. 담당자에게 확인해주세요.');
 for(const job of jobs.data??[])if(job.batch_id){const result=await db.rpc('cancel_applicant_sms_preview',{p_batch:job.batch_id});checked(result.error);}
 return {message:'내 미발송 초안을 취소했습니다. 최신 상태로 다시 준비합니다.'};
}

export async function smsBatchOutcomes(batches:string[]){
 const db=await client();if(!Array.isArray(batches)||!batches.length||batches.length>50||!batches.every(smsUuid))throw new Error('발송 결과 선택을 확인해주세요.');
 const result=await db.from('sms_jobs').select('id,batch_id,applicant_name,recipient,body,state,failure_reason').in('batch_id',batches).limit(2500);checked(result.error);
 return (result.data??[]).map(row=>({id:row.id,batch_id:row.batch_id!,name:row.applicant_name??'수신자',to:row.recipient?maskPhone(row.recipient):'번호 없음',body:row.body,state:row.state,reason:row.failure_reason}));
}

export async function createSeason9ClassSmsTemplates(eventId:string){
 const data=await eventSmsData(eventId);
 if(data.event.slug!=='season9')throw new Error('9기 행사에서만 등록할 수 있습니다.');
 let created=0;
 for(const template of season9ClassSmsTemplates(eventId)){
  if(data.templates.some(row=>row.title===template.title&&row.language===template.language))continue;
  await saveEventSmsTemplate(eventId,null,0,{category:template.category,language:template.language,title:template.title,body:template.body,active:true,is_default:false});created++;
 }
 return created;
}
