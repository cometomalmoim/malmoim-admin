'use client';
import { boardPageNumbers } from '@/lib/board-pagination';
export function BoardPagination({ page, totalPages, disabled, onChange }: { page: number; totalPages: number; disabled: boolean; onChange: (page: number) => void }) {
  return <nav className="board-pagination" aria-label="게시글 페이지 이동"><button disabled={disabled || page === 1} onClick={() => onChange(page - 1)}>이전 ◀</button><div className="board-page-numbers">{boardPageNumbers(page, totalPages).map((n, index) => typeof n === 'number' ? <button key={n} aria-label={`${n}페이지`} aria-current={page === n ? 'page' : undefined} disabled={disabled} onClick={() => onChange(n)}>{n}</button> : <span key={`gap-${index}`} aria-hidden="true">…</span>)}</div><button disabled={disabled || page === totalPages} onClick={() => onChange(page + 1)}>다음 ▶</button></nav>;
}
