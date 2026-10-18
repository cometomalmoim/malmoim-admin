'use client';
import Script from 'next/script';
import {useEffect,useState,useSyncExternalStore} from 'react';
import {usePathname} from 'next/navigation';
import {initializeMeta,isMetaLanding,metaPageView,META_CONSENT_KEY,type MetaWindow} from '@/lib/meta-pixel';
import './landing-meta-pixel.css';
let memoryConsent:string|null=null;
function readConsent(){try{const value=localStorage.getItem(META_CONSENT_KEY);return value==='granted'||value==='denied'?value:memoryConsent;}catch{return memoryConsent;}}
function subscribe(listener:()=>void){window.addEventListener('storage',listener);window.addEventListener('malmoim-meta-consent',listener);return()=>{window.removeEventListener('storage',listener);window.removeEventListener('malmoim-meta-consent',listener);};}
const serverConsent=()=>null;
const serverHost=()=>'';
const readHost=()=>window.location.hostname;
export function LandingMetaPixel(){
 const path=usePathname();
 const consent=useSyncExternalStore(subscribe,readConsent,serverConsent);
 const host=useSyncExternalStore(subscribe,readHost,serverHost);
 const eligible=isMetaLanding(path,host);
 const [editing,setEditing]=useState(false);
 useEffect(()=>{
  if(eligible&&consent==='granted')initializeMeta(window as MetaWindow);
  metaPageView(window as MetaWindow,path,host,eligible&&consent==='granted');
 },[path,host,eligible,consent]);
 function choose(value:'granted'|'denied'){
  try{localStorage.setItem(META_CONSENT_KEY,value);}catch{/* Consent still applies to this page. */}
  memoryConsent=value;
  if(value==='granted')initializeMeta(window as MetaWindow);
  window.dispatchEvent(new Event('malmoim-meta-consent'));setEditing(false);
  metaPageView(window as MetaWindow,path,window.location.hostname,value==='granted');
 }
 function ready(){
  if(readConsent()!=='granted'||!isMetaLanding(window.location.pathname,window.location.hostname))return;
  initializeMeta(window as MetaWindow);metaPageView(window as MetaWindow,window.location.pathname,window.location.hostname,true);
 }
 if(!eligible)return null;
 const english=path.endsWith('/en');
 const open=consent===null||editing;
 return <>
  {consent==='granted'&&<Script id="malmoim-meta-pixel" src="https://connect.facebook.net/en_US/fbevents.js" strategy="afterInteractive" onReady={ready} onLoad={ready}/>}
  {open?<section className="meta-consent" aria-label={english?'Advertising measurement preferences':'광고 측정 설정'}>
   <div><strong>{english?'Advertising measurement':'광고 측정 안내'}</strong><p>{english?'With your permission, Meta Pixel uses cookies and visit information to measure ads. Your name, contact details and application answers are not sent. You can apply without agreeing.':'동의하면 Meta 픽셀이 쿠키와 방문 정보를 사용해 광고 효과를 측정합니다. 이름·연락처·신청 답변은 전송하지 않습니다. 동의하지 않아도 신청할 수 있습니다.'}</p></div>
   <div className="meta-consent-actions"><button type="button" onClick={()=>choose('denied')}>{english?'Do not allow':'동의하지 않음'}</button><button type="button" onClick={()=>choose('granted')}>{english?'Allow measurement':'측정 동의'}</button></div>
  </section>:<button className="meta-consent-settings" type="button" onClick={()=>setEditing(true)}>{english?'Ad measurement settings':'광고 측정 설정'}</button>}
 </>;
}
