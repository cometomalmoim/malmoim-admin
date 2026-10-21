'use client';
import {useEffect} from 'react';
import {readMetaConsent} from '@/lib/meta-consent';
import {completeRegistration} from '@/lib/meta-registration';
import type {MetaRegistrationReceipt} from '@/lib/meta-registration-receipt';
import type {MetaWindow} from '@/lib/meta-pixel';
export function useRegistrationConversion(receipt?:MetaRegistrationReceipt){
 useEffect(()=>{
  // Consent must already exist when the saved response is observed; no retrospective conversion.
  if(!receipt||readMetaConsent()!=='granted')return;
  const send=()=>{
   if(!navigator.locks)return; // A durable cross-tab claim is required to avoid double dispatch.
   void completeRegistration(window as MetaWindow,receipt,{host:location.hostname,path:location.pathname,consent:()=>readMetaConsent()==='granted',storage:localStorage,lock:async(key,fn)=>await navigator.locks.request(key,fn)});
  };
  const safeSend=()=>{try{send();}catch{/* Analytics must not affect the saved UI. */}};
  safeSend();window.addEventListener('malmoim-meta-ready',safeSend);
  return()=>window.removeEventListener('malmoim-meta-ready',safeSend);
 },[receipt]);
}
