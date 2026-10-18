'use client';
import { boardCategories, quickPeriod, type BoardFilters } from '@/lib/board-model';
export function BoardFilterPanel({ userId, category, setCategory, onlyPinned, setOnlyPinned, value, onChange, reset }: {
  userId: string; category: string; setCategory: (value: string) => void;
  onlyPinned: boolean; setOnlyPinned: (value: boolean) => void; value: BoardFilters;
  onChange: (value: BoardFilters) => void; reset: () => void;
}) {
  const invalid = !!(value.start && value.end && value.start > value.end);
  return <div id="board-filters" className="board-filters">
    <div className="board-filter-row board-filter-top">
      <label>카테고리<select value={category} onChange={e => setCategory(e.target.value)}><option value="">전체</option>{boardCategories.map(c => <option key={c}>{c}</option>)}</select></label>
      <label>작성자 검색<input type="search" placeholder="작성자 이름 입력" value={value.authorSearch ?? ''} onChange={e => onChange({ ...value, authorSearch: e.target.value })}/></label>
    </div>
    <fieldset className="board-period"><legend>작성 기간</legend><div className="board-filter-row board-period-controls"><div className="board-date-range"><label><span className="board-sr-only">시작일</span><input type="date" aria-invalid={invalid} aria-describedby={invalid ? 'board-date-error' : undefined} value={value.start ?? ''} max={value.end || undefined} onChange={e => onChange({ ...value, start: e.target.value })}/></label><span aria-hidden="true">~</span><label><span className="board-sr-only">종료일</span><input type="date" aria-invalid={invalid} aria-describedby={invalid ? 'board-date-error' : undefined} value={value.end ?? ''} min={value.start || undefined} onChange={e => onChange({ ...value, end: e.target.value })}/></label></div><div className="board-quick-period">{([['all', '전체'], ['week', '최근 1주일'], ['month', '최근 1달']] as const).map(([key, label]) => { const range = quickPeriod(key); return <button key={key} aria-pressed={(value.start || '') === range.start && (value.end || '') === range.end} onClick={() => onChange({ ...value, ...quickPeriod(key) })}>{label}</button>; })}</div></div>{invalid && <p id="board-date-error" role="alert">종료일은 시작일 이후로 선택해주세요.</p>}</fieldset>
    <div className="board-filter-row board-filter-footer"><label className="board-check"><input type="checkbox" checked={onlyPinned} onChange={e => setOnlyPinned(e.target.checked)}/>📌 고정 공지만 보기</label><label className="board-check"><input type="checkbox" checked={value.authorId === userId} onChange={e => onChange({ ...value, authorId: e.target.checked ? userId : '' })}/>✏️ 내가 쓴 글만 보기</label><button onClick={reset}>🔄 필터 초기화</button></div>
  </div>;
}
