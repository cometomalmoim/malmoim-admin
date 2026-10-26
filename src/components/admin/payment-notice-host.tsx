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
 const notice=useSyncExternalStore(paymentNoticeStore.subscribe,paymentNoticeStore.snapshot,paymentNoticeStore.serverSnapshot);
 useEffect(()=>{if(notice&&!dialog.current?.open)dialog.current?.showModal();},[notice]);
 return notice?<dialog ref={dialog} key={notice.token} className="payment-notice-dialog" aria-label="납부 상태 저장 안내" onCancel={event=>{event.preventDefault();paymentNoticeStore.dismiss();}}><h2>납부 상태를 저장했습니다</h2><p role="status">{notice.row.name} · {notice.kind==='paid'?'입금 완료':'환불'}로 저장했습니다.</p><p className="ops-muted">안내 문자는 자동 발송되지 않습니다. 관련 문구를 확인한 뒤 보내주세요.</p><div className="payment-notice-actions"><ApplicantBulkSms rows={[notice.row]} notice={notice.kind} label={notice.kind==='paid'?'입금 확인 문자 준비':'환불 안내 확인'}/><ApplicantSms row={notice.row}/><button type="button" aria-label="저장 안내 닫기" onClick={()=>paymentNoticeStore.dismiss()}>나중에 하기</button></div></dialog>:null;
}
