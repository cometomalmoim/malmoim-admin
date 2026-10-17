'use client';

import { useEffect, useRef, useState } from 'react';
import { koreaToday } from '@/lib/schedule-calendar';
import { filterClosedSchedules, searchSchedules, scheduleAgenda } from '@/lib/schedule-agenda';
import { ScheduleRow } from './schedule-row';
import type { ArchivePeriod, ScheduleSearchScope } from '@/lib/schedule-agenda';
import type { Schedule, ScheduleTag } from '@/lib/schedule-types';

type Props = {
  schedules: Schedule[];
  tags: ScheduleTag[];
  selectedId?: string;
  pending: boolean;
  onSelect: (row: Schedule) => void;
  filterQuery?: string;
  filterScope?: ScheduleSearchScope;
};

export function ScheduleAgenda({ schedules, tags, selectedId, pending, onSelect, filterQuery = '', filterScope = 'all' }: Props) {
  const [today, setToday] = useState(koreaToday);
  const [query, setQuery] = useState('');
  const [period, setPeriod] = useState<ArchivePeriod>('all');
  const [modalKind, setModalKind] = useState<'upcoming' | 'closed'>('closed');
  const [archiveLimit, setArchiveLimit] = useState(20);
  const archiveDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const refreshDay = () => setToday(koreaToday());
    const timer = window.setInterval(refreshDay, 60000);
    window.addEventListener('focus', refreshDay);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refreshDay); };
  }, []);
  const allAgenda = scheduleAgenda(schedules, today);
  const { upcoming, closed } = scheduleAgenda(searchSchedules(schedules, tags, filterQuery, filterScope, today), today);
  const filtered = modalKind === 'closed' ? filterClosedSchedules(allAgenda.closed, tags, query, period, today) : searchSchedules(allAgenda.upcoming, tags, query, 'upcoming', today);

  function openArchive(kind: 'upcoming' | 'closed') {
    setModalKind(kind);
    setQuery(''); setPeriod('all'); setArchiveLimit(20);
    archiveDialog.current?.showModal();
  }

  function select(row: Schedule) {
    archiveDialog.current?.close();
    onSelect(row);
  }

  function item(row: Schedule) {
    return <ScheduleRow key={row.id} row={row} tags={tags} today={today} selectedId={selectedId} pending={pending} onSelect={select}/>;
  }

  return <>
    <section className="schedule-agenda" aria-labelledby="schedule-agenda-title">
      <div className="schedule-agenda-heading"><div><span className="schedule-eyebrow">UPCOMING SCHEDULE</span>
        <h2 id="schedule-agenda-title">⏳ 다가오는 일정 <span>(D-Day)</span></h2>
        <p>오늘 기준 임박한 일정 상위 5개 · 전체 월 기준</p></div>
        <button type="button" className="schedule-archive-open" onClick={() => openArchive('upcoming')}>+ 다가오는 일정 전체보기</button>
      </div>
      {upcoming.length ? <ul className="schedule-agenda-list">{upcoming.slice(0, 5).map(row => item(row))}</ul>
        : <p className="schedule-agenda-empty">다가오는 일정이 없습니다. 새 일정을 등록해보세요.</p>}
    </section>
    <section className="schedule-agenda schedule-closed-card" aria-labelledby="schedule-closed-title">
      <div className="schedule-agenda-heading"><div><span className="schedule-eyebrow">RECENTLY CLOSED</span>
        <h2 id="schedule-closed-title">📁 마감된 일정</h2><p>최근 마감된 일정 5개를 표시합니다.</p></div>
        <button type="button" className="schedule-archive-open" onClick={() => openArchive('closed')}>+ 마감 일정 전체보기</button>
      </div>
      {closed.length ? <ul className="schedule-agenda-list">{closed.slice(0, 5).map(row => item(row))}</ul>
        : <p className="schedule-agenda-empty">마감된 일정이 없습니다.</p>}
    </section>
    <dialog ref={archiveDialog} className="schedule-dialog schedule-archive-modal" aria-labelledby="schedule-archive-title">
      <div className="schedule-archive-modal-heading"><div><span className="schedule-eyebrow">{modalKind === 'closed' ? 'SCHEDULE ARCHIVE' : 'UPCOMING SCHEDULE'}</span>
        <h2 id="schedule-archive-title">{modalKind === 'closed' ? '마감 일정 전체보기' : '다가오는 일정 전체보기'}</h2></div>
        <button type="button" onClick={() => archiveDialog.current?.close()} aria-label="일정 전체보기 모달 닫기">✕ 닫기</button>
      </div>
      <div className={`schedule-archive-filters ${modalKind === 'upcoming' ? 'is-upcoming' : ''}`}>
        <label>일정 검색<input type="search" value={query} maxLength={150} placeholder="제목, 태그, 비고 검색" onChange={event => { setQuery(event.target.value); setArchiveLimit(20); }}/></label>
        {modalKind === 'closed' && <label>마감 기간<select value={period} onChange={event => { setPeriod(event.target.value as ArchivePeriod); setArchiveLimit(20); }}>
          <option value="1m">최근 1개월</option><option value="3m">최근 3개월</option><option value="year">올해</option><option value="all">전체</option>
        </select></label>}
      </div>
      <p className="schedule-archive-result" role="status">검색 결과 {filtered.length}개 · {modalKind === 'closed' ? '종료일 기준, 최근 마감순' : '오늘 기준, 임박순'}</p>
      {filtered.length ? <ul className="schedule-agenda-list">{filtered.slice(0, archiveLimit).map(row => item(row))}</ul>
        : <p className="schedule-agenda-empty">조건에 맞는 일정이 없습니다.</p>}
      {archiveLimit < filtered.length && <button type="button" className="schedule-agenda-more" onClick={() => setArchiveLimit(limit => limit + 20)}>검색 결과 더 보기 ({filtered.length - archiveLimit}개)</button>}
    </dialog>
  </>;
}
