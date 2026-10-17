import { daysUntilSchedule } from '@/lib/schedule-agenda';
import type { Schedule, ScheduleTag } from '@/lib/schedule-types';

type Props = { row: Schedule; tags: ScheduleTag[]; today: string; selectedId?: string; pending: boolean; onSelect: (row: Schedule) => void };

export function ScheduleRow({ row, tags, today, selectedId, pending, onSelect }: Props) {
  const tag = tags.find(tag => tag.id === row.tag_id);
  const archived = row.end_date < today;
  const days = daysUntilSchedule(row, today);
  const ongoing = row.start_date < today && !archived;
  const status = archived ? '마감' : ongoing ? '진행 중' : days === 0 ? '오늘' : '예정';
  const start = `${row.start_date.replaceAll('-', '.')}${row.start_time ? ` ${row.start_time.slice(0, 5)}` : ''}`;
  const end = `${row.end_date.replaceAll('-', '.')}${row.end_time ? ` ${row.end_time.slice(0, 5)}` : ''}`;
  const dates = row.start_date === row.end_date
    ? `${row.start_date.replaceAll('-', '.')}${row.start_time || row.end_time ? ` ${row.start_time?.slice(0, 5) ?? '시간 미정'} ~ ${row.end_time?.slice(0, 5) ?? '시간 미정'}` : ''}`
    : `${start} ~ ${end}`;
  const divider = <span className="schedule-row-divider" aria-hidden="true">|</span>;
  return <li>
    <button type="button" className={`schedule-agenda-item${archived ? ' is-closed' : ''}`} disabled={pending}
      aria-pressed={selectedId === row.id} onClick={() => onSelect(row)} title={`${row.title} · ${tag?.name ?? ''} · ${dates} · ${status}`}>
      <span className={`schedule-countdown${!archived && days === 0 ? ' is-due' : ''}`}>{archived ? '마감' : days === 0 ? 'D-Day' : `D-${days}`}</span>{divider}
      <strong className="schedule-row-title">{row.title}</strong>{divider}
      <span className="schedule-row-tag"><i style={{ background: tag?.color ?? '#94a3b8' }}/><span>{tag?.name ?? '태그 없음'}</span></span>{divider}
      <span className="schedule-row-date" title={dates}>{dates}</span>{divider}
      <span className={`schedule-row-status${ongoing ? ' is-ongoing' : ''}`}>{status}</span>
    </button>
  </li>;
}
