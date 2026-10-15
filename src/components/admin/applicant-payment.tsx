'use client';
import {startTransition,useActionState} from 'react';
import {recordApplicantPayment} from '@/app/actions/applicants';
import {paymentConfirmationTime} from '@/lib/applicant-validation';
import type {ApplicationRow} from '@/lib/recruitment';
const messages:Record<string,string>={saved:'실제 납부액을 저장했습니다.',invalid:'실제 납부액은 1원 이상의 정수로 입력해주세요.',conflict:'다른 변경이 있습니다. 최신 목록을 불러와 확인해주세요.',not_paid:'납부 완료 상태에서 실제 납부액을 기록해주세요.',payment_locked:'진행 중이거나 완료된 환불이 있어 납부액을 변경할 수 없습니다.',forbidden:'관리자 권한을 확인해주세요.',missing:'신청자를 찾을 수 없습니다.',error:'저장하지 못했습니다. 입력을 유지한 채 다시 시도해주세요.'};
export function ApplicantPayment({slug,row,locked}:{slug:string;row:ApplicationRow;locked:boolean}){
 const [state,action,pending]=useActionState(recordApplicantPayment.bind(null,slug),{code:''});
 return <section className="evt-form applicant-editor"><h3>실제 납부액</h3><p>{row.paid_amount_krw==null?'미확인':`${row.paid_amount_krw.toLocaleString('ko-KR')}원`}</p><p>금액 기록 관리자 ID: {row.paid_amount_recorded_by||'미기록'}<br/>기록 일시: {paymentConfirmationTime(row.paid_amount_recorded_at)}</p>
 <p>실제 입금 내역을 확인한 금액만 기록하세요. 이벤트 참가비에서 자동으로 채우지 않습니다. 전액 1회 환불만 지원합니다.</p>
 {row.payment_status==='paid'&&!locked?<form onSubmit={event=>{event.preventDefault();const data=new FormData(event.currentTarget);startTransition(()=>action(data));}}>
 <input type="hidden" name="source" value={row.source}/><input type="hidden" name="application_id" value={row.id}/><input type="hidden" name="revision" value={row.revision}/>
 <fieldset disabled={pending}><legend>실제 입금액 기록·정정</legend><label>실제 납부액 (원)<input key={row.revision} name="paid_amount_krw" type="number" min={1} max={2147483647} step={1} required defaultValue={row.paid_amount_krw??''}/></label><button type="submit">실제 납부액 저장</button></fieldset></form>:<p>납부 완료 상태에서 기록할 수 있으며 진행 중·완료된 환불이 있으면 정정할 수 없습니다.</p>}
 <p role="status" aria-live="polite">{messages[state.code]??''}</p></section>;
}
