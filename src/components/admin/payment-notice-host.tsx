"use client";
import {useEffect,useRef,useState} from 'react';
import type {ApplicationRow} from '@/lib/recruitment';
import type {PaymentNotice} from '@/lib/payment-notice';
import {ApplicantSms,type ApplicantSmsHandle} from './applicant-sms';
type Notice={row:ApplicationRow;kind:PaymentNotice;token:string};
export function offerPaymentNotice(row:ApplicationRow,kind:PaymentNotice){
 window.dispatchEvent(new CustomEvent<Notice>('malmoim-payment-notice',{detail:{row,kind,token:crypto.randomUUID()}}));
}
export function PaymentNoticeHost(){
 const [notice,setNotice]=useState<Notice|null>(null);
 const sms=useRef<ApplicantSmsHandle>(null);
 useEffect(()=>{
  const receive=(event:Event)=>setNotice((event as CustomEvent<Notice>).detail);
  window.addEventListener('malmoim-payment-notice',receive);
  return()=>window.removeEventListener('malmoim-payment-notice',receive);
 },[]);
 useEffect(()=>{if(notice)sms.current?.openPaymentNotice(notice.kind);},[notice]);
 return notice?<ApplicantSms key={notice.token} ref={sms} row={notice.row} hideTrigger/>:null;
}
