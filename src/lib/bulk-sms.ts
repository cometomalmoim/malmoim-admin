import {messagingTemplates} from './messaging-templates';
import type {EventSmsTemplate} from './event-sms';
import {domesticPhone} from './sms-contract';
export type SmsAudience={id:string;source:string;event_id:string;event_title?:string;name:string;contact:string;contact_type:string;status:string;payment_status:string};
export function bulkSmsAudience(rows:SmsAudience[],event:string,category:string){
 const seen=new Set<string>(),eligible:SmsAudience[]=[],excluded:{row:SmsAudience;reason:string}[]=[];
 for(const row of rows){let reason='';const phone=domesticPhone(row.contact);
  if(row.event_id!==event)reason='다른 이벤트';else if(row.contact_type!=='phone'||!phone)reason='국내 휴대폰 번호 없음';else if(category==='confirmation'&&(row.status!=='accepted'||row.payment_status!=='paid'))reason='합격·입금 완료 필요';else if(seen.has(phone))reason='중복 번호';
  if(reason)excluded.push({row,reason});else{seen.add(phone!);eligible.push(row);}
 }
 return {eligible,excluded};
}

export function smsStarterTemplates(event:string,language:'ko'|'en'):EventSmsTemplate[]{
 const english:Record<string,string>={payment:'Hi {이름}, here is the fee for {행사명}: {참가비}.\nBank: {은행}\nAccount: {계좌번호}\nAccount holder: {예금주}\nPlease contact the organizers after payment.',refund:'Hi {이름}, we have received your refund request for {행사명}. The organizers will review it and contact you.',accepted:'Hi {이름}, you have been selected for {행사명}.\n{행사일} {시작시간} (KST)\nVenue: {장소}',declined:'Hi {이름}, thank you for applying for {행사명}. Unfortunately, we cannot offer you a place this time. We hope to meet you at a future event.',event:'Hi {이름}, here are the details for {행사명}.\n{행사일} {시작시간} (KST)\nVenue: {장소}',reminder:'Hi {이름}, a reminder about {행사명}.\n{행사일} {시작시간} (KST)\nVenue: {장소}',waitlisted:'Hi {이름}, you are on the waiting list for {행사명}. We will contact you if a place becomes available.'};
 const starters=messagingTemplates.filter(t=>t.id!=='inquiry_reply').map(t=>({id:'starter:'+t.id+':'+language,event_id:event,template_key:'',version:0,category:t.id==='payment'?'payment':t.id==='reminder'?'reminder':'custom',language,title:t.label,body:language==='en'?english[t.id]:t.body.replaceAll('{이벤트명}','{행사명}').replaceAll('{일정}','{행사일} {시작시간} (한국 시간)').replaceAll('{참가비안내}','{참가비}').replaceAll('{문의처}','Instagram @cometomalmoim').replace('납부 기한: {납부기한}\n',''),active:true,is_default:false,created_at:''} as EventSmsTemplate));
 return [...starters,{id:'starter:custom:'+language,event_id:event,template_key:'',version:0,category:'custom',language,title:language==='ko'?'자유 문자':'Custom message',body:'',active:true,is_default:false,created_at:''}];
}
