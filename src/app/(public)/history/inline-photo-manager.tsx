'use client';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import dynamic from 'next/dynamic';
import {usePathname} from 'next/navigation';
import './inline-photo-manager.css';

const PhotoManager=dynamic(()=>import('@/components/admin/simple-history-photo-ui').then(m=>m.HistoryPhotoUi));

/** Visibility is only presentation; every API operation independently verifies admin_users. */
export function InlinePhotoManager({onChanged,children}:{onChanged:()=>void;children?:(edit:((id:string)=>void)|undefined)=>ReactNode}){
 const [open,setOpen]=useState(false);
 const [albumId,setAlbumId]=useState<string|undefined>();
 function show(id?:string){setAlbumId(id);setOpen(true);}
 function close(){dialog.current?.close();setOpen(false);}
 const [allowed,setAllowed]=useState(false);
 const dialog=useRef<HTMLDialogElement>(null);
 const english=usePathname().startsWith('/en/');
 useEffect(()=>{if(open)dialog.current?.showModal();else dialog.current?.close();},[open]);
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
 return <>{allowed&&<div className="history-photo-tools"><button type="button" onClick={()=>show()}>{english?'+ Add photos':'+ 사진 등록'}</button></div>}
 <dialog ref={dialog} className="history-photo-dialog" onCancel={()=>setOpen(false)} aria-labelledby="history-photo-manager-title">
  <header><h2 id="history-photo-manager-title">{english?'Manage activity photos':'활동 사진 관리'}</h2><button type="button" onClick={close}>{english?'Close':'닫기'}</button></header>
  {allowed&&open&&<><p>{english?'Up to 10 photos per activity. Choose an activity type and, for regular activities, a season.':'활동당 최대 10장입니다. 활동 유형을 선택하고 정규 활동은 기수를 지정해주세요.'}</p><PhotoManager key={albumId??'create'} mode={albumId?'edit':'create'} albumId={albumId} onChanged={onChanged} onRegistered={close}/></>}
 </dialog>{children?.(allowed?(id=>show(id)):undefined)}</>;
}
