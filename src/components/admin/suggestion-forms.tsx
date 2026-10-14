'use client';

import { useActionState, useState } from 'react';
import {
  createSuggestionAction,
  saveSuggestionFeedbackAction,
  saveSuggestionResolutionAction,
  saveSuggestionStatusAction,
  type SuggestionActionState,
} from '@/app/actions/suggestions';

const initialState: SuggestionActionState = { message: '' };
function FormMessage({ state }: { state: SuggestionActionState }) {
  return state.message ? <p className={`sg-form-message${state.success ? ' is-success' : ''}`} role={state.success ? 'status' : 'alert'}>{state.message}</p> : null;
}

export function SuggestionCreateForm() {
  const [mode, setMode] = useState<'anonymous' | 'named'>('anonymous');
  const [state, action, pending] = useActionState(createSuggestionAction, initialState);
  return <form action={action} className="sg-form sg-create-form">
    <div className="sg-form-heading"><div><span className="ops-tag">운영진 전용</span><h2>새 건의 작성</h2></div><p>작성한 건의는 모든 관리자에게 공유됩니다.</p></div>
    <label className="sg-field">제목<input name="title" required maxLength={150} placeholder="건의 제목을 입력하세요" /></label>
    <label className="sg-field">내용<textarea name="content" required maxLength={10000} rows={5} placeholder="건의 내용을 입력하세요" /></label>
    <fieldset className="sg-identity"><legend>작성자 표시</legend>
      <label><input type="radio" name="mode" value="anonymous" checked={mode === 'anonymous'} onChange={() => setMode('anonymous')} /> 익명</label>
      <label><input type="radio" name="mode" value="named" checked={mode === 'named'} onChange={() => setMode('named')} /> 실명 공개</label>
    </fieldset>
    {mode === 'named' && <label className="sg-field">공개 이름<input name="public_name" required maxLength={100} placeholder="표시할 이름" /></label>}
    <FormMessage state={state} />
    <button className="sg-primary" type="submit" disabled={pending}>{pending ? '등록 중…' : '건의 등록'}</button>
  </form>;
}

export function SuggestionFeedbackForm({ id, value }: { id: string; value: string }) {
  const actionWithId = saveSuggestionFeedbackAction.bind(null, id);
  const [state, action, pending] = useActionState(actionWithId, initialState);
  return <form action={action} className="sg-form"><label className="sg-field" htmlFor="sg-feedback">운영진 피드백</label><textarea id="sg-feedback" name="staff_feedback" maxLength={10000} rows={5} defaultValue={value} placeholder="검토 의견이나 작성자에게 남길 피드백" /><p className="ops-muted">저장해도 처리 상태는 바뀌지 않습니다.</p><FormMessage state={state} /><button className="sg-secondary" type="submit" disabled={pending}>{pending ? '저장 중…' : '피드백 저장'}</button></form>;
}

export function SuggestionResolutionForm({ id, value }: { id: string; value: string }) {
  const actionWithId = saveSuggestionResolutionAction.bind(null, id);
  const [state, action, pending] = useActionState(actionWithId, initialState);
  return <form action={action} className="sg-form"><label className="sg-field" htmlFor="sg-resolution">실제 처리 결과</label><textarea id="sg-resolution" name="resolution" maxLength={10000} rows={5} defaultValue={value} placeholder="실제로 조치한 내용과 결과를 기록하세요" /><p className="ops-muted">결과 저장만으로 처리 완료가 되지 않습니다. 완료 상태로 바꾸려면 결과를 먼저 기록해야 합니다.</p><FormMessage state={state} /><button className="sg-secondary" type="submit" disabled={pending}>{pending ? '저장 중…' : '처리 결과 저장'}</button></form>;
}

export function SuggestionStatusForm({ id, status }: { id: string; status: string }) {
  const actionWithId = saveSuggestionStatusAction.bind(null, id);
  const [state, action, pending] = useActionState(actionWithId, initialState);
  return <form action={action} className="sg-status-form"><label htmlFor="sg-status">현재 상태</label><select id="sg-status" name="status" defaultValue={status}><option value="received">접수</option><option value="reviewing">검토 중</option><option value="completed">처리 완료</option></select><button className="sg-primary" type="submit" disabled={pending}>{pending ? '변경 중…' : '상태 변경'}</button><FormMessage state={state} /></form>;
}
