"use client";
import Link from 'next/link';
import {useRef,useState,useTransition} from 'react';
import {inspectReviewMember,manageReviewMember,findReviewMemberByEmail} from './actions';
type Evidence={sessions?:{session_date:string;attendance:string}[];source:string;application:string;title:string;starts_at:string|null;confirmation:string;attendance:string;archived:boolean;eligible:boolean};
type Context={member:{id:string;email:string;confirmed:boolean};person:{id:string;name:string;contact:string};link:{person_id:string;revision:number;status:string}|null;evidence:Evidence[];audit:{revision:number;action:string;reason:string;created_at:string}[]};
export function ReviewAccessManager(){
 const emailInput=useRef<HTMLInputElement>(null);
 function requestEmailSearch(){if(emailInput.current?.reportValidity())start(search);}
 const [email,E]=useState(''),[found,F]=useState<{id:string;email:string;confirmed:boolean}|null>(null);
 const [user,U]=useState(''),[person,P]=useState(''),[context,C]=useState<Context|null>(null),[selected,S]=useState(''),[identity,I]=useState(false),[reason,R]=useState(''),[message,M]=useState(''),[busy,start]=useTransition();
 function reset(){C(null);S('');I(false);R('');M('');}
 async function search(){reset();U('');F(null);const result=await findReviewMemberByEmail(email);if('error'in result){M(result.error??'조회 오류입니다.');return;}F(result.member);U(result.member.id);M('회원 계정을 찾았습니다. 참가자를 별도로 조회하고 동일인 여부와 출석을 확인해주세요.');}
 async function inspect(){C(null);I(false);S('');const result=await inspectReviewMember(user.trim(),person.trim());if('error'in result){M(result.error??'조회 오류입니다.');return;}C(result.data as Context);M('신원을 실제 참가 기록과 대조한 후 직접 확인해주세요. 자동 연결하지 않습니다.');}
 const evidence=context?.evidence.find(e=>`${e.source}:${e.application}`===selected);
 const mismatch=!!context?.link&&context.link.person_id!==context.person.id;
 function change(action:'approve'|'revoke'){start(async()=>{const result=await manageReviewMember({user:user.trim(),person:person.trim(),action,revision:context?.link?.revision??0,identity,source:evidence?.source??'',application:evidence?.application??'',reason});await inspect();R('');M('error'in result?(result.error??'결과를 다시 조회해주세요.'):`${action==='approve'?'승인':'철회'} 완료. 현재 버전 ${result.revision}`);});}
 return <section className="ops-panel"><h1>후기 작성 권한 승인·철회</h1><p>회원에게 확인한 Auth 회원 ID와 기존 참가자 ID로 조회합니다. 이름·연락처 유사성만으로 승인하지 마세요. 참가·출석 기록은 수정하지 않습니다.</p><p><Link href="/admin/participants">기존 참가 이력 관리 열기</Link></p>
 <div role="group" aria-label="회원 이메일 검색"><label>정확한 회원 이메일<input ref={emailInput} type="email" required onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();requestEmailSearch();}}} maxLength={254} value={email} disabled={busy} onChange={e=>{E(e.target.value);U('');F(null);reset();}}/></label><button type="button" disabled={busy} onClick={requestEmailSearch}>회원 이메일 검색</button></div>
 {found&&<p>조회 회원: {found.email} / UUID: {found.id} / 이메일 인증: {found.confirmed?'완료':'미확인'} — 참가 연결·승인은 아직 하지 않았습니다.</p>}
 <form aria-label="회원·참가 이력 조회" onSubmit={e=>{e.preventDefault();start(inspect);}}><label>Auth 회원 ID<input required value={user} disabled={busy} onChange={e=>{U(e.target.value);F(null);reset();}}/></label><label>기존 참가자 ID<input required value={person} disabled={busy} onChange={e=>{P(e.target.value);reset();}}/></label><button type="submit" disabled={busy}>회원·참가 이력 조회</button></form>
 <p role="status">{busy?'처리 중…':message}</p>
 {context&&<><h2>회원과 참가자 신원 대조</h2><p>회원: {context.member.email} / 이메일 확인: {context.member.confirmed?'완료':'미확인'}</p><p>참가자: {context.person.name} / 기존 연락처: {context.person.contact}</p><p>연결 상태: {context.link?.status??'미연결'} / 버전: {context.link?.revision??0}</p>{mismatch&&<p role="alert">다른 참가자와 이미 연결돼 있습니다. 이 화면에서 변경하거나 철회할 수 없습니다.</p>}
 <h2>실제 참가 근거</h2><p>최근 최대 100개 참가 기록과 최근 20개 승인 이력을 표시합니다. 세션 출석 기준도 서버에서 확인합니다.</p>{context.evidence.length===0&&<p>등록된 참가 근거가 없습니다. 과거 기록 누락 여부는 별도 확인이 필요합니다.</p>}
 {context.evidence.map(e=><label key={`${e.source}:${e.application}`} style={{display:'block'}}><input type="radio" name="evidence" disabled={busy||!e.eligible} checked={selected===`${e.source}:${e.application}`} onChange={()=>{S(`${e.source}:${e.application}`);I(false);}}/>{e.title} / {e.starts_at??'활동일 없음'} / 참가 {e.confirmation} / 출석 {e.attendance} / {e.archived?'보관·비활성':'활성'} / {e.eligible?'권한 근거 충족':'권한 근거 미충족'}{e.sessions?.length?` / 회차 기록: ${e.sessions.map(s=>`${s.session_date} ${s.attendance}`).join(', ')}`:''}</label>)}
 <label><input type="checkbox" checked={identity} disabled={busy} onChange={e=>I(e.target.checked)}/>회원 본인과 기존 참가자가 동일인임을 직접 확인했습니다</label>
 <label>승인·철회 사유<textarea maxLength={2000} value={reason} disabled={busy} onChange={e=>R(e.target.value)}/></label>
 <button type="button" disabled={busy||mismatch||!identity||!evidence?.eligible||!reason.trim()} onClick={()=>change('approve')}>후기 작성 권한 승인</button>
 <button type="button" disabled={busy||mismatch||context.link?.status!=='approved'||!reason.trim()} onClick={()=>change('revoke')}>후기 작성 권한 철회</button>
 <h2>최근 승인·철회 이력</h2><ul>{context.audit.map(a=><li key={a.revision}>{a.created_at} / {a.action} / 버전 {a.revision} / {a.reason}</li>)}</ul></>}
 </section>;
}
