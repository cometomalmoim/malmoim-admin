 'use client';
import {startTransition,useActionState} from 'react';
import {saveApplicant} from '@/app/actions/applicants';
import {applicationStatuses,paymentStatuses,paymentConfirmationTime} from '@/lib/applicant-validation';
import type {ApplicationRow} from '@/lib/recruitment';
export function ApplicantEditor({slug,row}:{slug:string;row?:ApplicationRow}){
 const [state,action,pending]=useActionState(saveApplicant.bind(null,slug),{code:''});
 const messages:Record<string,string>={saved:'저장했습니다.',invalid:'필수 항목과 입력 형식을 확인해주세요.',duplicate:'이 이벤트에 같은 연락처가 있습니다. 기존 신청자를 확인해주세요.',conflict:'다른 운영진이 먼저 수정했습니다. 새로고침하여 최신 내용을 확인한 뒤 다시 수정해주세요.',missing:'이벤트 또는 신청자를 찾을 수 없습니다.',forbidden:'관리자 권한을 확인해주세요.',error:'저장하지 못했습니다. 환불 상태 전환은 환불 관리에서 처리해주세요. 입력을 유지한 채 다시 시도해주세요.'};
 if(!row&&state.code==='saved')return <div role="status"><p>신청자를 추가했습니다.</p><a href={`/admin/events/${encodeURIComponent(slug)}/applicants`}>목록 새로고침·추가 등록</a></div>;
 return <form className="evt-form applicant-editor" aria-label={row?`신청자 수정 ${row.name}`:'신청자 추가'} onSubmit={event=>{event.preventDefault();const data=new FormData(event.currentTarget);startTransition(()=>action(data));}}>
 <input type="hidden" name="id" value={row?.id??''}/><input type="hidden" name="source" value={row?.source??'manual'}/><input type="hidden" name="revision" value={row?.revision??0}/>
 <fieldset disabled={pending}><legend>{row?'신청자 상세·수정':'신청자 직접 추가'}</legend><div className="evt-fields">
 <label>이름<input name="name" defaultValue={row?.name} maxLength={100} required/></label>
 <label>연락처 유형<select name="contact_type" defaultValue={row?.contact_type??'phone'}><option value="phone">전화번호</option>{row?.source!=='registration'&&<option value="instagram">인스타그램</option>}</select></label>
 <label>연락처<input name="contact" defaultValue={row?.contact} maxLength={200} required/></label>
 <label>출생연도<input name="birth_year" type="number" min={1900} max={new Date().getUTCFullYear()} defaultValue={row?.birth_year??''} placeholder="예: 1998"/><small>출생연도만 기록합니다. 미확인 시 비워두세요.</small></label>
 <label>국적<input name="nationality" defaultValue={row?.nationality??''} maxLength={100} placeholder="미확인 시 비워두세요"/></label>
 <label>선발 상태<select name="status" defaultValue={row?.status??'received'}>{Object.entries(applicationStatuses).map(([v,label])=><option value={v} key={v}>{label}</option>)}</select></label>
 <label>입금 확인<select key={row?.payment_status??'unknown'} name="payment_status" defaultValue={row?.payment_status??'unknown'}>{Object.entries(paymentStatuses).map(([v,label])=><option value={v} key={v} disabled={row?.payment_status==='refunded'?v!=='refunded':v==='refunded'}>{label}</option>)}</select><small>운영진 수동 기록이며 결제·환불을 실행하지 않습니다. 납부 완료로 변경하면 확인 담당자와 시각을 기록합니다. 다른 상태로 변경하면 현재 확인 기록은 비우며 변경 이력은 보존합니다. 환불 상태 진입·해제는 일반 수정에서 할 수 없습니다.</small></label>
 </div>{row&&<div><p>확인 담당자 ID: {row.payment_confirmed_by||'미기록'}</p><p>확인 일시: {paymentConfirmationTime(row.payment_confirmed_at)}</p></div>}{row&&<p>기존 응답: {row.participation_history==='new'?'첫 참여':row.participation_history==='returning'?'기존 참여':row.preferred_class==='thursday'?'목요일반':row.preferred_class==='saturday'?'토요일반':'미입력'} {row.history_detail??''}</p>}
 {(!row||row.source==='manual')&&<label>접수 경위·동의 확인 근거<textarea name="source_note" required maxLength={1000} defaultValue={row?.source_note??''} placeholder="예: 전화 접수 / 본인 제공 정보 및 행사 운영 목적 이용 동의 확인"/><small>실제 확인한 경위만 기록하세요. 마케팅 동의를 대신 만들지 않습니다.</small></label>}
 <label>운영진 내부 메모<textarea name="internal_note" defaultValue={row?.internal_note??''} maxLength={3000} rows={3}/></label>
 <button className="evt-primary" type="submit">{pending?'저장 중…':row?'변경사항 저장':'신청자 추가'}</button></fieldset>
 <p role="status" aria-live="polite">{messages[state.code]??''}</p>{state.code==='conflict'&&<a href={`/admin/events/${encodeURIComponent(slug)}/applicants`}>최신 목록 불러오기</a>}
 </form>;
}
