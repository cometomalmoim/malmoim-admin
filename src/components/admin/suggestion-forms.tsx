'use client';

import { useActionState, useState } from 'react';
import {
  createSuggestionAction,
  deleteSuggestionAction,
  saveSuggestionDetailsAction,
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
    <div className="sg-form-heading"><div><span className="ops-tag">운영진 전용</span><h2>새 건의 작성</h2></div><p>공유 관리자 계정으로 등록합니다. 작성자 본인 확인은 하지 않으며, 모든 관리자에게 공유됩니다.</p></div>
    <label className="sg-field">제목<input name="title" required maxLength={150} placeholder="건의 제목을 입력하세요" /></label>
    <label className="sg-field">내용<textarea name="content" required maxLength={10000} rows={5} placeholder="건의 내용을 입력하세요" /></label>
    <fieldset className="sg-identity"><legend>작성자 표시 방식</legend>
      <label><input type="radio" name="mode" value="anonymous" checked={mode === 'anonymous'} onChange={() => setMode('anonymous')} /> 익명으로 표시</label>
      <label><input type="radio" name="mode" value="named" checked={mode === 'named'} onChange={() => setMode('named')} /> 내 이름을 직접 입력해 공개</label>
    </fieldset>
    {mode === 'named' ? <label className="sg-field">공개할 이름<input name="public_name" required maxLength={100} placeholder="공개할 이름을 직접 입력하세요" /></label> : <p className="ops-muted">익명을 선택하면 이름이나 관리자 계정 정보는 건의 내용과 연결해 저장하지 않습니다.</p>}
    {mode === 'named' && <p className="ops-muted">입력한 이름은 계정 정보와 대조하지 않습니다.</p>}
    <FormMessage state={state} />
    <button className="sg-primary" type="submit" disabled={pending}>{pending ? '등록 중…' : '건의 등록'}</button>
  </form>;
}

export function SuggestionEditForm({ id, title, content }: { id: string; title: string; content: string }) {
  const [editing, setEditing] = useState(false);
  const actionWithId = saveSuggestionDetailsAction.bind(null, id);
  const [state, action, pending] = useActionState(actionWithId, initialState);
  return <div className="sg-edit-control">
    <button className="sg-secondary" type="button" aria-expanded={editing} onClick={() => setEditing(value => !value)}>{editing ? '수정 취소' : '건의 수정'}</button>
    {editing && <form action={action} className="sg-form sg-edit-form">
      <label className="sg-field">제목<input name="title" required maxLength={150} defaultValue={title} /></label>
      <label className="sg-field">내용<textarea name="content" required maxLength={10000} rows={5} defaultValue={content} /></label>
      <FormMessage state={state} />
      <button className="sg-primary" type="submit" disabled={pending}>{pending ? '저장 중…' : '수정 내용 저장'}</button>
    </form>}
  </div>;
}

export function SuggestionDeleteForm({ id }: { id: string }) {
  const actionWithId = deleteSuggestionAction.bind(null, id);
  const [state, action, pending] = useActionState(actionWithId, initialState);
  return <form action={action} className="sg-delete-form" onSubmit={event => {
    if (!window.confirm('이 건의를 삭제할까요? 삭제하면 목록과 통계에서 제외되며 복구할 수 없습니다.')) event.preventDefault();
  }}>
    <button className="sg-danger" type="submit" disabled={pending}>{pending ? '삭제 중…' : '건의 삭제'}</button>
    <FormMessage state={state} />
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
