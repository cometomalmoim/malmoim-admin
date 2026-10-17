'use client';
/* eslint-disable @next/next/no-img-element -- Authenticated private image endpoint. */
import { useState, useTransition } from 'react';
import { mutateBoard } from '@/app/actions/board';
import { BoardImageInput } from './board-image-input';
import { BoardPostRow } from './board-post-row';
import { BoardCommentItem } from './board-comment-item';
import { boardImageUrl } from '@/lib/board-images';
import { boardCategories, filterPosts, pinned, type BoardData, type BoardPost } from '@/lib/board-model';
import { BoardFilterPanel } from './board-filter-panel';
import type { BoardFilters } from '@/lib/board-model';
import './board.css';
const date = (value: string) => new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Seoul' }).format(new Date(value));
function Badge({ category }: { category: string }) { return <span className={`board-badge${category === '공지' ? ' notice' : ''}`}>{category}</span>; }
function PostForm({ post, pending, save, cancel }: { post?: BoardPost; pending: boolean; save: (form: FormData) => void; cancel: () => void }) {
  const [category, setCategory] = useState(post?.category ?? '자유');
  const [pin, setPin] = useState(post?.is_pinned ?? false);
  return <form onSubmit={e => { e.preventDefault(); save(new FormData(e.currentTarget)); }}><div className="board-actions"><h2>{post ? '게시글 수정' : '새 게시글'}</h2><button type="button" disabled={pending} onClick={cancel}>취소</button><button className="board-primary" disabled={pending}>저장</button></div>{post && <><input type="hidden" name="id" value={post.id}/><input type="hidden" name="updated_at" value={post.updated_at}/></>}<fieldset disabled={pending}><label>카테고리<select name="category" value={category} onChange={e => { setCategory(e.target.value); if (e.target.value !== '공지') setPin(false); }}>{boardCategories.map(c => <option key={c}>{c}</option>)}</select></label>{category === '공지' && <label className="board-check"><input type="checkbox" name="is_pinned" checked={pin} onChange={e => setPin(e.target.checked)}/>📌 상단 고정 (Is Pinned)</label>}<label>제목<input name="title" required maxLength={200} defaultValue={post?.title}/></label><label>본문<textarea name="body" required maxLength={20000} rows={14} defaultValue={post?.body}/></label><BoardImageInput images={post?.images}/></fieldset></form>;
}
export function BoardWorkspace({ initial }: { initial: BoardData }) {
  const [data, setData] = useState(initial);
  const [selected, setSelected] = useState<string | null>(null);
  const [mode, setMode] = useState<'read' | 'new' | 'edit'>('read');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState(false);
  const [category, setCategory] = useState('');
  const [onlyPinned, setOnlyPinned] = useState(false);
  const [extra, setExtra] = useState<BoardFilters>({});
  const [message, setMessage] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [comment, setComment] = useState('');
  const [pending, startTransition] = useTransition();
  const post = data.posts.find(p => p.id === selected);
  const own = post?.author_id === data.userId;
  const visible = filterPosts(data.posts, search, category, onlyPinned, extra);
  function run(kind: 'save' | 'delete' | 'pin' | 'comment', form: FormData) {
    startTransition(async () => {
      try {
        const result = await mutateBoard(kind, form);
        setMessage(result.message);
        if (!result.success) return;
        if (result.data) setData(result.data);
        else { setMessage('저장했지만 목록을 불러오지 못했습니다. 새로고침해주세요.'); return; }
        setMode('read'); setDeleting(false);
        if (kind === 'delete') setSelected(null);
        else setSelected(result.id ?? null);
        if (kind === 'comment') setComment('');
      } catch { setMessage('요청에 실패했습니다. 다시 시도해주세요.'); }
    });
  }
  const commentCounts = new Map<string, number>();
  for (const c of data.comments) commentCounts.set(c.post_id, (commentCounts.get(c.post_id) ?? 0) + 1);
  function postData() { const form = new FormData(); form.set('id', post!.id); form.set('updated_at', post!.updated_at); return form; }
  return <div className="board"><p role="status" aria-live="polite">{message}</p><div className="board-split"><section className="board-list" aria-label="게시글 목록"><div className="board-toolbar"><h2>게시글</h2><input type="search" aria-label="게시글 검색" placeholder="제목, 본문, 작성자 검색" value={search} onChange={e => setSearch(e.target.value)}/><button aria-expanded={filters} aria-controls="board-filters" onClick={() => setFilters(!filters)}>필터 ⚙️{category || onlyPinned || extra.start || extra.end || extra.authorId || extra.authorSearch?.trim() ? ' · 적용 중' : ''}</button><button className="board-primary" disabled={pending} onClick={() => { setMode('new'); setSelected(null); setDeleting(false); }}>+ 새 게시글</button></div>{filters && <BoardFilterPanel userId={data.userId} category={category} setCategory={setCategory} onlyPinned={onlyPinned} setOnlyPinned={setOnlyPinned} value={extra} onChange={setExtra} reset={() => { setCategory(''); setOnlyPinned(false); setSearch(''); setExtra({}); }}/>}<p className="board-count" aria-live="polite">{visible.length}개의 게시글</p><div className="board-rows">{visible.map(p => <BoardPostRow key={p.id} post={p} count={commentCounts.get(p.id) ?? 0} selected={selected === p.id} disabled={pending} onSelect={() => { setSelected(p.id); setMode('read'); setDeleting(false); setComment(''); setMessage(''); }}/>)}</div>{!visible.length && <div className="board-empty">조건에 맞는 게시글이 없습니다.</div>}</section><section className="board-detail rounded-2xl" aria-label="게시글 상세" aria-busy={pending}>{mode === 'new' || (mode === 'edit' && post && own) ? <PostForm key={mode === 'new' ? 'new' : post!.id} post={mode === 'edit' ? post : undefined} pending={pending} save={form => run('save', form)} cancel={() => setMode('read')}/> : post ? <><div className="board-actions"><Badge category={post.category}/>{own && <><button disabled={pending} onClick={() => setMode('edit')}>✏️ 수정</button><button disabled={pending} onClick={() => setDeleting(!deleting)}>🗑️ 삭제</button></>}</div>{deleting && own && <div className="board-delete" role="alert">게시글과 댓글을 삭제할까요? <button disabled={pending} onClick={() => run('delete', postData())}>삭제 확인</button><button disabled={pending} onClick={() => setDeleting(false)}>취소</button></div>}<h2>{pinned(post) && '📌 '}{post.title}</h2><p className="board-meta">{post.author_name} · {date(post.created_at)}</p>{own && post.category === '공지' && <label className="board-check"><input type="checkbox" checked={post.is_pinned} disabled={pending} onChange={e => { const form = postData(); if (e.target.checked) form.set('is_pinned', 'on'); run('pin', form); }}/>📌 상단 고정 (Is Pinned)</label>}<div className="board-body">{post.body}</div><div className="board-post-images">{post.images?.map((path, index) => <a key={path} href={boardImageUrl(path)} target="_blank" rel="noreferrer"><img src={boardImageUrl(path)} alt={`게시글 첨부 이미지 ${index + 1}`}/></a>)}</div><section className="board-comments" aria-label="댓글"><h3>댓글 {data.comments.filter(c => c.post_id === post.id).length}</h3>{data.comments.filter(c => c.post_id === post.id).map(c => <BoardCommentItem key={c.id} comment={c} userId={data.userId} onData={setData} disabled={pending}/>)}<form onSubmit={e => { e.preventDefault(); const form = postData(); form.set('body', comment); run('comment', form); }}><label>댓글 작성<textarea value={comment} onChange={e => setComment(e.target.value)} required maxLength={5000} rows={3} disabled={pending}/></label><button className="board-primary" disabled={pending || !comment.trim()}>댓글 등록</button></form></section></> : <div className="board-empty"><span aria-hidden="true">☰</span><h2>게시글을 선택하세요</h2><p>공지와 이야기를 이곳에서 확인할 수 있습니다.</p></div>}</section></div></div>;
}
