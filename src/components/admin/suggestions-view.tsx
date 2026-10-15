import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getSuggestion,
  getSuggestions,
  suggestionStatuses,
  type SuggestionFilter,
  type SuggestionRow,
  type SuggestionStatus,
} from '@/lib/suggestions';
import { AdminShell } from './admin-shell';
import { SuggestionCreateForm, SuggestionDeleteForm, SuggestionEditForm, SuggestionFeedbackForm, SuggestionResolutionForm, SuggestionStatusForm } from './suggestion-forms';
import './suggestions.css';

const statusLabels: Record<SuggestionStatus, string> = { received: '접수', reviewing: '검토 중', completed: '처리 완료' };
const statusClass: Record<SuggestionStatus, string> = { received: 'received', reviewing: 'reviewing', completed: 'completed' };
function dateLabel(value: string) { return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
function StatusBadge({ status }: { status: SuggestionStatus }) { return <span className={`sg-status ${statusClass[status]}`}>{statusLabels[status]}</span>; }
function Crumb({ detail }: { detail?: boolean }) { return <nav className="ops-breadcrumb" aria-label="페이지 이동 경로"><Link href="/admin">홈</Link><span>/</span>{detail ? <Link href="/admin/suggestions">건의함</Link> : <span>건의함</span>}{detail && <><span>/</span><span>상세</span></>}</nav>; }

function SuggestionList({ rows, filter, page, pageSize, stats }: { rows: SuggestionRow[]; filter: SuggestionFilter; page: number; pageSize: number; stats: { all: number; received: number; reviewing: number; completed: number } }) {
  const total = filter === 'all' ? stats.all : stats[filter];
  const filters: { value: SuggestionFilter; label: string; count: number }[] = [
    { value: 'all', label: '전체', count: stats.all },
    { value: 'received', label: '접수', count: stats.received },
    { value: 'reviewing', label: '검토 중', count: stats.reviewing },
    { value: 'completed', label: '처리 완료', count: stats.completed },
  ];
  return <>
    <section className="sg-stats" aria-label="건의 처리 현황">{filters.map(item => <article className="ops-panel" key={item.value}><h2>{item.label === '전체' ? '전체 건의' : `${item.label} 건의`}</h2><strong>{item.count}</strong><p className="ops-muted">실제 저장된 건의</p></article>)}</section>
    <section className="ops-panel sg-list-panel"><div className="sg-list-heading"><div><h2>건의 목록</h2><p className="ops-muted">총 {total}건 · 최신 작성순</p></div></div>
      <nav className="sg-filters" aria-label="상태별 필터">{filters.map(item => <Link key={item.value} href={item.value === 'all' ? '/admin/suggestions' : `/admin/suggestions?status=${item.value}`} aria-current={filter === item.value ? 'page' : undefined}>{item.label}<span>{item.count}</span></Link>)}</nav>
      {!rows.length ? <div className="ops-empty"><h3>{filter === 'all' ? '아직 등록된 건의가 없습니다' : `${filters.find(item => item.value === filter)?.label} 상태의 건의가 없습니다`}</h3><p>새 건의를 작성하면 이 목록에 표시됩니다.</p></div> : <div className="ops-table-scroll"><table className="ops-applications sg-table"><caption className="ops-muted">각 행의 ‘건의 확인하기’ 버튼에서 상세 내용과 처리 도구를 열 수 있습니다.</caption><thead><tr><th scope="col">제목</th><th scope="col">작성자 표시</th><th scope="col">작성일</th><th scope="col">상태</th><th scope="col">상세</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}><td>{row.title}</td><td>{row.is_anonymous ? <span className="sg-anonymous">익명</span> : row.public_name}</td><td>{dateLabel(row.created_at)}</td><td><StatusBadge status={row.status} /></td><td><Link className="sg-secondary sg-open-link" href={`/admin/suggestions/${row.id}`}>건의 확인하기</Link></td></tr>)}</tbody></table></div>}
      {total > pageSize && <nav className="sg-pagination" aria-label="건의 목록 페이지">{page > 1 && <Link href={filter === 'all' ? `?page=${page - 1}` : `?status=${filter}&page=${page - 1}`}>← 이전</Link>}<span>{page} / {Math.ceil(total / pageSize)}페이지</span>{page * pageSize < total && <Link href={filter === 'all' ? `?page=${page + 1}` : `?status=${filter}&page=${page + 1}`}>다음 →</Link>}</nav>}
    </section>
  </>;
}

