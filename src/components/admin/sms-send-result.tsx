"use client";
import {useState} from 'react';
import {smsBatchOutcomes} from '@/app/actions/event-sms';
import {useSmsDelivery} from './use-sms-delivery';
import {smsStates} from '@/lib/sms-contract';
import {smsResultSummary,type SmsOutcome} from '@/lib/sms-result';
import {EventSmsLogs} from './event-sms-logs';
export function SmsSendResult({rows,event,batches,busy,note,onDone,inDialog=false,excluded=[]}:{rows:SmsOutcome[];event:string;batches:string[];busy:boolean;note:string;inDialog?:boolean;excluded?:{name:string;reason:string}[];onDone?:()=>void}){
 const [history,setHistory]=useState(false);const [updated,setCurrent]=useState<SmsOutcome[]>([]);
 const current=rows.map(row=>row.state==='accepted'?(updated.find(item=>item.id===row.id)??row):row);
 useSmsDelivery(current,async()=>{setCurrent(await smsBatchOutcomes(batches));},!busy);
 const total=smsResultSummary(current);
 return <section className="sms-send-result" aria-label="문자 발송 결과"><div className="sms-result-heading" role="status"><strong>{busy?'발송 요청 처리 중':total.failed||total.waiting?'처리 결과를 확인해주세요':'발송 요청을 처리했습니다'}</strong><p>{busy?'이 창에서 다시 발송하지 마세요.':`발송 완료 ${total.completed}명 · 확인 중 ${total.waiting}명 · 실패·취소 ${total.failed}명${excluded.length?` · 제외 ${excluded.length}명`:``}`}</p></div>{!busy&&total.waiting>0&&<p className="bulk-sms-help">확인 중인 문자는 기록에서 결과를 확인해주세요. 자동으로 재발송하지 않습니다.</p>}<div className="sms-result-records">{current.map(row=><details key={row.batch_id} open={current.length===1}><summary><strong>{row.name}</strong><span>{row.to}</span><span className={`sms-state sms-state-${row.state}`}>{busy?'처리 중':smsStates[row.state]??'결과 확인 필요'}</span></summary><pre>{row.body}</pre>{row.reason&&<p className="bulk-sms-error">{row.reason}</p>}</details>)}</div>{excluded.length>0&&<div className="sms-result-excluded">{excluded.map((item,index)=><p key={index}>{item.name} · 발송 제외: {item.reason}</p>)}</div>}{note&&<p className="bulk-sms-help" role="status">{note}</p>}<div className="sms-result-footer"><button type="button" disabled={busy} onClick={()=>setHistory(value=>!value)}>{history?'문자 이력 접기':'문자 이력 보기'}</button><button type="button" className="evt-primary" disabled={busy} onClick={onDone} hidden={inDialog}>새 문자 작성</button></div>{history&&<EventSmsLogs event={event} batches={batches} compact/>}</section>;
}
