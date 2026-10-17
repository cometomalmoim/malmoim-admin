'use client';
import {useEffect,useRef,useState} from 'react';
import type {TargetRequest} from '@/lib/signing-targets';
export function DemoRequestControls({row,call,getPdf,refresh}:{row:TargetRequest;call:(body:Record<string,unknown>)=>Promise<{path?:string;verificationCode?:string;phase?:string;hasPdf?:boolean}>;getPdf:()=>Promise<Blob>;refresh:()=>Promise<void>}){
 const [link,setLink]=useState<{path:string;code:string}|null>(null),[phase,setPhase]=useState('미확인'),[notice,setNotice]=useState(''),[url,setUrl]=useState(''),[busy,setBusy]=useState(false);
 const currentUrl=useRef('');useEffect(()=>()=>{if(currentUrl.current)URL.revokeObjectURL(currentUrl.current);},[]);
 async function act(action:'link'|'status'|'pdf'){
  setBusy(true);setNotice('');try{
   if(action==='pdf'){const blob=await getPdf();if(currentUrl.current)URL.revokeObjectURL(currentUrl.current);currentUrl.current=URL.createObjectURL(blob);setUrl(currentUrl.current);}
   else{const data=await call({operation:action==='link'?'demo-link':'demo-status',eventId:row.key.event_id,requestId:row.id});if(data.path&&data.verificationCode)setLink({path:data.path,code:data.verificationCode});if(data.phase)setPhase(data.phase);await refresh();}
  }catch(e){setNotice((e as Error).message);}finally{setBusy(false);}
 }
 return <div><p>개발 전용 시연 · 참가자 단계: {phase}</p><button disabled={busy||!['pending','completed'].includes(row.status)} onClick={()=>void act('link')}>개발 테스트 링크 준비</button><button disabled={busy} onClick={()=>void act('status')}>참가자 단계·완료 상태 확인</button>{link&&<div><a href={link.path} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">참가자 테스트 화면 열기 ↗</a><p>가상 확인 코드: <code>{link.code}</code> (실제 OTP 아님)</p></div>}
 {row.status==='completed'&&<button disabled={busy} onClick={()=>void act('pdf')}>서버 메모리 완료 PDF 확인</button>}
 {url&&<div><a href={url} target="_blank" rel="noopener noreferrer">완료 테스트 PDF 미리보기</a><br/><a href={url} download="malmoim-development-signed.pdf">완료 테스트 PDF 다운로드</a></div>}<p role="status">{notice}</p></div>;
}