async function SuggestionDetail({ id, email }: { id: string; email: string }) {
  const result = await getSuggestion(id);
  if (result.kind === 'missing') notFound();
  return <AdminShell email={email} current="suggestions" title="건의 상세"><Crumb detail /><div className="ops-heading"><h1>건의 상세</h1><p>운영진 공통 건의함 · 모든 관리자가 내용을 확인하고 처리할 수 있습니다.</p></div>
    {result.kind === 'error' ? <section className="ops-panel" role="alert"><h2>건의 내용을 불러오지 못했습니다</h2><p>연결 설정 또는 관리자 권한을 확인한 뒤 다시 시도해주세요.</p><Link className="ops-link" href={`/admin/suggestions/${id}`}>다시 시도</Link></section> : <>
      <section className="ops-panel sg-detail"><div className="sg-detail-heading"><div><StatusBadge status={result.suggestion.status} /><h2>{result.suggestion.title}</h2></div><div className="sg-detail-actions"><SuggestionDeleteForm id={result.suggestion.id} /><Link className="ops-link" href="/admin/suggestions">목록으로</Link></div></div>
        <dl className="sg-meta"><div><dt>작성자 표시</dt><dd>{result.suggestion.is_anonymous ? <span className="sg-anonymous">익명</span> : result.suggestion.public_name}</dd></div><div><dt>작성일</dt><dd>{dateLabel(result.suggestion.created_at)}</dd></div><div><dt>익명 여부</dt><dd>{result.suggestion.is_anonymous ? '익명' : '실명 공개'}</dd></div></dl>
        <section className="sg-content"><div className="sg-content-heading"><h3>건의 내용</h3><SuggestionEditForm id={result.suggestion.id} title={result.suggestion.title} content={result.suggestion.content} /></div><p>{result.suggestion.content}</p></section>
        <div className="sg-status-area"><SuggestionStatusForm id={result.suggestion.id} status={result.suggestion.status} />{result.suggestion.last_modified_at && <p className="ops-muted">마지막 처리 변경: {result.suggestion.last_modified_by ?? '관리자'} · {dateLabel(result.suggestion.last_modified_at)}</p>}</div>
      </section>
      <div className="sg-work-grid"><section className="ops-panel"><h2>운영진 피드백</h2><SuggestionFeedbackForm id={result.suggestion.id} value={result.suggestion.staff_feedback} /></section><section className="ops-panel"><h2>실제 처리 결과</h2><SuggestionResolutionForm id={result.suggestion.id} value={result.suggestion.resolution} /></section></div>
    </>}
  </AdminShell>;
}

export async function SuggestionsView({ email, id, status, page = 1 }: { email: string; id?: string; status?: string; page?: number }) {
  if (id) return <SuggestionDetail id={id} email={email} />;
  const selected = suggestionStatuses.includes(status as SuggestionStatus) ? status as SuggestionStatus : 'all';
  const result = await getSuggestions(selected, page);
  return <AdminShell email={email} current="suggestions" title="건의함"><Crumb /><div className="ops-heading"><h1>운영진 건의함</h1><p>운영진이 작성한 건의를 함께 확인하고 처리합니다.</p></div>
    <SuggestionCreateForm />
    {result.kind === 'error' ? <section className="ops-panel sg-load-error" role="alert"><h2>건의 목록을 불러오지 못했습니다</h2><p>건의함 DB가 아직 적용되지 않았거나 연결·권한 설정에 문제가 있을 수 있습니다.</p><Link className="ops-link" href="/admin/suggestions">다시 시도</Link></section> : <SuggestionList rows={result.rows} filter={result.filter} page={result.page} pageSize={result.pageSize} stats={result.stats} />}
  </AdminShell>;
}
