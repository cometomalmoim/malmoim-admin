'use client';
import './messaging.css';
import {useImperativeHandle,useRef,useState,useTransition} from 'react';
import type {ApplicationRow} from '@/lib/recruitment';
import {defaultSmsCategory,renderEventSms,eventSmsCategories} from '@/lib/event-sms';
import {paymentNoticeTemplate,type PaymentNotice} from '@/lib/payment-notice';
import Link from 'next/link';
import {smsStates} from '@/lib/sms-contract';
import {eventSmsData,eventSmsLogs,prepareApplicantSms,cancelApplicantSms} from '@/app/actions/event-sms';
import {approveSms} from '@/app/actions/messaging';
import {EventSmsLogs} from './event-sms-logs';
export type ApplicantSmsHandle={openPaymentNotice:(notice:PaymentNotice)=>void};
export function ApplicantSms({row,disabled=false,ref,hideTrigger=false}:{row:ApplicationRow;disabled?:boolean;ref?:React.Ref<ApplicantSmsHandle>;hideTrigger?:boolean}){
 const [notice,setNotice]=useState<PaymentNotice|null>(null),[body,setBody]=useState('');
 const dialog=useRef<HTMLDialogElement>(null),lock=useRef(false),batch=useRef<string|null>(null);
 const [data,setData]=useState<Awaited<ReturnType<typeof eventSmsData>>|null>(null),[state,setState]=useState(row.sms_state??''),[at,setAt]=useState(row.sms_updated_at??'');
 const [language,setLanguage]=useState(''),[template,setTemplate]=useState(''),[fee,setFee]=useState(''),[resend,setResend]=useState(false),[confirmed,setConfirmed]=useState(false);
 const [preview,setPreview]=useState<Awaited<ReturnType<typeof prepareApplicantSms>>|null>(null),[message,setMessage]=useState(''),[busy,start]=useTransition();
 async function status(){const logs=await eventSmsLogs({event:row.event_id,source:row.source,id:row.id});const latest=logs.rows.find(j=>j.template_id);setState(latest?.state??'');setAt(latest?.updated_at??'');}

 const selected=data?.templates.find(t=>t.id===template),rendered=selected&&data?renderEventSms({...selected,body},data.event,row.name,data.details,fee):null;
 function options(d=data,lang=language,mode=notice){return d?.templates.filter(t=>t.active&&t.language===lang&&(mode!=='paid'||paymentNoticeTemplate(t,row.status)))??[];}
 function choose(lang:string,d=data,mode=notice){setLanguage(lang);const choices=options(d,lang,mode).filter(t=>mode==='paid'||t.category===defaultSmsCategory(row.status,row.payment_status)).sort((a,b)=>Number(b.is_default)-Number(a.is_default)||b.created_at.localeCompare(a.created_at));setTemplate(choices[0]?.id??'');setBody(choices[0]?.body??'');}
 function open(mode:PaymentNotice|null){
  if(lock.current||preview)return;
  setNotice(mode);setData(null);setMessage('');setConfirmed(false);setResend(false);setTemplate('');setBody('');dialog.current?.showModal();
  if(mode==='refunded')return;
  run(async()=>{const d=await eventSmsData(row.event_id,row.source,row.id);setData(d);choose(d.preference?.language||(mode==='paid'?'ko':''),d,mode);setFee(d.preference?.fee??'');await status();});
 }
 useImperativeHandle(ref,()=>({openPaymentNotice:mode=>open(mode)}));
 function run(fn:()=>Promise<void>){if(lock.current)return;lock.current=true;start(async()=>{try{await fn();}catch(e){setMessage((e as Error).message);}finally{lock.current=false;}});}
 return <>{!hideTrigger&&<button type="button" className="applicant-cell-button" disabled={disabled||busy} onClick={()=>open(null)}>{busy?'전송 중…':state==='delivered'?'발송 완료':state==='failed'?'발송 실패 · 재전송':state?(smsStates[state]??state):'문자 발송'}</button>}{!hideTrigger&&at&&<small>{new Date(at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})}</small>}
 <dialog ref={dialog} className="applicant-detail-dialog messaging" aria-label={`${row.name} 문자 발송`} onCancel={e=>{if(preview||busy)e.preventDefault();}}><button type="button" disabled={busy} onClick={()=>run(async()=>{if(preview)await cancelApplicantSms(preview.id);setPreview(null);batch.current=null;dialog.current?.close();await status();})}>닫기{preview?' · 미발송 초안 취소':''}</button><h2>{notice==='paid'?'입금 완료 · 안내 문자 확인':notice==='refunded'?'환불 상태 저장 안내':'신청자 문자 발송'}</h2>{notice&&<p>납부 상태는 저장되었습니다. 이 창을 닫아도 상태는 유지됩니다. 문자는 자동 발송되지 않습니다.</p>}{notice==='refunded'&&<p role="alert">환불 상태만으로 실제 환불 완료를 확인할 수 없습니다. 환불 금액·처리 담당자·완료 기록 기능이 연결되기 전에는 환불 완료 문자를 발송하지 않습니다.</p>}<p>{row.name} · {row.contact} · {row.event_title??data?.event.title}</p><p>입금: {row.payment_status} · 선발: {row.status}</p><p>국내 휴대폰만 지원합니다. 해외 번호와 인스타그램 연락처에는 발송할 수 없습니다.</p>
 {data&&notice!=='refunded'&&<><fieldset disabled={busy||!!preview}><label>문자 언어 (필수)<select value={language} onChange={e=>choose(e.target.value)}><option value="">언어를 선택해주세요</option><option value="ko">한국어</option><option value="en">English</option></select></label><label>템플릿<select value={template} onChange={e=>{setTemplate(e.target.value);setBody(data.templates.find(t=>t.id===e.target.value)?.body??'');}}><option value="">템플릿 선택</option>{options().map(t=><option key={t.id} value={t.id}>{eventSmsCategories[t.category]} · {t.title} v{t.version}</option>)}</select></label><label>신청자별 참가비 (저장된 개별 금액 우선)<input maxLength={100} value={fee} onChange={e=>setFee(e.target.value)} placeholder="미입력 시 행사 설정·참가비 안내 적용"/></label><label>문자 내용 직접 수정<textarea rows={8} maxLength={2000} value={body} onChange={e=>setBody(e.target.value)}/><small>이번 발송 내용만 변경합니다. 저장된 템플릿 원본은 유지됩니다.</small></label></fieldset>{notice==='paid'&&!options().length&&<p role="status">이 언어의 입금 확인 템플릿이 없습니다. <Link href="/admin/messages">메시징의 행사별 문자 템플릿 관리</Link>에서 ‘입금 확인’ 예시를 저장해주세요.</p>}
 {selected?.category==='confirmation'&&(row.status!=='accepted'||row.payment_status!=='paid')&&<p role="alert">입금 완료 + 참가 승인일 때만 최종 확정 문자를 발송할 수 있습니다.</p>}
 <pre style={{whiteSpace:'pre-wrap'}}>{preview?.text??rendered?.text??'템플릿을 선택해주세요.'}</pre>{rendered?.missing.length? <p role="alert">필요한 행사 정보: {rendered.missing.join(', ')}</p>:null}
 {state&&<label><input type="checkbox" disabled={busy||!!preview} checked={resend} onChange={e=>setResend(e.target.checked)}/>기존 발송 기록을 확인했으며 중복·재발송에 동의합니다.</label>}
 {!preview?<button type="button" disabled={busy||!selected||!language||!!rendered?.missing.length||(!!state&&!resend)||(selected?.category==='confirmation'&&(row.status!=='accepted'||row.payment_status!=='paid'))} onClick={()=>run(async()=>{batch.current??=crypto.randomUUID();const p=await prepareApplicantSms({batch:batch.current,event:row.event_id,source:row.source,id:row.id,template,language:language as 'ko'|'en',fee,resend,body,purpose:notice==='paid'?'payment_received':undefined});setPreview(p);setConfirmed(false);setMessage('아직 발송하지 않았습니다. 저장된 본문과 비용을 확인해주세요.');})}>발송 전 확인·비용 조회</button>:<><p>{preview.type} · {new TextEncoder().encode(preview.text).length}바이트 · 예상 {preview.cost.toLocaleString()}원 (최종 과금 SOLAPI 기준)<br/>발신 {preview.sender} → 수신 {preview.to}</p><label><input type="checkbox" checked={confirmed} disabled={busy} onChange={e=>setConfirmed(e.target.checked)}/>수신자·언어·본문·비용을 확인했습니다.</label><button type="button" disabled={busy||!confirmed} onClick={()=>run(async()=>{const result=await approveSms(preview.id);setMessage(result.message);setConfirmed(false);if(result.ok){setPreview(null);batch.current=null;}await status();})}>{busy?'전송 중…':'최종 확인 · 실제 문자 1건 발송'}</button><button type="button" disabled={busy} onClick={()=>run(async()=>{await cancelApplicantSms(preview.id);setPreview(null);batch.current=null;await status();})}>미리보기 취소</button></>}
 <EventSmsLogs event={row.event_id} source={row.source} id={row.id}/></>}<p role="status">{message}</p></dialog></>;
}
