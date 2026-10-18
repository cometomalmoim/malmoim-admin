export type MessageEvent={id:string;title:string;fee:number|null;due:string;notice:string};
export type MessageApplicant={eventId:string;source:string;id:string;name:string;contact:string;contactType:string;status:string;payment:string;paidAmount:number|null};
export type MessageRefund={eventId:string;source:string;applicationId:string;status:string};
export const messageKey=(a:MessageApplicant)=>JSON.stringify([a.eventId,a.source,a.id]);
export function messagePhone(contact:string){let phone=contact.trim().replace(/[ ()-]/g,'');if(/^010[0-9]{8}$/.test(phone))phone='+82'+phone.slice(1);if(/^0082/.test(phone))phone='+'+phone.slice(2);if(!/^\+?[0-9]{8,15}$/.test(phone))return null;return '+'+phone.replace(/^\+/,'');}
export function paymentCandidates(event:MessageEvent,applicants:MessageApplicant[],refunds:MessageRefund[]){
 const seen=new Set<string>();return applicants.filter(a=>a.eventId===event.id).map(a=>{const reasons:string[]=[];const phone=messagePhone(a.contact);
 if(a.status!=='accepted')reasons.push('합격 대상 아님');
 if(a.payment!=='unpaid')reasons.push(({unknown:'납부 여부 미확인',pending_confirmation:'입금 확인 대기',paid:'이미 납부 완료',refunded:'환불 상태'} as Record<string,string>)[a.payment]??'미입금 상태 아님');
 if(event.fee===null||!Number.isSafeInteger(event.fee)||event.fee<=0)reasons.push('참가비 미정·무료 또는 금액 오류');
 if(a.paidAmount!==null)reasons.push('실제 납부액 기록 있음 — 운영진 확인 필요');
 if(a.contactType!=='phone')reasons.push('전화번호 연락처 아님');else if(!phone)reasons.push('유효하지 않은 전화번호');
 if(refunds.some(r=>r.eventId===a.eventId&&r.source===a.source&&r.applicationId===a.id&&['requested','approved','processed'].includes(r.status)))reasons.push('진행 중·완료된 환불 있음');
 if(!reasons.length&&phone){if(seen.has(phone))reasons.push('같은 수신번호 중복 — 앞선 대상만 선택 가능');else seen.add(phone);}
 return {...a,key:messageKey(a),phone,reasons,eligible:reasons.length===0};});}
export const messageTemplates={basic:'{이름}님, {이벤트명} 참가비 {참가비} 입금 안내입니다.\n납부 기한: {납부기한}\n{입금안내}',reminder:'{이름}님, {이벤트명} 참가비 {참가비} 납부 안내드립니다.\n납부 기한: {납부기한}\n이미 입금하셨다면 운영진에게 확인을 요청해주세요.\n{입금안내}'};
export function renderMessage(template:string,event:MessageEvent,name:string){const values:Record<string,string>={이름:name,이벤트명:event.title,참가비:event.fee===null?'미정':`${event.fee.toLocaleString('ko-KR')}원`,납부기한:event.due||'미정',입금안내:event.notice||'미정'};
 const unknown=[...template.matchAll(/\{([^{}]+)\}/g)].map(m=>m[1]).filter(k=>!Object.hasOwn(values,k));
 const errors:string[]=[];if(!template.trim())errors.push('문자 내용을 입력해주세요.');if(template.length>2000)errors.push('템플릿은 2,000자 이내로 작성해주세요.');if(unknown.length)errors.push(`지원하지 않는 변수: ${[...new Set(unknown)].join(', ')}`);
 return {text:template.replace(/\{([^{}]+)\}/g,(_,key:string)=>values[key]??`{${key}}`),errors};}
