export const refundStatuses = {requested:'요청',approved:'승인',rejected:'거절',processed:'처리 완료'};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function refundRequestInput(data: FormData) {
 const source=String(data.get('source')??'');
 const applicationId=String(data.get('application_id')??'');
 const reason=String(data.get('reason')??'').trim();
 const local=String(data.get('requested_at')??'');
 const parsed=new Date(`${local}:00+09:00`);
 if(!['season9','registration','manual'].includes(source)||!uuid.test(applicationId)||!reason||reason.length>2000
  ||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)||!Number.isFinite(parsed.getTime())
  ||new Date(parsed.getTime()+9*3600000).toISOString().slice(0,16)!==local||parsed.getTime()>Date.now())throw new Error('invalid');
 return {source,applicationId,reason,requestedAt:parsed.toISOString()};
}
export function refundUpdateInput(data: FormData) {
 const id=String(data.get('refund_id')??''),action=String(data.get('refund_action')??'');
 const amountText=String(data.get('processed_amount_krw')??'').trim();
 const transferConfirmed=data.get('transfer_confirmed')==='on';
 if(!uuid.test(id)||!['approve','reject','process'].includes(action))throw new Error('invalid');
 let amount:number|null=null;
 if(action==='process'){
  amount=Number(amountText);
  if(!/^\d+$/.test(amountText)||!Number.isSafeInteger(amount)||amount>2147483647||!transferConfirmed)throw new Error('invalid');
 }else if(amountText)throw new Error('invalid');
 return {id,action,amount,transferConfirmed};
}
export type RefundRow={id:string;source:string;application_id:string;reason:string;requested_at:string;status:keyof typeof refundStatuses;
 decision_by:string|null;decision_at:string|null;processed_amount_krw:number|null;processed_by:string|null;processed_at:string|null;created_by:string;};
