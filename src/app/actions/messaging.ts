'use server';
import {createClient} from '@/lib/supabase/server';
import {getAdminAccess} from '@/lib/auth';
import {smsConfig,smsPrice,maskPhone,smsDelivery} from '@/lib/solapi';
import {domesticPhone,validSmsText,smsUuid,type SmsPrepared} from '@/lib/sms-contract';
import {composeMessaging} from '@/lib/messaging-templates';
import {processSmsQueue} from '@/lib/sms-worker';

async function adminClient(){if((await getAdminAccess()).status!=='admin')throw new Error('forbidden');return createClient();}
export async function messagingStatus(){
 try{const client=await adminClient(),config=smsConfig();const result=await client.from('sms_settings').select('sending_enabled,notifications_enabled').single();
  if(result.error)return {ready:false,configured:!!config};
  let rates:{LMS:number;SMS:number}|null=null;try{if(config)rates=await smsPrice();}catch{/* Account price remains unverified. */}
  const jobs=await client.from('sms_jobs').select('id,kind,recipient,state,created_at,provider_group,batch_id').order('created_at',{ascending:false}).limit(30);
  if(jobs.error)return {ready:false,configured:!!config};
  return {ready:true,configured:!!config,rates,sender:config?maskPhone(config.sender):'',notify:config?maskPhone(config.notify):'',sending:result.data.sending_enabled,notifications:result.data.notifications_enabled,jobs:(jobs.data??[]).map(j=>({...j,recipient:j.recipient?maskPhone(j.recipient):'운영자 알림번호'}))};
 }catch{return {ready:false,configured:false};}
}
export async function initializeMessaging(){try{const client=await adminClient(),config=smsConfig();if(!config)return {ok:false,message:'서버의 문자 발송 설정을 확인해주세요.'};const {error}=await client.rpc('sms_initialize',{p_hash:config.workerHash});return {ok:!error,message:error?'연결하지 못했습니다. SQL 적용 상태를 확인해주세요.':'서버 설정을 저장했습니다. API 인증은 본인 번호 테스트 준비에서 확인합니다.'};}catch{return {ok:false,message:'관리자 권한을 확인해주세요.'};}}
export async function toggleMessaging(sending:boolean,notifications:boolean){try{const client=await adminClient();if(sending){if(!smsConfig())return {ok:false,message:'서버 설정을 확인해주세요.'};await smsPrice();}const {error}=await client.rpc('sms_toggle',{p_sending:sending,p_notifications:notifications});return {ok:!error,message:error?'설정을 바꾸지 못했습니다. 본인 번호 테스트의 도달 성공을 먼저 확인해주세요.':'설정을 저장했습니다.'};}catch{return {ok:false,message:'관리자 권한을 확인해주세요.'};}}
export async function prepareSms(input:{eventId:string;mode:'event'|'direct'|'test';recipients:{id:string;source:string}[];numbers:string;body:string;name:string;due:string;contact:string}):Promise<{preview?:SmsPrepared;message?:string}>{
 try{
  const client=await adminClient(),config=smsConfig();if(!config)throw new Error('설정');
  if(!['event','direct','test'].includes(input.mode)||input.body.length>2000||input.numbers.length>4000||input.name.length>100||input.due.length>100||input.contact.length>200)throw new Error('입력');
  let event:{title:string;starts_at:string|null;location:string;fee_notice:string}|null=null;
  const eventId=input.eventId||null;
  if(eventId){if(!smsUuid(eventId))throw new Error('이벤트');const result=await client.from('recruitment_events').select('title,starts_at,location,fee_notice').eq('id',eventId).eq('is_archived',false).eq('is_test',false).single();if(result.error)throw new Error('이벤트');event=result.data;}
  const values={'이벤트명':event?.title??'','일정':event?.starts_at?new Intl.DateTimeFormat('ko-KR',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Seoul'}).format(new Date(event.starts_at))+' (한국 시간)':'','장소':event?.location??'','참가비안내':event?.fee_notice??'','납부기한':input.due,'문의처':input.contact};
  const items:{to:string;text:string;source?:string;id?:string;revision?:number}[]=[];
  if(input.mode==='test'){items.push({to:config.notify,text:'[말모임] 문자 발송 연결 테스트입니다. 이 문자는 설정된 운영자 알림번호로만 발송됩니다.'});}
  else if(input.mode==='event'){
   if(!eventId||input.recipients.length<1||input.recipients.length>50)throw new Error('대상');
   const seen=new Set<string>();
   for(const key of input.recipients){if(!smsUuid(key.id)||!['season9','registration','manual'].includes(key.source))throw new Error('대상');
    const result=await client.from('event_application_admin_list').select('name,contact,contact_type,revision').eq('id',key.id).eq('source',key.source).eq('event_id',eventId).eq('is_archived',false).single();
    if(result.error||result.data.contact_type!=='phone')throw new Error('대상');
    const to=domesticPhone(result.data.contact);if(!to)throw new Error('국내 휴대폰 번호');if(seen.has(to))continue;seen.add(to);
    const rendered=composeMessaging(input.body,{...values,'이름':result.data.name});if(rendered.missing.length||!validSmsText(rendered.text))throw new Error('문자 내용');
    items.push({to,text:rendered.text,source:key.source,id:key.id,revision:result.data.revision});
   }
  }else{
   const entries=input.numbers.split(/[\n,;]+/).map(s=>s.trim()).filter(Boolean);if(!entries.length||entries.length>50)throw new Error('대상');
   const rendered=composeMessaging(input.body,{...values,'이름':input.name});if(rendered.missing.length||!validSmsText(rendered.text))throw new Error('문자 내용');
   const seen=new Set<string>();for(const entry of entries){const to=domesticPhone(entry);if(!to)throw new Error('국내 휴대폰 번호');if(!seen.has(to)){seen.add(to);items.push({to,text:rendered.text});}}
  }
  const prices=await smsPrice(),id=crypto.randomUUID();
  const {error}=await client.rpc('sms_prepare',{p_id:id,p_event:eventId,p_items:items,p_price:prices.LMS,p_kind:input.mode==='test'?'test':'manual'});
  if(error)throw new Error('저장');
  return {preview:{id,count:items.length,total:prices.LMS*items.length,unit:prices.LMS,type:'LMS',sample:items[0].text,sender:maskPhone(config.sender),recipient:input.mode==='test'?maskPhone(config.notify):`${items.length}개 국내 휴대폰 번호`,items:items.map(item=>({to:maskPhone(item.to),text:item.text}))}};
 }catch{return {message:'발송 전 확인을 준비하지 못했습니다. 설정·SQL·선택 대상·미입력 변수·본문 길이(UTF-8 2,000바이트 이내)를 확인해주세요.'};}
}
export async function approveSms(batch:string){
 try{const client=await adminClient(),config=smsConfig();if(!config||!smsUuid(batch))throw new Error('invalid');
  const b=await client.from('sms_batches').select('kind').eq('id',batch).single();if(b.error)throw new Error('missing');
  if(b.data.kind==='test'){const jobs=await client.from('sms_jobs').select('recipient').eq('batch_id',batch);if(jobs.error||jobs.data.length!==1||jobs.data[0].recipient!==config.notify)throw new Error('invalid_test');}
  const {error}=await client.rpc('sms_approve',{p_id:batch});if(error)return {ok:false,message:'발송하지 않았습니다. 실제 발송 설정·대상 변경·미리보기 만료를 확인해주세요.'};
  await processSmsQueue(client,batch,3);const remaining=await client.from('sms_jobs').select('id',{count:'exact',head:true}).eq('batch_id',batch).eq('state','queued');return {ok:true,remaining:remaining.count??0,message:'처리 결과를 발송 기록에서 확인해주세요. 업체 접수는 휴대폰 도달 성공과 다릅니다.'};
 }catch{return {ok:false,message:'결과를 확인하지 못했습니다. 다시 발송하지 말고 기록과 SOLAPI 내역을 먼저 확인해주세요.'};}
}
export async function refreshSms(jobId:string){try{const client=await adminClient(),config=smsConfig();if(!config||!smsUuid(jobId))throw new Error('invalid');const result=await client.from('sms_jobs').select('provider_group,state').eq('id',jobId).single();if(result.error||result.data.state!=='accepted'||!result.data.provider_group)throw new Error('invalid');const state=await smsDelivery(result.data.provider_group);const done=await client.rpc('sms_finish',{p_token:config.worker,p_id:jobId,p_state:state,p_group:null});return {ok:!done.error,message:done.error?'기록 갱신에 실패했습니다.':'발송 결과를 확인했습니다.'};}catch{return {ok:false,message:'결과 조회에 실패했습니다. 문자를 재발송하지 않았습니다.'};}}
export async function processPendingAlerts(){try{const client=await adminClient();await processSmsQueue(client,null,3);return {ok:true,message:'알림 대기열을 확인했습니다. 발송 기록을 확인해주세요.'};}catch{return {ok:false,message:'관리자 권한을 확인해주세요.'};}}
