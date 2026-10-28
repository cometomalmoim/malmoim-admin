"use client";
import {useRef,useState} from 'react';
import type {ApplicationRow} from '@/lib/recruitment';
import {smsStates} from '@/lib/sms-contract';
import {EventSmsLogs} from './event-sms-logs';
import './messaging.css';
import './applicant-bulk-sms.css';
export function ApplicantSms({row,disabled=false}:{row:ApplicationRow;disabled?:boolean}){
 const dialog=useRef<HTMLDialogElement>(null),[open,setOpen]=useState(false);
 return <><button type="button" className="applicant-cell-button" disabled={disabled} onClick={()=>{setOpen(true);dialog.current?.showModal();}}>{row.sms_state?(smsStates[row.sms_state]??row.sms_state):'이력 없음'}</button>{row.sms_notices?.map(notice=><small key={notice.title} className="applicant-sms-notice" title={notice.at}>{notice.title} 발송 완료{notice.state==='accepted'?' · 도달 확인 중':''}</small>)}{row.sms_updated_at&&<small>{new Intl.DateTimeFormat('ko-KR',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Seoul'}).format(new Date(row.sms_updated_at))}</small>}<dialog ref={dialog} className="applicant-detail-dialog bulk-sms-dialog messaging" aria-label={`${row.name} 문자 이력`} onClose={()=>setOpen(false)}><header><div><h2>{row.name} · 최근 문자</h2><p>개별 발송은 목록에서 한 명을 체크해 선택 문자 발송을 이용하세요.</p></div><button type="button" onClick={()=>dialog.current?.close()}>닫기</button></header>{open&&<EventSmsLogs event={row.event_id} source={row.source} id={row.id}/>}</dialog></>;
}
