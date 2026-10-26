'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import type {ApplicationRow} from '@/lib/recruitment';
import {applicationStatuses,paymentStatuses} from '@/lib/applicant-validation';
import {applyApplicantStatuses} from '@/lib/applicant-bulk-status';
import {saveApplicant} from '@/app/actions/applicants';
export function ApplicantBulkStatus({rows,disabled,onBusy}:{rows:ApplicationRow[];disabled:boolean;onBusy:(busy:boolean)=>void}){
 const [field,setField]=useState<'status'|'payment_status'>('status'),[value,setValue]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const [failures,setFailures]=useState<string[]>([]);const router=useRouter();
 const options:Record<string,string>=field==='status'?applicationStatuses:paymentStatuses;
 const targets=rows.filter(row=>row[field]!==value);
 async function apply(){
  if(!value||!targets.length||disabled||busy||rows.length>50)return;
  setBusy(true);onBusy(true);setMessage('');setFailures([]);
  try{
   const results=await applyApplicantStatuses(rows,field,value,saveApplicant);
   const failed=results.filter(item=>!['saved','unchanged'].includes(item.code));
   setMessage(`변경 ${results.filter(item=>item.code==='saved').length}명 · 기존 상태 동일 ${results.filter(item=>item.code==='unchanged').length}명 · 실패 ${failed.length}명${field==='payment_status'?' · 문자 자동 발송 없이 상태만 저장했습니다.':''}`);
   setFailures(failed.map(item=>`${item.row.name}: ${item.code==='conflict'?'다른 운영진의 수정으로 저장하지 않았습니다.':item.code==='duplicate'?'동일 연락처 신청을 확인해주세요.':'저장하지 못했습니다.'}`));
   router.refresh();
  }catch{setMessage('변경하지 못했습니다. 최신 목록을 확인해주세요.');}
  finally{setBusy(false);onBusy(false);}
 }
 return <section className="applicant-bulk-status" aria-label="선택 신청자 일괄 상태 변경"><strong>선택 {rows.length}명 상태 변경</strong><label>변경 항목<select disabled={disabled||busy} value={field} onChange={e=>{setField(e.target.value as typeof field);setValue('');setMessage('');setFailures([]);}}><option value="status">선발 상태</option><option value="payment_status">입금 상태</option></select></label><label>변경할 상태<select disabled={disabled||busy} value={value} onChange={e=>{setValue(e.target.value);setMessage('');setFailures([]);}}><option value="">상태 선택</option>{Object.entries(options).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><button type="button" className="evt-primary" disabled={disabled||busy||!value||!targets.length||rows.length>50} onClick={()=>void apply()}>{busy?'저장 중…':value?`${targets.length}명 → ${options[value]} 적용`:'선택 상태 적용'}</button>{rows.length>50&&<span role="alert">한 번에 50명까지 변경할 수 있습니다.</span>}{field==='payment_status'&&<small>운영진의 수동 확인 상태입니다. 실제 입금·환불 처리나 문자 발송은 실행하지 않습니다.</small>}{message&&<p role="status">{message}</p>}{failures.length>0&&<ul role="alert">{failures.map((item,index)=><li key={index}>{item}</li>)}</ul>}</section>;
}
