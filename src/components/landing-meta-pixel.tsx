'use client';
import Script from 'next/script';
import {useEffect,useSyncExternalStore} from 'react';
import {usePathname} from 'next/navigation';
import {initializeMeta,isMetaSurface,metaPageView,type MetaWindow} from '@/lib/meta-pixel';
import {readMetaConsent,subscribeMetaConsent} from '@/lib/meta-consent';
const serverConsent=()=>null;
const serverHost=()=>'';
const readHost=()=>window.location.hostname;
export function LandingMetaPixel(){
 const path=usePathname();
 const consent=useSyncExternalStore(subscribeMetaConsent,readMetaConsent,serverConsent);
 const host=useSyncExternalStore(subscribeMetaConsent,readHost,serverHost);
 const eligible=isMetaSurface(path,host);
 useEffect(()=>{
  if(eligible&&consent==='granted')initializeMeta(window as MetaWindow);
  metaPageView(window as MetaWindow,path,host,eligible&&consent==='granted');
 },[path,host,eligible,consent]);
 function ready(){
  if(readMetaConsent()!=='granted'||!isMetaSurface(window.location.pathname,window.location.hostname))return;
  (window as MetaWindow).malmoimMetaReady=true;
  initializeMeta(window as MetaWindow);metaPageView(window as MetaWindow,window.location.pathname,window.location.hostname,true);window.dispatchEvent(new Event('malmoim-meta-ready'));
 }
 // Removing the banner does not grant measurement permission.
 if(!eligible||consent!=='granted')return null;
 return <Script id="malmoim-meta-pixel" src="https://connect.facebook.net/en_US/fbevents.js" strategy="afterInteractive" onReady={ready} onLoad={ready}/>;
}
