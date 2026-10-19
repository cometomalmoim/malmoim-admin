'use client';

import Image from 'next/image';
import {useEffect,useId,useRef,useState} from 'react';

export function RecruitmentPoster({english=false}:{english?:boolean}){
 const dialog=useRef<HTMLDialogElement>(null);
 const titleId=useId();
 const [open,setOpen]=useState(false);
 const src=`/season9/recruitment-poster-${english?'en':'ko'}.png`;
 const title=english?'Season 9 recruitment poster':'말모임 9기 모집 포스터';
 const alt=english?'MALMOIM Season 9: English and Korean language exchange, cultural activities, classes start November 5 and 7 at Seoul Youth Center Eunpyeong.':'말모임 9기 국문 모집 포스터. 10월 19일부터 31일까지 모집, 서울청년센터 은평에서 11월 5일부터 6주간 목요일 또는 토요일 활동, 참가비 5만원.';
 useEffect(()=>{if(!open)return;const previous=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=previous;};},[open]);
 return <figure className="s9-recruitment-poster">
  <button type="button" className="s9-poster-trigger" aria-label={english?'Enlarge the Season 9 recruitment poster':'9기 모집 포스터 크게 보기'} aria-haspopup="dialog" onClick={()=>{dialog.current?.showModal();setOpen(true);}}>
   <Image src={src} alt={alt} width={891} height={1260} preload sizes="(max-width: 760px) calc(100vw - 48px), 440px"/>
   <span className="s9-poster-zoom" aria-hidden="true">{english?'Enlarge poster':'포스터 크게 보기'} ↗</span>
  </button>
  <dialog ref={dialog} className="s9-poster-dialog" aria-labelledby={titleId} onClose={()=>setOpen(false)} onClick={event=>{if(event.target===event.currentTarget)dialog.current?.close();}}>
   <div className="s9-poster-modal">
    <header><h2 id={titleId}>{title}</h2><button type="button" onClick={()=>dialog.current?.close()} aria-label={english?'Close poster':'포스터 닫기'}>{english?'Close':'닫기'} <span aria-hidden="true">×</span></button></header>
    <div className="s9-poster-full"><Image src={src} alt={alt} width={891} height={1260} sizes="(max-width:760px) 95vw, 650px"/></div>
   </div>
  </dialog>
 </figure>;
}

