'use client';

import { useEffect, useRef, useState } from 'react';
import { koreaToday } from '@/lib/schedule-calendar';
import { daysUntilSchedule, filterClosedSchedules, scheduleAgenda } from '@/lib/schedule-agenda';
import type { ArchivePeriod } from '@/lib/schedule-agenda';
import type { Schedule, ScheduleTag } from '@/lib/schedule-types';

type Props = {
  schedules: Schedule[];
  tags: ScheduleTag[];
  selectedId?: string;
  pending: boolean;
  onSelect: (row: Schedule) => void;
};

export function ScheduleAgenda({ schedules, tags, selectedId, pending, onSelect }: Props) {
  const [today, setToday] = useState(koreaToday);
  const [query, setQuery] = useState('');
  const [period, setPeriod] = useState<ArchivePeriod>('all');
  const [archiveLimit, setArchiveLimit] = useState(20);
  const archiveDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const refreshDay = () => setToday(koreaToday());
    const timer = window.setInterval(refreshDay, 60000);
    window.addEventListener('focus', refreshDay);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refreshDay); };
  }, []);
  const { upcoming, closed } = scheduleAgenda(schedules, today);
  const filtered = filterClosedSchedules(closed, tags, query, period, today);

  function openArchive() {
    setQuery(''); setPeriod('all'); setArchiveLimit(20);
    archiveDialog.current?.showModal();
  }

  function select(row: Schedule) {
    archiveDialog.current?.close();
    onSelect(row);
  }

  function item(row: Schedule, archived = false) {
    const tag = tags.find(tag => tag.id === row.tag_id);
    const days = daysUntilSchedule(row, today);
    const ongoing = row.start_date < today && row.end_date >= today;
    const status = archived ? '마감' : ongoing ? '진행 중' : days === 0 ? '오늘' : '예정';
    const dates = row.start_date === row.end_date ? row.start_date : `${row.start_date} ~ ${row.end_date}`;
    const divider = <span className="schedule-row-divider" aria-hidden="true">|</span>;
    return <li key={row.id}>
      <button type="button" className={`schedule-agenda-item${archived ? ' is-closed' : ''}`} disabled={pending}
        aria-pressed={selectedId === row.id} onClick={() => select(row)} title={`${row.title} · ${tag?.name ?? ''} · ${dates} · ${status}`}>
        <span className={`schedule-countdown${!archived && days === 0 ? ' is-due' : ''}`}>
          {archived ? '마감' : days === 0 ? 'D-Day' : `D-${days}`}
        </span>{divider}
        <strong className="schedule-row-title">{row.title}</strong>{divider}
        <span className="schedule-row-tag"><i style={{ background: tag?.color ?? '#94a3b8' }}/><span>{tag?.name ?? '태그 없음'}</span></span>{divider}
        <span className="schedule-row-date"><time dateTime={row.start_date}>{row.start_date}</time>
          {row.start_date !== row.end_date && <> ~ <time dateTime={row.end_date}>{row.end_date}</time></>}
        </span>{divider}
        <span className={`schedule-row-status${ongoing ? ' is-ongoing' : ''}`}>{status}</span>
      </button>
    </li>;
  }

  return <>
    <section className="schedule-agenda" aria-labelledby="schedule-agenda-title">
      <div className="schedule-agenda-heading"><div><span className="schedule-eyebrow">UPCOMING SCHEDULE</span>
        <h2 id="schedule-agenda-title">⏳ 다가오는 일정 <span>(D-Day)</span></h2>
        <p>오늘 기준 임박한 일정 상위 5개 · 전체 월 기준</p></div>
        <span className="schedule-agenda-count">{Math.min(5, upcoming.length)}개</span>
      </div>
      {upcoming.length ? <ul className="schedule-agenda-list">{upcoming.slice(0, 5).map(row => item(row))}</ul>
        : <p className="schedule-agenda-empty">다가오는 일정이 없습니다. 새 일정을 등록해보세요.</p>}
    </section>
    <section className="schedule-agenda schedule-closed-card" aria-labelledby="schedule-closed-title">
      <div className="schedule-agenda-heading"><div><span className="schedule-eyebrow">RECENTLY CLOSED</span>
        <h2 id="schedule-closed-title">📁 마감된 일정</h2><p>최근 마감된 일정 5개를 표시합니다.</p></div>
        <button type="button" className="schedule-archive-open" onClick={openArchive}>+ 마감 일정 전체보기</button>
      </div>
      {closed.length ? <ul className="schedule-agenda-list">{closed.slice(0, 5).map(row => item(row, true))}</ul>
        : <p className="schedule-agenda-empty">마감된 일정이 없습니다.</p>}
    </section>
    <dialog ref={archiveDialog} className="schedule-dialog schedule-archive-modal" aria-labelledby="schedule-archive-title">
      <div className="schedule-archive-modal-heading"><div><span className="schedule-eyebrow">SCHEDULE ARCHIVE</span>
        <h2 id="schedule-archive-title">마감 일정 전체보기</h2></div>
        <button type="button" onClick={() => archiveDialog.current?.close()} aria-label="마감 일정 모달 닫기">✕ 닫기</button>
      </div>
      <div className="schedule-archive-filters">
        <label>일정 검색<input type="search" value={query} maxLength={150} placeholder="제목, 태그, 비고 검색" onChange={event => { setQuery(event.target.value); setArchiveLimit(20); }}/></label>
        <label>마감 기간<select value={period} onChange={event => { setPeriod(event.target.value as ArchivePeriod); setArchiveLimit(20); }}>
          <option value="1m">최근 1개월</option><option value="3m">최근 3개월</option><option value="year">올해</option><option value="all">전체</option>
        </select></label>
      </div>
      <p className="schedule-archive-result" role="status">검색 결과 {filtered.length}개 · 종료일 기준, 최근 마감순</p>
      {filtered.length ? <ul className="schedule-agenda-list">{filtered.slice(0, archiveLimit).map(row => item(row, true))}</ul>
        : <p className="schedule-agenda-empty">조건에 맞는 마감 일정이 없습니다.</p>}
      {archiveLimit < filtered.length && <button type="button" className="schedule-agenda-more" onClick={() => setArchiveLimit(limit => limit + 20)}>검색 결과 더 보기 ({filtered.length - archiveLimit}개)</button>}
    </dialog>
  </>;
}
