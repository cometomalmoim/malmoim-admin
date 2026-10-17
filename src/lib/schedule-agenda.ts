import type { Schedule } from './schedule-types';

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
