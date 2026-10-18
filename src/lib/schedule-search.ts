import type { Schedule, ScheduleTag } from './schedule-types';
import { validDate } from './schedule-calendar.ts';
import { scheduleAgenda, searchSchedules } from './schedule-agenda.ts';

export type ScheduleDialogKind = 'all' | 'upcoming' | 'closed';
export type ScheduleFilters = {
  query: string;
  period: 'all' | 'month' | 'year';
  tag: string;
  assignee: string;
  from: string;
  to: string;
  status: 'all' | 'active' | 'closed';
};

export function defaultScheduleFilters(kind: ScheduleDialogKind): ScheduleFilters {
  return { query: '', period: 'all', tag: '', assignee: '', from: '', to: '', status: kind === 'upcoming' ? 'active' : kind === 'closed' ? 'closed' : 'all' };
}

export function filterScheduleResults(rows: Schedule[], tags: ScheduleTag[], filters: ScheduleFilters, today: string) {
  if ((filters.from && !validDate(filters.from)) || (filters.to && !validDate(filters.to)) || (filters.from && filters.to && filters.from > filters.to)) return [];
  let from = filters.from;
  let to = filters.to;
  if (filters.period !== 'all') {
    const year = Number(today.slice(0, 4));
    const month = Number(today.slice(5, 7));
    const quickFrom = filters.period === 'month' ? `${today.slice(0, 7)}-01` : `${year}-01-01`;
    const quickTo = filters.period === 'month' ? new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10) : `${year}-12-31`;
    from = from > quickFrom ? from : quickFrom;
    to = to && to < quickTo ? to : quickTo;
  }
  if (from && to && from > to) return [];
  const scope = filters.status === 'active' ? 'upcoming' : filters.status === 'closed' ? 'closed' : 'all';
  const matching = searchSchedules(rows, tags, filters.query, scope, today).filter(row =>
    (!filters.tag || row.tag_id === filters.tag) &&
    (!filters.assignee || (filters.assignee === '__unassigned__' ? !row.assignee_id : row.assignee_id === filters.assignee)) &&
    (!from || row.end_date >= from) && (!to || row.start_date <= to));
  const { upcoming, closed } = scheduleAgenda(matching, today);
  return [...upcoming, ...closed];
}
