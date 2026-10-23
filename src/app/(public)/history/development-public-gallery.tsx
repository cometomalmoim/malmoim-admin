'use client';
import {useEffect,useState} from 'react';
import {HistoryGallery} from './history-content';
import type {HistoryPhoto} from './history-data';
import {isPhotoLabRequest} from '@/lib/history-activities/development-target';
import {localFinalPhotos} from '@/lib/history-activities/development-final-photos';
/** Production keeps the static gallery. Only exact 3004 development reads the lab. */
export function DevelopmentPublicGallery({photos}:{photos:HistoryPhoto[]}){
 const [extra,setExtra]=useState<HistoryPhoto[]>([]);
 useEffect(()=>{
  if(!isPhotoLabRequest(process.env.NODE_ENV,window.location.host))return;
  let cancelled=false;const urls=new Set<string>();
  async function load(){try{
   const response=await fetch('/photo-management-preview/public-photos',{cache:'no-store',credentials:'omit'});if(!response.ok)throw Error('Unavailable');
   const data=await response.json();const final=await localFinalPhotos(data.photos,url=>{if(cancelled)URL.revokeObjectURL(url);else urls.add(url);});
   if(!cancelled)setExtra(final);
  }catch{if(!cancelled)setExtra([]);}}
  void load();return()=>{cancelled=true;urls.forEach(url=>URL.revokeObjectURL(url));};
 },[]);
 return <HistoryGallery photos={[...photos,...extra]}/>;
}
