'use client';

import { useEffect, useState } from 'react';
import { koreaToday } from '@/lib/schedule-calendar';
import { scheduleAgenda } from '@/lib/schedule-agenda';
import { ScheduleRow } from './schedule-row';
import type { Schedule, ScheduleTag } from '@/lib/schedule-types';

type Props = {
  schedules: Schedule[];
  tags: ScheduleTag[];
  selectedId?: string;
  pending: boolean;
  onSelect: (row: Schedule) => void;
  onBrowse: (kind: 'upcoming' | 'closed') => void;
};

export function ScheduleAgenda({ schedules, tags, selectedId, pending, onSelect, onBrowse }: Props) {
  const [today, setToday] = useState(koreaToday);
  useEffect(() => {
    const refreshDay = () => setToday(koreaToday());
    const timer = window.setInterval(refreshDay, 60000);
    window.addEventListener('focus', refreshDay);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refreshDay); };
  }, []);
  const { upcoming, closed } = scheduleAgenda(schedules, today);
  const item = (row: Schedule) => <ScheduleRow key={row.id} row={row} tags={tags} today={today} selectedId={selectedId} pending={pending} onSelect={onSelect}/>;
  return <>
    <section className="schedule-agenda" aria-labelledby="schedule-agenda-title">
      <div className="schedule-agenda-heading"><div><span className="schedule-eyebrow">UPCOMING SCHEDULE</span>
        <h2 id="schedule-agenda-title">⏳ 다가오는 일정 <span>(D-Day)</span></h2>
        <p>오늘 기준 임박한 일정 상위 5개 · 전체 월 기준</p></div>
        <button type="button" className="schedule-archive-open" aria-haspopup="dialog" onClick={() => onBrowse('upcoming')}>+ 다가오는 일정 전체보기</button>
      </div>
      {upcoming.length ? <ul className="schedule-agenda-list">{upcoming.slice(0, 5).map(item)}</ul>
        : <p className="schedule-agenda-empty">다가오는 일정이 없습니다. 새 일정을 등록해보세요.</p>}
    </section>
    <section className="schedule-agenda schedule-closed-card" aria-labelledby="schedule-closed-title">
      <div className="schedule-agenda-heading"><div><span className="schedule-eyebrow">RECENTLY CLOSED</span>
        <h2 id="schedule-closed-title">📁 마감된 일정</h2><p>최근 마감된 일정 5개를 표시합니다.</p></div>
        <button type="button" className="schedule-archive-open" aria-haspopup="dialog" onClick={() => onBrowse('closed')}>+ 마감 일정 전체보기</button>
      </div>
      {closed.length ? <ul className="schedule-agenda-list">{closed.slice(0, 5).map(item)}</ul>
        : <p className="schedule-agenda-empty">마감된 일정이 없습니다.</p>}
    </section>
  </>;
}
