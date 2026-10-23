'use client';
import { useActionState, useState } from 'react';
import { replyInquiry } from '@/app/actions/inquiries';
export function InquiryReplyForm({ id, revision }: { id: string; revision: number }) {
 const [state, action, busy] = useActionState(async (previous: { code: string }, form: FormData) => {
  const result = await replyInquiry(previous, form);
  if (result.code === 'saved') window.dispatchEvent(new Event('inquiry-replied'));
  return result;
 }, { code: '' });
 const [body, setBody] = useState('');
 return <form action={action} className="inbox-reply-form"><input type="hidden" name="id" value={id}/><input type="hidden" name="revision" value={revision}/><label>신청자에게 보여줄 답변<textarea required maxLength={3000} rows={4} name="body" value={body} onChange={e => setBody(e.target.value)}/></label><p>저장하면 전용 링크에 바로 표시됩니다. 기존 답변은 보존되며 추가 답변으로 기록됩니다. 문자는 자동 발송되지 않습니다.</p><button disabled={busy || state.code === 'saved'}>{busy ? '저장 중…' : state.code === 'saved' ? '답변 저장 완료' : '답변 저장'}</button>{state.code && <p role="status">{state.code === 'saved' ? '답변이 저장되었습니다. 전용 링크에서 확인할 수 있습니다.' : state.code === 'stale' ? '다른 운영진이 먼저 답변했습니다. 새로고침 후 최신 내용을 확인해주세요.' : '저장하지 못했습니다. 입력은 유지됩니다. 권한·연결 상태를 확인하고 다시 시도해주세요.'}</p>}</form>;
}
export function InquiryReplyLink({ href }: { href: string }) {
 const [copied, setCopied] = useState(false);
 return <><a href={href} target="_blank" rel="noreferrer">전용 답변 링크 열기 ↗</a><button type="button" onClick={async () => { try { await navigator.clipboard.writeText(href); setCopied(true); } catch { setCopied(false); } }}>{copied ? '링크 복사됨' : '전용 링크 복사'}</button></>;
}
