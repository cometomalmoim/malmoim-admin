'use client';
import {useEffect,useId,useRef,useState}from 'react';
import {halloweenAgeCopy}from '@/lib/halloween-age-policy';
import {HalloweenDokkaebi}from './halloween-dokkaebi';
import './halloween-age-notice.css';
export function HalloweenAgeNotice({english=false}:{english?:boolean}){
 const container=useRef<HTMLDivElement>(null),dialog=useRef<HTMLDialogElement>(null),shown=useRef(false),titleId=useId(),bodyId=useId();
 const sound=useRef<HTMLAudioElement>(null);
 const [phase,setPhase]=useState<'choose'|'arrival'|'notice'>('choose');
 const [audioState,setAudioState]=useState<'silent'|'playing'|'ended'|'unavailable'>('silent');
 const nextAction=useRef<HTMLButtonElement>(null);
 const copy=halloweenAgeCopy(english);
 const t=(ko:string,en:string)=>english?en:ko;
 function stopSound(){if(sound.current){sound.current.pause();sound.current.currentTime=0;}}
 function begin(withSound:boolean){setPhase('arrival');if(withSound&&sound.current){sound.current.volume=.6;sound.current.play().catch(()=>setAudioState('unavailable'));}}
 function skip(){stopSound();setPhase('notice');}
 useEffect(()=>{if(phase!=='arrival')return;const timer=setTimeout(()=>setPhase('notice'),2400);return()=>clearTimeout(timer);},[phase]);
 useEffect(()=>{if(dialog.current?.open)nextAction.current?.focus({preventScroll:true});},[phase]);
 useEffect(()=>{const audio=sound.current;return()=>{audio?.pause();};},[]);
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
  <audio ref={sound} src="/events/halloween-2026/welcome.wav?v=join-v2" preload="none" onPlay={()=>setAudioState('playing')} onEnded={()=>setAudioState('ended')} onError={()=>setAudioState('unavailable')}/>
  <dialog ref={dialog} className={`hw-age-dialog ${phase==='notice'?'':'hw-welcome-dialog'}`} aria-labelledby={titleId} aria-describedby={bodyId} onClose={()=>{stopSound();setPhase('notice');container.current?.scrollIntoView({block:'start',behavior:'instant'});container.current?.closest('form')?.querySelector<HTMLInputElement>('input[name="name"]')?.focus({preventScroll:true});}}>
   {phase==='notice'?<><span className="hw-age-icon" aria-hidden="true">!</span><h2 id={titleId}>DO YOU WANT TO JOIN US?</h2><div id={bodyId}><span className="hw-age-prefix">{copy.title}</span><strong>{copy.range}</strong><p>{copy.description}</p>{audioState==='unavailable'&&<small>{t('이 환경에서는 음성을 재생할 수 없지만 신청은 계속할 수 있습니다.','Audio is unavailable here. You can still continue with your application.')}</small>}</div><button ref={nextAction} type="button" onClick={()=>dialog.current?.close()}>JOIN</button><p className="hw-join-help">{t('JOIN을 누르면 신청서로 이동합니다. 정보를 입력하고 신청을 완료해주세요.','Select JOIN to open the application form, enter your details and submit.')}</p></>:<div className={`hw-welcome-stage ${phase==='arrival'?'hw-welcome-arrival':'hw-welcome-choice'}`}>
    <span className="hw-welcome-kicker">MALMOIM · HALLOWEEN</span><HalloweenDokkaebi english={english}/><h2 id={titleId}>WELCOME</h2>
    <p id={bodyId}>{phase==='choose'?t('잠깐, 도깨비가 여러분을 기다리고 있어요. 짧은 깜짝 등장 연출이 있습니다.','A goblin is waiting to welcome you. A brief surprise animation is about to begin.'):t('도깨비가 기다리던 손님이 왔군요.','The goblin has been expecting you.')}</p>
    {phase==='choose'?<><div className="hw-welcome-actions"><button ref={nextAction} type="button" onClick={()=>begin(true)}>{t('소리 켜고 입장','Enter with sound')}</button><button type="button" onClick={()=>begin(false)}>{t('조용히 입장','Enter quietly')}</button></div><button type="button" className="hw-welcome-skip" onClick={skip}>{t('연출 건너뛰고 안내 보기','Skip to the notice')}</button></>:<><p className="hw-welcome-audio" role="status">{audioState==='playing'?t('WELCOME 음성 재생 중','Playing WELCOME'):audioState==='unavailable'?t('소리 없이 계속합니다','Continuing without audio'):t('잠시 후 참가 안내로 이어집니다','The participation notice will appear shortly')}</p><button ref={nextAction} type="button" className="hw-welcome-skip" onClick={skip}>{t('건너뛰기','Skip')}</button></>}
   </div>}
  </dialog>
 </div>;
}
