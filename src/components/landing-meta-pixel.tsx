'use client';
import Script from 'next/script';
import {useEffect,useState,useSyncExternalStore} from 'react';
import {usePathname} from 'next/navigation';
import {initializeMeta,isMetaSurface,metaPageView,type MetaWindow} from '@/lib/meta-pixel';
import './landing-meta-pixel.css';
import {readMetaConsent,saveMetaConsent,subscribeMetaConsent} from '@/lib/meta-consent';
const serverConsent=()=>null;
const serverHost=()=>'';
const readHost=()=>window.location.hostname;
export function LandingMetaPixel(){
 const path=usePathname();
 const consent=useSyncExternalStore(subscribeMetaConsent,readMetaConsent,serverConsent);
 const host=useSyncExternalStore(subscribeMetaConsent,readHost,serverHost);
 const eligible=isMetaSurface(path,host);
 const [editing,setEditing]=useState(false);
 useEffect(()=>{
  if(eligible&&consent==='granted')initializeMeta(window as MetaWindow);
  metaPageView(window as MetaWindow,path,host,eligible&&consent==='granted');
 },[path,host,eligible,consent]);
 function choose(value:'granted'|'denied'){
  saveMetaConsent(value);
  if(value==='granted')initializeMeta(window as MetaWindow);
  setEditing(false);
  metaPageView(window as MetaWindow,path,window.location.hostname,value==='granted');
 }
 function ready(){
  if(readMetaConsent()!=='granted'||!isMetaSurface(window.location.pathname,window.location.hostname))return;
  (window as MetaWindow).malmoimMetaReady=true;
  initializeMeta(window as MetaWindow);metaPageView(window as MetaWindow,window.location.pathname,window.location.hostname,true);window.dispatchEvent(new Event('malmoim-meta-ready'));
 }
 if(!eligible)return null;
 const english=path.endsWith('/en')||path==='/season9/en/apply'||(path==='/season9/apply'&&new URLSearchParams(window.location.search).get('lang')==='en');
 const open=consent===null||editing;
 return <>
  {consent==='granted'&&<Script id="malmoim-meta-pixel" src="https://connect.facebook.net/en_US/fbevents.js" strategy="afterInteractive" onReady={ready} onLoad={ready}/>}
  {open?<section className="meta-consent" aria-label={english?'Advertising measurement preferences':'광고 측정 설정'}>
   <div><strong>{english?'Advertising measurement':'광고 측정 안내'}</strong><p>{english?'With your permission, Meta Pixel uses cookies, visits and successful registration events to measure ads. Your name, contact details and application answers are not sent. You can apply without agreeing.':'동의하면 Meta 픽셀이 쿠키·방문 정보·신청 완료 이벤트로 광고 효과를 측정합니다. 이름·연락처·신청 답변은 전송하지 않습니다. 동의하지 않아도 신청할 수 있습니다.'}</p></div>
   <div className="meta-consent-actions"><button type="button" onClick={()=>choose('denied')}>{english?'Do not allow':'동의하지 않음'}</button><button type="button" onClick={()=>choose('granted')}>{english?'Allow measurement':'측정 동의'}</button></div>
  </section>:<button className="meta-consent-settings" type="button" onClick={()=>setEditing(true)}>{english?'Ad measurement settings':'광고 측정 설정'}</button>}
 </>;
}
