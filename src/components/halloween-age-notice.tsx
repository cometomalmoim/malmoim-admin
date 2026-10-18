'use client';
import {useEffect,useId,useRef}from 'react';
import {halloweenAgeCopy}from '@/lib/halloween-age-policy';
import './halloween-age-notice.css';
export function HalloweenAgeNotice({english=false}:{english?:boolean}){
 const container=useRef<HTMLDivElement>(null),dialog=useRef<HTMLDialogElement>(null),shown=useRef(false),titleId=useId(),bodyId=useId();
 const copy=halloweenAgeCopy(english);
 useEffect(()=>{
  const node=container.current,modal=dialog.current;if(!node||!modal)return;
  const observer=new IntersectionObserver(entries=>{
   if(shown.current||!entries.some(entry=>entry.isIntersecting))return;
   shown.current=true;observer.disconnect();modal.showModal();
  },{rootMargin:'0px 0px 100px 0px'});
  observer.observe(node);return()=>observer.disconnect();
 },[]);
 return <div className="hw-age-notice" ref={container}>
  <strong>{copy.range}</strong><p>{copy.description}</p>
  <dialog ref={dialog} className="hw-age-dialog" aria-labelledby={titleId} aria-describedby={bodyId} onClose={()=>{container.current?.scrollIntoView({block:'start',behavior:'instant'});container.current?.closest('form')?.querySelector<HTMLInputElement>('input[name="name"]')?.focus({preventScroll:true});}}>
   <span className="hw-age-icon" aria-hidden="true">!</span><h2 id={titleId}>{copy.title}</h2>
   <div id={bodyId}><strong>{copy.range}</strong><p>{copy.description}</p></div>
   <button type="button" onClick={()=>dialog.current?.close()}>{copy.confirm}</button>
  </dialog>
 </div>;
}
