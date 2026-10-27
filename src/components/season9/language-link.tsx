'use client';
import Link from 'next/link';
import {useSyncExternalStore} from 'react';
import {season9LanguageHref} from '@/lib/season9-navigation';
function subscribe(listener:()=>void){window.addEventListener('popstate',listener);window.addEventListener('hashchange',listener);return()=>{window.removeEventListener('popstate',listener);window.removeEventListener('hashchange',listener);};}
function locationSnapshot(){return location.search+location.hash;}
export function LanguageLink({english}:{english:boolean}){
 const location=useSyncExternalStore(subscribe,locationSnapshot,()=> '');
 const index=location.indexOf('#'),search=index<0?location:location.slice(0,index),hash=index<0?'':location.slice(index);
 return <Link href={season9LanguageHref(english,search,hash)} hrefLang={english?'ko':'en'}>{english?'한국어':'English'}</Link>;
}
