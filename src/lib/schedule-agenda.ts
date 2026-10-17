import type { Schedule, ScheduleTag } from './schedule-types';

export type ArchivePeriod = '1m' | '3m' | 'year' | 'all';

export function archiveStartDate(period: ArchivePeriod, today: string) {
  if (period === 'all') return null;
  if (period === 'year') return `${today.slice(0, 4)}-01-01`;
  const date = new Date(`${today}T00:00:00Z`);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() - (period === '1m' ? 1 : 3));
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return date.toISOString().slice(0, 10);
}

export function filterClosedSchedules(rows: Schedule[], tags: ScheduleTag[], query: string, period: ArchivePeriod, today: string) {
  const from = archiveStartDate(period, today);
  const search = query.normalize('NFKC').trim().toLocaleLowerCase('ko');
  const names = new Map(tags.map(tag => [tag.id, tag.name]));
  return rows.filter(row => !row.hidden_at && row.end_date < today && (!from || row.end_date >= from) &&
    (!search || `${row.title} ${names.get(row.tag_id) ?? ''} ${row.notes ?? ''}`.normalize('NFKC').toLocaleLowerCase('ko').includes(search)));
}

export function daysUntilSchedule(row: Pick<Schedule, 'start_date'>, today: string) {
  return Math.max(0, Math.round((Date.parse(row.start_date) - Date.parse(today)) / 86400000));
}

export function scheduleAgenda(rows: Schedule[], today: string) {
  const visible = rows.filter(row => !row.hidden_at);
  return {
    upcoming: visible.filter(row => row.end_date >= today).sort((a, b) =>
      daysUntilSchedule(a, today) - daysUntilSchedule(b, today) ||
      a.end_date.localeCompare(b.end_date) || a.title.localeCompare(b.title, 'ko') || a.id.localeCompare(b.id)),
    closed: visible.filter(row => row.end_date < today).sort((a, b) =>
      b.end_date.localeCompare(a.end_date) || a.title.localeCompare(b.title, 'ko') || a.id.localeCompare(b.id)),
  };
}
