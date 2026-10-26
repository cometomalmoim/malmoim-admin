"use client";
import {useEffect,useRef,useSyncExternalStore} from 'react';
import {paymentNoticeStore} from '@/lib/payment-notice-store';
import type {ApplicationRow} from '@/lib/recruitment';
import type {PaymentNotice} from '@/lib/payment-notice';
import {ApplicantBulkSms} from './applicant-bulk-sms';
import {ApplicantSms} from './applicant-sms';
export function offerPaymentNotice(row:ApplicationRow,kind:PaymentNotice){
 paymentNoticeStore.offer({row,kind,token:crypto.randomUUID()});
}
export function PaymentNoticeHost(){
 const dialog=useRef<HTMLDialogElement>(null);
 const queued=useSyncExternalStore(paymentNoticeStore.subscribe,paymentNoticeStore.queueSnapshot,paymentNoticeStore.queueServerSnapshot);
 const gathering=useSyncExternalStore(paymentNoticeStore.subscribe,paymentNoticeStore.gatheringSnapshot,paymentNoticeStore.gatheringServerSnapshot);
 const groups=Array.from(new Set(queued.map(item=>item.row.event_id+':'+item.kind))).map(key=>queued.filter(item=>item.row.event_id+':'+item.kind===key));
 const notice=useSyncExternalStore(paymentNoticeStore.subscribe,paymentNoticeStore.snapshot,paymentNoticeStore.serverSnapshot);
 useEffect(()=>{if(notice&&!dialog.current?.open)dialog.current?.showModal();},[notice]);
 return <>{(gathering||queued.length>0)&&<aside className="payment-queue" aria-label="모아둔 문자 안내"><strong>안내 대기 {queued.length}명 / 50명</strong><span>{gathering?'상태를 변경하면 안내 대상에 자동으로 모읍니다.':'모아둔 대상만 확인 후 보내세요.'}</span>{groups.map(items=><ApplicantBulkSms key={items[0].row.event_id+items[0].kind} rows={items.map(item=>item.row)} notice={items[0].kind} label={`${items[0].row.event_title??'이벤트'} · ${items[0].kind==='paid'?'입금 확인':'환불 안내'} ${items.length}명 준비`}/>)}<details><summary>대상 확인·정리</summary>{queued.map(item=><p key={item.token}>{item.row.name} · {item.kind==='paid'?'입금 확인':'환불 안내'} <button type="button" onClick={()=>paymentNoticeStore.remove(item.token)}>제외</button></p>)}<small>대상은 이 브라우저에서만 임시 보관됩니다. 새로고침하면 사라집니다. 발송 후에는 대상을 비워주세요.</small></details>{gathering&&<button type="button" onClick={()=>paymentNoticeStore.stopGathering()}>개별 안내로 전환</button>}<button type="button" onClick={()=>paymentNoticeStore.clearQueue()}>대상 비우기·종료</button></aside>}{notice?<dialog ref={dialog} key={notice.token} className="payment-notice-dialog" aria-label="납부 상태 저장 안내" onCancel={event=>{event.preventDefault();paymentNoticeStore.dismiss();}}><h2>납부 상태를 저장했습니다</h2><p role="status">{notice.row.name} · {notice.kind==='paid'?'입금 완료':'환불'}로 저장했습니다.</p><p className="ops-muted">안내 문자는 자동 발송되지 않습니다. 관련 문구를 확인한 뒤 보내주세요.</p><div className="payment-notice-actions"><ApplicantBulkSms rows={[notice.row]} notice={notice.kind} label={notice.kind==='paid'?'입금 확인 문자 준비':'환불 안내 확인'}/><ApplicantSms row={notice.row}/><button type="button" disabled={queued.length>=50&&!queued.some(item=>item.row.id===notice.row.id&&item.row.source===notice.row.source&&item.row.event_id===notice.row.event_id)} onClick={()=>paymentNoticeStore.gather(notice)}>모아두고 계속 처리</button><button type="button" aria-label="저장 안내 닫기" onClick={()=>paymentNoticeStore.dismiss()}>나중에 하기</button></div></dialog>:null}</>;
}
