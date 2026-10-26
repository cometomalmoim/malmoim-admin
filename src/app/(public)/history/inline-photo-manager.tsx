'use client';
import {useEffect,useRef,useState} from 'react';
import dynamic from 'next/dynamic';
import {usePathname} from 'next/navigation';
import './inline-photo-manager.css';

const PhotoManager=dynamic(()=>import('@/components/admin/simple-history-photo-ui').then(m=>m.HistoryPhotoUi));

/** Visibility is only presentation; every API operation independently verifies admin_users. */
export function InlinePhotoManager({onChanged}:{onChanged:()=>void}){
 const [allowed,setAllowed]=useState(false);
 const dialog=useRef<HTMLDialogElement>(null);
 const english=usePathname().startsWith('/en/');
 useEffect(()=>{
  const controller=new AbortController();
  async function check(){try{
   const response=await fetch('/api/admin/history-photos',{cache:'no-store',signal:controller.signal});
   const data=await response.json();
   if(!controller.signal.aborted){setAllowed(response.ok&&data.enabled===true);if(!response.ok||data.enabled!==true)dialog.current?.close();}
  }catch{if(!controller.signal.aborted){setAllowed(false);dialog.current?.close();}}}
  void check();window.addEventListener('focus',check);
  return()=>{controller.abort();window.removeEventListener('focus',check);};
 },[]);
 return <>{allowed&&<div className="history-photo-tools"><button type="button" onClick={()=>dialog.current?.showModal()}>{english?'+ Add photos':'+ 사진 등록'}</button><span>{english?'Add and manage activity photos':'활동 사진 등록·수정·공개 관리'}</span></div>}
 <dialog ref={dialog} className="history-photo-dialog" aria-labelledby="history-photo-manager-title">
  <header><h2 id="history-photo-manager-title">{english?'Manage activity photos':'활동 사진 관리'}</h2><button type="button" onClick={()=>dialog.current?.close()}>{english?'Close':'닫기'}</button></header>
  {allowed&&<><p>{english?'Up to 10 photos per activity. Uploaded activities appear under Special Activities after publication.':'활동당 최대 10장입니다. 공개 승인한 사진은 특별 활동에 표시됩니다.'}</p><PhotoManager onChanged={onChanged}/></>}
 </dialog></>;
}
