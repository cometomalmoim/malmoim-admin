'use client';
import {useEffect,useRef,useState,useTransition} from 'react';
import {useRouter} from 'next/navigation';
import type {ApplicationRow} from '@/lib/recruitment';
import {applicantKey} from '@/lib/applicant-selection';
import {archiveApplicants} from '@/app/actions/applicants';
import {ApplicantInlineRow} from './applicant-inline-row';

export function ApplicantTable({rows,eventMode=false,archived=false}:{rows:ApplicationRow[];eventMode?:boolean;archived?:boolean}){
 const [selected,setSelected]=useState<Set<string>>(new Set());
 const [pending,startTransition]=useTransition();
 const [message,setMessage]=useState('');
 const confirm=useRef<HTMLDialogElement>(null),all=useRef<HTMLInputElement>(null);
 const router=useRouter();
 const chosen=rows.filter(row=>selected.has(applicantKey(row)));
 useEffect(()=>{if(all.current)all.current.indeterminate=chosen.length>0&&chosen.length<rows.length;},[chosen.length,rows.length]);
 function apply(){const items=chosen.map(({id,source,event_id,revision,archive_revision})=>({id,source,event_id,revision,archive_revision}));startTransition(async()=>{
  try{const code=await archiveApplicants(items,!archived);if(code==='saved'){confirm.current?.close();setSelected(new Set());router.refresh();}else setMessage(code==='conflict'?'다른 운영진이 수정했습니다. 최신 목록을 불러온 뒤 다시 선택해주세요.':'처리하지 못했습니다. 선택한 신청자는 그대로 유지됩니다.');}catch{setMessage('처리하지 못했습니다. 다시 시도해주세요.');}
 });}
 return <>{!eventMode&&<div className="applicant-bulk"><span>현재 페이지 {rows.length}명 · {chosen.length}명 선택</span><button type="button" disabled={!chosen.length||pending} className={archived?'':'applicant-delete'} onClick={()=>{setMessage('');confirm.current?.showModal();}}>{archived?'선택 복원':'선택 삭제'}</button><span className="ops-muted">현재 페이지에서만 선택됩니다.</span></div>}
 <div className="ops-table-scroll applicant-list-scroll"><table className="ops-applications applicant-table"><caption>개인정보는 행사 운영에 필요한 범위에서 확인해주세요.</caption><thead><tr>{!eventMode&&<th scope="col"><input ref={all} type="checkbox" aria-label="현재 페이지 전체 선택" checked={rows.length>0&&chosen.length===rows.length} disabled={pending} onChange={e=>setSelected(e.target.checked?new Set(rows.map(applicantKey)):new Set())}/></th>}{[...(!eventMode?['이벤트']:[]),'이름','유입경로',...(!eventMode?['매체·캠페인']:[]),'연락처','출생연도','국적','한국어 수준','영어 수준','선발 상태','입금 확인','접수일','상세·수정'].map(label=><th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{rows.map(row=><ApplicantInlineRow key={`${row.source}-${row.id}-${row.revision}`} row={row} eventMode={eventMode} busy={pending} readOnly={archived} selection={!eventMode?<input type="checkbox" aria-label={`${row.name} 선택 (${row.event_title})`} checked={selected.has(applicantKey(row))} disabled={pending} onChange={e=>setSelected(old=>{const next=new Set(old);if(e.target.checked)next.add(applicantKey(row));else next.delete(applicantKey(row));return next;})}/>:undefined}/>)}</tbody></table></div>
 <dialog ref={confirm} className="applicant-detail-dialog applicant-confirm" aria-label={archived?'신청자 복원 확인':'신청자 삭제 확인'}><h2>{chosen.length}명을 {archived?'복원':'삭제'}할까요?</h2><p>{archived?'신청자 목록에 다시 표시됩니다.':'목록에서 숨깁니다. 원본 신청·납부·출석 기록은 보존하며 삭제된 신청자에서 복원할 수 있습니다.'}</p><ul>{chosen.map(row=><li key={applicantKey(row)}>{row.name} · {row.event_title}</li>)}</ul><p role="alert" className="applicant-error">{message}</p><div className="ops-shortcuts"><button type="button" disabled={pending} onClick={()=>confirm.current?.close()}>취소</button><button type="button" disabled={pending} className="evt-primary" onClick={apply}>{pending?'처리 중…':archived?'복원하기':'삭제하기'}</button></div>{message&&<button type="button" disabled={pending} onClick={()=>{confirm.current?.close();router.refresh();}}>최신 목록 불러오기</button>}</dialog></>;
}
