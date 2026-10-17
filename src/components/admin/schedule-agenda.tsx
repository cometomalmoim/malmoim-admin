'use client';

import { useEffect, useState } from 'react';
import { koreaToday } from '@/lib/schedule-calendar';
import { daysUntilSchedule, scheduleAgenda } from '@/lib/schedule-agenda';
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
  const [upcomingLimit, setUpcomingLimit] = useState(8);
  const [closedLimit, setClosedLimit] = useState(8);
  useEffect(() => {
    const refreshDay = () => setToday(koreaToday());
    const timer = window.setInterval(refreshDay, 60000);
    window.addEventListener('focus', refreshDay);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refreshDay); };
  }, []);
  const { upcoming, closed } = scheduleAgenda(schedules, today);

  function item(row: Schedule, archived = false) {
    const tag = tags.find(tag => tag.id === row.tag_id);
    const days = daysUntilSchedule(row, today);
    const ongoing = row.start_date < today && row.end_date >= today;
    return <li key={row.id}>
      <button type="button" className={`schedule-agenda-item${archived ? ' is-closed' : ''}`} disabled={pending}
        aria-pressed={selectedId === row.id} onClick={() => onSelect(row)}>
        <span className={`schedule-countdown${!archived && days === 0 ? ' is-due' : ''}`}>
          {archived ? '마감' : days === 0 ? 'D-Day' : `D-${days}`}
        </span>
        <span className="schedule-agenda-info"><strong>{row.title}</strong>
          <small><i style={{ background: tag?.color ?? '#94a3b8' }}/>{tag?.name ?? '태그 없음'}
            <span>·</span><time dateTime={row.start_date}>{row.start_date}</time>
            {row.start_date !== row.end_date && <> ~ <time dateTime={row.end_date}>{row.end_date}</time></>}
            {ongoing && <span className="schedule-ongoing">진행 중</span>}
          </small>
        </span>
        <span className="schedule-agenda-arrow" aria-hidden="true">↗</span>
      </button>
    </li>;
  }

  return <section className="schedule-agenda" aria-labelledby="schedule-agenda-title">
    <div className="schedule-agenda-heading"><div><span className="schedule-eyebrow">SCHEDULE AT A GLANCE</span>
      <h2 id="schedule-agenda-title">⏳ 다가오는 일정 <span>(D-Day)</span></h2>
      <p>오늘부터 가까운 일정 순으로 확인하세요. <span>전체 월 기준</span></p></div>
      <span className="schedule-agenda-count">{upcoming.length}개</span>
    </div>
    {upcoming.length ? <><ul className="schedule-agenda-list">{upcoming.slice(0, upcomingLimit).map(row => item(row))}</ul>
      {upcomingLimit < upcoming.length && <button type="button" className="schedule-agenda-more" onClick={() => setUpcomingLimit(limit => limit + 8)}>다가오는 일정 더 보기 ({upcoming.length - upcomingLimit})</button>}</>
      : <p className="schedule-agenda-empty">다가오는 일정이 없습니다. 새 일정을 등록해보세요.</p>}
    <details className="schedule-archive"><summary><span>📁 마감된 일정</span><span>{closed.length}개 <span className="schedule-archive-chevron" aria-hidden="true">⌄</span></span></summary>
      {closed.length ? <><p>최근 종료된 일정부터 표시합니다.</p><ul className="schedule-agenda-list">{closed.slice(0, closedLimit).map(row => item(row, true))}</ul>
        {closedLimit < closed.length && <button type="button" className="schedule-agenda-more" onClick={() => setClosedLimit(limit => limit + 8)}>마감된 일정 더 보기 ({closed.length - closedLimit})</button>}</>
        : <p className="schedule-agenda-empty">마감된 일정이 없습니다.</p>}
    </details>
  </section>;
}
