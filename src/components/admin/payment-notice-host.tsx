"use client";
import {useSyncExternalStore} from 'react';
import {paymentNoticeStore} from '@/lib/payment-notice-store';
import type {ApplicationRow} from '@/lib/recruitment';
import type {PaymentNotice} from '@/lib/payment-notice';
import {ApplicantBulkSms} from './applicant-bulk-sms';
export function offerPaymentNotice(row:ApplicationRow,kind:PaymentNotice){
 paymentNoticeStore.offer({row,kind,token:crypto.randomUUID()});
}
export function PaymentNoticeHost(){
 const queued=useSyncExternalStore(paymentNoticeStore.subscribe,paymentNoticeStore.queueSnapshot,paymentNoticeStore.queueServerSnapshot);
 const gathering=useSyncExternalStore(paymentNoticeStore.subscribe,paymentNoticeStore.gatheringSnapshot,paymentNoticeStore.gatheringServerSnapshot);
 const groups=Array.from(new Set(queued.map(item=>item.row.event_id+':'+item.kind))).map(key=>queued.filter(item=>item.row.event_id+':'+item.kind===key));
 const notice=useSyncExternalStore(paymentNoticeStore.subscribe,paymentNoticeStore.snapshot,paymentNoticeStore.serverSnapshot);
 return <>{(gathering||queued.length>0)&&<aside className="payment-queue" aria-label="모아둔 문자 안내"><strong>안내 대기 {queued.length}명 / 50명</strong><span>{gathering?'상태를 변경하면 안내 대상에 자동으로 모읍니다.':'모아둔 대상만 확인 후 보내세요.'}</span>{groups.map(items=><ApplicantBulkSms key={items[0].row.event_id+items[0].kind} rows={items.map(item=>item.row)} notice={items[0].kind} label={`${items[0].row.event_title??'이벤트'} · ${items[0].kind==='paid'?'입금 확인':'환불 안내'} ${items.length}명 준비`}/>)}<details><summary>대상 확인·정리</summary>{queued.map(item=><p key={item.token}>{item.row.name} · {item.kind==='paid'?'입금 확인':'환불 안내'} <button type="button" onClick={()=>paymentNoticeStore.remove(item.token)}>제외</button></p>)}<small>대상은 이 브라우저에서만 임시 보관됩니다. 새로고침하면 사라집니다. 발송 후에는 대상을 비워주세요.</small></details>{gathering&&<button type="button" onClick={()=>paymentNoticeStore.stopGathering()}>개별 안내로 전환</button>}<button type="button" onClick={()=>paymentNoticeStore.clearQueue()}>대상 비우기·종료</button></aside>}{notice?<ApplicantBulkSms key={notice.token} rows={[notice.row]} notice={notice.kind} autoOpen onClose={()=>paymentNoticeStore.dismiss()} onGather={queued.length<50||queued.some(item=>item.row.id===notice.row.id&&item.row.source===notice.row.source&&item.row.event_id===notice.row.event_id)?()=>paymentNoticeStore.gather(notice):undefined}/>:null}</>;
}
