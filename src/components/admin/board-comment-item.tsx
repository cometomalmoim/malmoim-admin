'use client';
import { useState, useTransition } from 'react';
import { mutateBoard } from '@/app/actions/board';
import type { BoardComment, BoardData } from '@/lib/board-model';
const date = (value: string) => new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Seoul' }).format(new Date(value));
export function BoardCommentItem({ comment, userId, onData, disabled }: { comment: BoardComment; userId: string; onData: (data: BoardData) => void; disabled: boolean }) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [body, setBody] = useState(comment.body);
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();
  function run(kind: 'comment_edit' | 'comment_delete') {
    startTransition(async () => {
      const form = new FormData(); form.set('id', comment.id); form.set('updated_at', comment.updated_at); form.set('body', body);
      try {
        const result = await mutateBoard(kind, form);
        setMessage(result.message);
        if (result.success && result.data) { onData(result.data); setEditing(false); setDeleting(false); }
      } catch { setMessage('요청에 실패했습니다. 다시 시도해주세요.'); }
    });
  }
  return <article aria-busy={pending}><div className="board-comment-header"><small>{comment.author_name} · {date(comment.created_at)}</small>{comment.author_id === userId && !editing && <div><button disabled={pending || disabled} onClick={() => { setBody(comment.body); setEditing(true); setDeleting(false); }}>수정</button><button disabled={pending || disabled} onClick={() => setDeleting(!deleting)}>삭제</button></div>}</div>{editing ? <form onSubmit={e => { e.preventDefault(); run('comment_edit'); }}><label>댓글 수정<textarea required maxLength={5000} rows={3} value={body} disabled={pending || disabled} onChange={e => setBody(e.target.value)}/></label><div className="board-comment-actions"><button type="button" disabled={pending} onClick={() => setEditing(false)}>취소</button><button disabled={pending || disabled || !body.trim()}>저장</button></div></form> : <p>{comment.body}</p>}{deleting && <div className="board-comment-actions" role="alert">댓글을 삭제할까요?<button disabled={pending || disabled} onClick={() => run('comment_delete')}>삭제 확인</button><button disabled={pending} onClick={() => setDeleting(false)}>취소</button></div>}{message && <small role="status">{message}</small>}</article>;
}
