'use client';

import { useEffect, useRef, useState } from 'react';
import { koreaToday } from '@/lib/schedule-calendar';
import { defaultScheduleFilters, filterScheduleResults } from '@/lib/schedule-search';
import type { ScheduleDialogKind, ScheduleFilters } from '@/lib/schedule-search';
import type { Schedule, ScheduleData } from '@/lib/schedule-types';
import { ScheduleRow } from './schedule-row';

type Props = { kind: ScheduleDialogKind; data: ScheduleData; selectedId?: string; pending: boolean; onSelect: (row: Schedule) => void; onDismiss: () => void };

export function ScheduleSearchDialog({ kind, data, selectedId, pending, onSelect, onDismiss }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [filters, setFilters] = useState(() => defaultScheduleFilters(kind));
  const [advanced, setAdvanced] = useState(false);
  const [limit, setLimit] = useState(20);
  const [today, setToday] = useState(koreaToday);
  useEffect(() => {
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
    const refresh = () => setToday(koreaToday());
    const timer = window.setInterval(refresh, 60000);
    window.addEventListener('focus', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, []);
  const results = filterScheduleResults(data.schedules, data.tags, filters, today);
  const title = kind === 'all' ? '전체 일정 검색' : kind === 'upcoming' ? '다가오는 일정 전체보기' : '마감된 일정 전체보기';
  const invalidRange = Boolean(filters.from && filters.to && filters.from > filters.to);
  function update<Key extends keyof ScheduleFilters>(key: Key, value: ScheduleFilters[Key]) {
    setFilters(previous => ({ ...previous, [key]: value }));
    setLimit(20);
  }
  function select(row: Schedule) { dialog.current?.close(); onDismiss(); onSelect(row); }
  function reset() { setFilters(defaultScheduleFilters(kind)); setAdvanced(false); setLimit(20); }

  return <dialog ref={dialog} className="schedule-dialog schedule-archive-modal schedule-search-modal" aria-labelledby="schedule-search-title" onClose={onDismiss}>
    <div className="schedule-archive-modal-heading"><div><span className="schedule-eyebrow">SCHEDULE SEARCH</span><h2 id="schedule-search-title">{title}</h2></div>
      <button type="button" onClick={() => dialog.current?.close()} aria-label="일정 검색 모달 닫기">✕ 닫기</button>
    </div>
    <div className="schedule-standard-filters">
      <label>검색어<input type="search" value={filters.query} maxLength={150} placeholder="일정 제목 / 내용 검색" onChange={event => update('query', event.target.value)}/></label>
      <label>기간<select value={filters.period} onChange={event => update('period', event.target.value as ScheduleFilters['period'])}>
        <option value="all">전체</option><option value="month">이번 달</option><option value="year">올해</option>
      </select></label>
      <label>태그<select value={filters.tag} onChange={event => update('tag', event.target.value)}><option value="">전체 태그</option>{data.tags.map(tag => <option key={tag.id} value={tag.id}>{tag.name}</option>)}</select></label>
      <button type="button" className="schedule-advanced-toggle" aria-expanded={advanced} aria-controls="schedule-advanced-filters" onClick={() => setAdvanced(value => !value)}>⚙️ 상세 필터</button>
    </div>
    <div id="schedule-advanced-filters" className="schedule-advanced-filters" hidden={!advanced}>
      <label>담당자<select value={filters.assignee} onChange={event => update('assignee', event.target.value)}><option value="">전체 담당자</option><option value="__unassigned__">미지정</option>{data.people.map(person => <option key={person.user_id} value={person.user_id}>{person.display_name}</option>)}</select></label>
      <div className="schedule-filter-dates"><label>시작일<input type="date" value={filters.from} onChange={event => update('from', event.target.value)}/></label><span aria-hidden="true">~</span><label>종료일<input type="date" value={filters.to} onChange={event => update('to', event.target.value)}/></label></div>
      <label>진행 상태<select value={filters.status} onChange={event => update('status', event.target.value as ScheduleFilters['status'])}><option value="all">전체</option><option value="active">진행 중</option><option value="closed">마감</option></select></label>
      <p>지정한 기간과 겹치는 일정을 조회합니다. ‘진행 중’에는 아직 종료되지 않은 예정 일정도 포함합니다.</p>
    </div>
    {invalidRange && <p className="schedule-filter-error" role="alert">종료일을 시작일과 같거나 이후로 선택해주세요.</p>}
    <div className="schedule-filter-summary"><p role="status">검색 결과 {results.length}개 <span className="schedule-filter-status">{filters.status === 'all' ? '전체 상태' : filters.status === 'active' ? '진행 중' : '마감'}</span></p><button type="button" onClick={reset}>필터 초기화</button></div>
    {results.length ? <ul className="schedule-agenda-list">{results.slice(0, limit).map(row => <ScheduleRow key={row.id} row={row} tags={data.tags} today={today} selectedId={selectedId} pending={pending} onSelect={select}/>)}</ul>
      : <p className="schedule-agenda-empty">검색 조건에 맞는 일정이 없습니다.</p>}
    {limit < results.length && <button type="button" className="schedule-agenda-more" onClick={() => setLimit(value => value + 20)}>검색 결과 더 보기 ({results.length - limit}개)</button>}
  </dialog>;
}
