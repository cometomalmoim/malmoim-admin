'use client';
import { useState } from 'react';
import { boardCategories, quickPeriod, type BoardFilters, type BoardPost } from '@/lib/board-model';
export function BoardFilterPanel({ posts, userId, category, setCategory, onlyPinned, setOnlyPinned, value, onChange, reset }: {
  posts: BoardPost[]; userId: string; category: string; setCategory: (value: string) => void;
  onlyPinned: boolean; setOnlyPinned: (value: boolean) => void; value: BoardFilters;
  onChange: (value: BoardFilters) => void; reset: () => void;
}) {
  const [authorSearch, setAuthorSearch] = useState('');
  const authors = [...new Map(posts.map(p => [p.author_id, p.author_name])).entries()].sort((a, b) => a[1].localeCompare(b[1], 'ko'));
  const invalid = !!(value.start && value.end && value.start > value.end);
  return <div id="board-filters" className="board-filters">
    <label>카테고리<select value={category} onChange={e => setCategory(e.target.value)}><option value="">전체</option>{boardCategories.map(c => <option key={c}>{c}</option>)}</select></label>
    <fieldset className="board-period"><legend>작성 기간</legend><div className="board-date-range"><label>시작일<input type="date" aria-invalid={invalid} aria-describedby={invalid ? 'board-date-error' : undefined} value={value.start ?? ''} max={value.end || undefined} onChange={e => onChange({ ...value, start: e.target.value })}/></label><span aria-hidden="true">~</span><label>종료일<input type="date" aria-invalid={invalid} aria-describedby={invalid ? 'board-date-error' : undefined} value={value.end ?? ''} min={value.start || undefined} onChange={e => onChange({ ...value, end: e.target.value })}/></label></div><div className="board-quick-period">{([['all', '전체'], ['week', '최근 1주일'], ['month', '최근 1달']] as const).map(([key, label]) => { const range = quickPeriod(key); return <button key={key} aria-pressed={(value.start || '') === range.start && (value.end || '') === range.end} onClick={() => onChange({ ...value, ...quickPeriod(key) })}>{label}</button>; })}</div>{invalid && <p id="board-date-error" role="alert">종료일은 시작일 이후로 선택해주세요.</p>}</fieldset>
    <div className="board-author"><label>작성자 검색<input type="search" placeholder="작성자 이름 검색" value={authorSearch} onChange={e => setAuthorSearch(e.target.value)}/></label><label>작성자<select value={value.authorId ?? ''} onChange={e => onChange({ ...value, authorId: e.target.value })}><option value="">전체</option><option value={userId}>본인 작성글</option>{authors.filter(([id, name]) => id !== userId && (id === value.authorId || name.toLocaleLowerCase('ko').includes(authorSearch.trim().toLocaleLowerCase('ko')))).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label></div>
    <div className="board-filter-footer"><label className="board-check"><input type="checkbox" checked={onlyPinned} onChange={e => setOnlyPinned(e.target.checked)}/>📌 고정 공지만 보기</label><button onClick={() => { setAuthorSearch(''); reset(); }}>🔄 필터 초기화</button></div>
  </div>;
}
