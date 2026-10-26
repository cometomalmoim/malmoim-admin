"use client";
import {useEffect,useState} from 'react';
import type {ApplicationRow} from '@/lib/recruitment';
import type {PaymentNotice} from '@/lib/payment-notice';
import {ApplicantBulkSms} from './applicant-bulk-sms';
import {ApplicantSms} from './applicant-sms';
type Notice={row:ApplicationRow;kind:PaymentNotice;token:string};
export function offerPaymentNotice(row:ApplicationRow,kind:PaymentNotice){
 window.dispatchEvent(new CustomEvent<Notice>('malmoim-payment-notice',{detail:{row,kind,token:crypto.randomUUID()}}));
}
export function PaymentNoticeHost(){
 const [notice,setNotice]=useState<Notice|null>(null);
 useEffect(()=>{const receive=(event:Event)=>setNotice((event as CustomEvent<Notice>).detail);window.addEventListener('malmoim-payment-notice',receive);return()=>window.removeEventListener('malmoim-payment-notice',receive);},[]);
 return notice?<aside key={notice.token} className="payment-notice-bar" aria-label="납부 상태 저장 안내"><span role="status">{notice.row.name} · {notice.kind==='paid'?'입금 완료':'환불'}로 저장했습니다.</span><ApplicantBulkSms rows={[notice.row]} notice={notice.kind} label={notice.kind==='paid'?'입금 확인 문자 준비':'환불 안내 확인'}/><ApplicantSms row={notice.row}/><button type="button" aria-label="저장 안내 닫기" onClick={()=>setNotice(null)}>닫기</button></aside>:null;
}
