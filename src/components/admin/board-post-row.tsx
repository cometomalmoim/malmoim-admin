'use client';
import { pinned, type BoardPost } from '@/lib/board-model';
export function BoardPostRow({ post, count, selected, disabled, onSelect }: { post: BoardPost; count: number; selected: boolean; disabled: boolean; onSelect: () => void }) {
  const created = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Seoul' }).format(new Date(post.created_at));
  return <button disabled={disabled} aria-pressed={selected} className={`board-row${pinned(post) ? ' pinned bg-amber-50' : ''}${selected ? ' selected' : ''}`} onClick={onSelect}>
    <span className="board-row-copy"><span className="board-row-title"><span className={`board-badge${post.category === '공지' ? ' notice' : ''}`}>{post.category}</span>{pinned(post) && <span className="board-row-pin" aria-label="상단 고정">📌</span>}<strong title={post.title}>{post.title}</strong></span><small title={`${post.author_name} · ${created}`}>{post.author_name} · {created}</small></span>
    <span className={`board-comment-count${count > 0 ? ' has-comments' : ''}`} aria-label={`댓글 ${count}개`}>💬 {count}</span>
  </button>;
}
