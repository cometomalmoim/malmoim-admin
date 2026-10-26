'use client';
import {useEffect,useRef,useState,useTransition} from 'react';
import {messagingStatus,initializeMessaging,toggleMessaging,prepareSms,approveSms,refreshSms,processPendingAlerts} from '@/app/actions/messaging';
import {useSmsDelivery} from './use-sms-delivery';
import {smsStates,type SmsPrepared} from '@/lib/sms-contract';
type Request=Parameters<typeof prepareSms>[0];
export function SmsSend({input,disabled=false}:{input:Request;disabled?:boolean}){
 const [preview,setPreview]=useState<SmsPrepared|null>(null),[message,setMessage]=useState(''),[confirmed,setConfirmed]=useState(false),[sent,setSent]=useState(false);
 const [busy,start]=useTransition(),heading=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{if(preview)heading.current?.focus();},[preview]);
 return <section className="sms-send-panel">
  {!preview?<button type="button" className="messaging-send" disabled={disabled||busy} onClick={()=>start(async()=>{const result=await prepareSms(input);setPreview(result.preview??null);setMessage(result.message??'');})}>{busy?'준비 중…':input.mode==='test'?'본인 번호 테스트 준비':'발송 전 대상·요금 확인'}</button>:<div className="sms-confirm">
   <h3 ref={heading} tabIndex={-1}>발송 전 최종 확인</h3>
   <p>발신 {preview.sender} → {preview.recipient}</p><p>장문(LMS) {preview.count}건 × 계정 단가 {preview.unit.toLocaleString()}원 = 예상 {preview.total.toLocaleString()}원</p>
   <p>계정 조회 시점 단가이며 세금·최종 과금은 SOLAPI 기준입니다. 미리보기는 10분간 유효합니다.</p>
   <details><summary>대상별 전체 내용 확인</summary>{preview.items.map((item,i)=><div key={i}><strong>{item.to}</strong><pre>{item.text}</pre></div>)}</details>
   <label><input type="checkbox" checked={confirmed} disabled={busy||sent} onChange={e=>setConfirmed(e.target.checked)}/>수신 대상·내용·예상 비용을 확인했으며 실제 유료 발송에 동의합니다.</label>
   <button type="button" disabled={!confirmed||busy||sent} className="messaging-send" onClick={()=>start(async()=>{
    let previous=51;
    for(let i=0;i<17;i++){const result=await approveSms(preview.id);setMessage(result.message);if(!result.ok)break;setSent(true);if(!result.remaining||result.remaining>=previous)break;previous=result.remaining;}
   })}>{busy?'발송 요청 처리 중…':sent?'요청 처리됨 · 발송 기록 확인':input.mode==='test'?'내 알림번호로 실제 테스트 1건 발송':'확인한 대상에게 실제 발송'}</button>
   {!sent&&<button type="button" disabled={busy} onClick={()=>{setPreview(null);setConfirmed(false);}}>취소</button>}
   <p>결과 불명은 자동 재발송하지 않습니다. 발송 기록과 SOLAPI 내역을 먼저 확인하세요.</p>
  </div>}
  <p role="status">{message}</p>
 </section>;
}
export function SmsSettings({showLogs=true}:{showLogs?:boolean}){
 const [status,setStatus]=useState<Awaited<ReturnType<typeof messagingStatus>>|null>(null),[message,setMessage]=useState(''),[busy,start]=useTransition();
 const reload=async()=>setStatus(await messagingStatus());
 const deliveryErrors=useSmsDelivery(status?.jobs??[],reload);
 useEffect(()=>{let active=true;messagingStatus().then(value=>{if(active)setStatus(value);}).catch(()=>{if(active)setStatus({ready:false,configured:false});});return()=>{active=false;};},[]);
 const run=(fn:()=>Promise<{message:string}>)=>start(async()=>{try{setMessage((await fn()).message);await reload();}catch{setMessage('처리 결과를 확인하지 못했습니다. 새로고침해 기록을 확인해주세요.');}});
 return <section className="messaging-card sms-settings">
  <h2>문자 연결·신청 알림</h2>
  {!status?<p>설정 확인 중…</p>:<>
   {!status.ready&&<p role="alert">문자 기록 기능이 아직 설정되지 않았거나 조회할 수 없습니다. 운영진에게 설정을 요청해주세요.</p>}
   <p>문자 서비스 설정: {status.configured?'등록됨':'확인 필요'}{status.sender&&<> · 발신 {status.sender} · 알림 수신 {status.notify}</>}</p>
   {status.rates&&<p>계정 단가: 단문(SMS) {status.rates.SMS.toLocaleString()}원 · 장문(LMS) {status.rates.LMS.toLocaleString()}원/건. 세금·최종 과금은 SOLAPI 기준입니다.</p>}
   <p>실제 발송: {status.sending?'켜짐':'꺼짐'} · 새 신청 알림: {status.notifications?'켜짐':'꺼짐'}</p>
   <p>처음 연결하면 실제 발송은 꺼져 있습니다. 본인 번호 테스트 도달 성공을 확인한 뒤 켤 수 있습니다. 자동 알림은 켠 이후의 새 신청부터 적용됩니다.</p>
   <div className="sms-actions"><button type="button" disabled={busy||!status.ready||!status.configured} onClick={()=>run(initializeMessaging)}>서버 연결 설정</button>
   <button type="button" disabled={busy||!status.ready} onClick={()=>run(()=>toggleMessaging(!status.sending,status.sending?false:!!status.notifications))}>{status.sending?'실제 발송 끄기':'테스트 확인 후 실제 발송 켜기'}</button>
   <button type="button" disabled={busy||!status.ready||!status.sending} onClick={()=>run(()=>toggleMessaging(true,!status.notifications))}>{status.notifications?'신청 알림 끄기':'새 신청 알림 켜기'}</button>
   <button type="button" disabled={busy||!status.ready||!status.notifications} onClick={()=>run(processPendingAlerts)}>대기 중 신청 알림 처리</button><button type="button" disabled={busy} onClick={()=>start(reload)}>기록 새로고침</button></div>
   <p>수동 문자는 국내 휴대폰 대상 장문(LMS), 신청 알림은 이벤트명·신청자명을 포함하며 길이에 따라 SMS 또는 LMS로 과금됩니다. 한 번에 최대 50명, 하루 전체 발송 시도 최대 200건입니다. 문자 실패로 신청 접수가 취소되지는 않습니다.</p>
   <SmsSend disabled={!status.ready||!status.configured} input={{eventId:'',mode:'test',recipients:[],numbers:'',body:'',name:'',due:'',contact:''}}/>
   {showLogs&&<><h3>최근 발송 기록</h3>
   {status.jobs?.length?<ul className="sms-log">{status.jobs.map(job=><li key={job.id}><span>{new Intl.DateTimeFormat('ko-KR',{dateStyle:'short',timeStyle:'short',timeZone:'Asia/Seoul'}).format(new Date(job.created_at))} · {job.kind==='notification'?'신청 알림':job.kind==='test'?'본인 테스트':'안내 문자'} · {job.recipient}</span><strong>{smsStates[job.state]??job.state}</strong>{(['failed','unknown'].includes(job.state)||deliveryErrors.includes(job.id))&&<button type="button" disabled={busy} onClick={()=>run(()=>refreshSms(job.id))}>결과 다시 조회</button>}{job.state==='unknown'&&<small>중복 발송 방지를 위해 재발송하지 않습니다. SOLAPI 내역을 확인해주세요.</small>}</li>)}</ul>:<p>발송 기록이 없습니다.</p>}</>}
  </>}
  <p role="status">{message}</p>
 </section>;
}
