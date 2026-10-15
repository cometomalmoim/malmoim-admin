'use client';
import {useActionState,useState} from 'react';
import {requestRefund,updateRefund} from '@/app/actions/refunds';
import {refundStatuses,fullRefundAllowed,type RefundRow} from '@/lib/refund-validation';
import {paymentConfirmationTime} from '@/lib/applicant-validation';
const messages:Record<string,string>={saved:'저장했습니다.',invalid:'사유·요청일·금액과 외부 송금 완료 확인을 점검해주세요.',forbidden:'관리자 권한을 확인해주세요.',missing:'이벤트 또는 신청자·환불 기록을 찾을 수 없습니다.',not_paid:'납부 완료 신청자만 환불 요청을 등록할 수 있습니다.',duplicate:'진행 중이거나 완료된 환불 기록이 있습니다.',invalid_transition:'이미 처리되었거나 변경할 수 없는 상태입니다. 최신 목록을 확인해주세요.',payment_state_conflict:'현재 납부 상태가 변경되었습니다. 최신 목록을 확인해주세요.',payment_amount_unknown:'실제 납부액이 미확인입니다. 입금액을 먼저 기록해주세요.',amount_mismatch:'기록된 실제 납부액과 동일한 전액만 환불할 수 있습니다.',error:'저장하지 못했습니다. 입력을 유지한 채 다시 시도해주세요.'};
function RefundRecord({slug,row,actualPaidAmount}:{slug:string;row:RefundRow;actualPaidAmount:number|null}){
 const [state,action,pending]=useActionState(updateRefund.bind(null,slug),{code:''});
 const [completion,setCompletion]=useState({amount:'',confirmed:false});
 return <article><h4>{refundStatuses[row.status]}</h4><p style={{whiteSpace:'pre-wrap'}}>사유: {row.reason}</p>
 <p>요청일: {paymentConfirmationTime(row.requested_at)}</p><p>등록 관리자 ID: {row.created_by}</p>
 <p>승인·거절 담당자 ID: {row.decision_by||'미기록'}<br/>승인·거절 일시: {paymentConfirmationTime(row.decision_at)}</p>
 <p>환불 처리 금액: {row.processed_amount_krw===null?'미기록':`${row.processed_amount_krw.toLocaleString('ko-KR')}원`}<br/>처리 담당자 ID: {row.processed_by||'미기록'}<br/>처리일: {paymentConfirmationTime(row.processed_at)}</p>
 {(row.status==='requested'||row.status==='approved')&&<form action={action} className="evt-form"><input type="hidden" name="refund_id" value={row.id}/><fieldset disabled={pending||state.code==='saved'}><legend>환불 기록 상태 변경</legend>
 {row.status==='requested'?<><button type="submit" name="refund_action" value="approve">승인</button> <button type="submit" name="refund_action" value="reject">거절</button></>:<><input type="hidden" name="refund_action" value="process"/><label>실제 환불 처리 금액 (원)<input name="processed_amount_krw" type="number" required min={1} max={2147483647} step={1} value={completion.amount} onChange={event=>setCompletion(previous=>({...previous,amount:event.target.value}))}/></label><label><input type="checkbox" name="transfer_confirmed" required checked={completion.confirmed} onChange={event=>setCompletion(previous=>({...previous,confirmed:event.target.checked}))}/>외부에서 송금을 완료했음을 확인했습니다.</label><p>확인된 실제 납부액: {actualPaidAmount==null?'미확인':`${actualPaidAmount.toLocaleString('ko-KR')}원`} · 동일한 전액만 기록할 수 있습니다.</p><button type="submit" disabled={!fullRefundAllowed(actualPaidAmount,Number(completion.amount))}>환불 처리 완료 기록</button></>}
 </fieldset></form>}<p role="status" aria-live="polite">{messages[state.code]??''}</p></article>;
}
export function ApplicantRefunds({slug,applicationId,source,paymentStatus,actualPaidAmount,rows,error=false}:{slug:string;applicationId:string;source:string;paymentStatus:string;actualPaidAmount:number|null;rows:RefundRow[];error?:boolean}){
 const [state,action,pending]=useActionState(requestRefund.bind(null,slug),{code:''});
 const [draft,setDraft]=useState({reason:'',requested_at:''});
 const active=rows.some(row=>row.status!=='rejected');
 return <section className="evt-form applicant-editor" aria-label="신청자 환불 기록"><h3>환불 기록 관리</h3><p>실제 송금 기능은 없습니다. 외부 송금 완료를 확인한 뒤 처리 완료를 수동 기록하세요. 모든 일시는 한국시간(KST)입니다.</p>
 {error?<p role="alert">환불 기록을 불러오지 못했습니다. 연결·권한 및 환불 SQL 적용 여부를 확인해주세요.</p>:<>
 {rows.length?rows.map(row=><RefundRecord actualPaidAmount={actualPaidAmount} key={`${row.id}-${row.status}`} slug={slug} row={row}/>):<p>환불 기록이 없습니다.{paymentStatus==='refunded'?' 기존 환불 상태의 상세 기록은 임의로 생성하지 않습니다.':''}</p>}
 {paymentStatus==='paid'&&Number(actualPaidAmount)>0&&!active?<form action={action}><fieldset disabled={pending}><legend>환불 요청 등록</legend><input type="hidden" name="application_id" value={applicationId}/><input type="hidden" name="source" value={source}/><label>환불 사유<textarea name="reason" required maxLength={2000} value={draft.reason} onChange={event=>setDraft(previous=>({...previous,reason:event.target.value}))}/></label><label>요청일 (KST)<input type="datetime-local" name="requested_at" required value={draft.requested_at} onChange={event=>setDraft(previous=>({...previous,requested_at:event.target.value}))}/></label><button type="submit">환불 요청 기록</button></fieldset></form>:<p>실제 납부액이 확인된 납부 완료 신청자만 요청할 수 있습니다. 진행 중·완료된 환불이 있으면 추가 요청할 수 없습니다.</p>}
 </>}<p role="status" aria-live="polite">{messages[state.code]??''}</p></section>;
}
