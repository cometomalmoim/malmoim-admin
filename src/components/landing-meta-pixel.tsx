'use client';
import Script from 'next/script';
import {useEffect,useSyncExternalStore} from 'react';
import {usePathname} from 'next/navigation';
import {initializeMeta,isMetaSurface,metaPageView,type MetaWindow} from '@/lib/meta-pixel';
const subscribeHost=()=>()=>{};
const serverHost=()=>'';
const readHost=()=>window.location.hostname;
export function LandingMetaPixel(){
 const path=usePathname();
 const host=useSyncExternalStore(subscribeHost,readHost,serverHost);
 const eligible=isMetaSurface(path,host);
 useEffect(()=>{
  if(eligible)initializeMeta(window as MetaWindow);
  metaPageView(window as MetaWindow,path,host,eligible);
 },[path,host,eligible]);
 function ready(){
  if(!isMetaSurface(window.location.pathname,window.location.hostname))return;
  (window as MetaWindow).malmoimMetaReady=true;
  initializeMeta(window as MetaWindow);metaPageView(window as MetaWindow,window.location.pathname,window.location.hostname,true);window.dispatchEvent(new Event('malmoim-meta-ready'));
 }
 if(!eligible)return null;
 return <Script id="malmoim-meta-pixel" src="https://connect.facebook.net/en_US/fbevents.js" strategy="afterInteractive" onReady={ready} onLoad={ready}/>;
}
