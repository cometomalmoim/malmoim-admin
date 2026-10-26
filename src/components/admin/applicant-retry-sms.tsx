"use client";
import {useRef,useState,useTransition} from 'react';
import {failedSmsApplicants} from '@/app/actions/event-sms';
import type {SmsAudience} from '@/lib/bulk-sms';
import {ApplicantSmsComposer} from './applicant-bulk-sms';
export function ApplicantRetrySms({jobIds}:{jobIds:string[]}){
 const dialog=useRef<HTMLDialogElement>(null),[rows,setRows]=useState<SmsAudience[]>([]),[message,setMessage]=useState(''),[busy,start]=useTransition(),[locked,setLocked]=useState(false),[open,setOpen]=useState(false);
 return jobIds.length?<><button type="button" disabled={busy} onClick={()=>start(async()=>{try{const next=await failedSmsApplicants(jobIds);if(!next.length){setMessage('재선택할 수 있는 실패 대상이 없습니다. 최신 이력을 확인해주세요.');return;}setRows(next);setOpen(true);dialog.current?.showModal();setMessage('');}catch{setMessage('실패 대상을 조회하지 못했습니다. 다시 확인해주세요.');}})}>{busy?'대상 확인 중…':`현재 조회된 실패 ${jobIds.length}건만 문자 준비`}</button><p role="status">{message}</p><dialog ref={dialog} className="applicant-detail-dialog bulk-sms-dialog" aria-label="실패 대상 문자 준비" onCancel={e=>{if(locked)e.preventDefault();else setOpen(false);}}><header><div><h2>실패 대상 문자 준비</h2><p>최신 신청자 정보를 다시 조회했습니다. 새 문구·비용 확인 후 직접 발송하세요. 결과 미확인 건은 포함하지 않습니다.</p></div><button type="button" disabled={locked} onClick={()=>{dialog.current?.close();setOpen(false);}}>닫기</button></header>{open&&<ApplicantSmsComposer rows={rows} onLock={setLocked}/>}</dialog></>:null;
}
