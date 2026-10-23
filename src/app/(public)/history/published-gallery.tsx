'use client';
import {useEffect,useState} from 'react';
import {HistoryGallery} from './history-content';
import type {HistoryPhoto} from './history-data';
import {publicHistoryPhoto} from '@/lib/history-activities/photo-browser';
export function PublishedGallery({photos}:{photos:HistoryPhoto[]}){
 const [extra,setExtra]=useState<HistoryPhoto[]>([]);
 useEffect(()=>{let stopped=false,version=0;const controller=new AbortController();async function load(){const current=++version;try{const r=await fetch('/api/history-photos',{cache:'no-store',credentials:'omit',signal:controller.signal}),data=await r.json();const next=r.ok&&data.status==='recorded'?data.activities.map(publicHistoryPhoto):[];if(!stopped&&current===version)setExtra(next);}catch{if(!stopped&&current===version)setExtra([]);}}void load();const timer=setInterval(()=>void load(),45000);return()=>{stopped=true;controller.abort();clearInterval(timer);};},[]);
 return <HistoryGallery photos={[...photos,...extra]}/>;
}
