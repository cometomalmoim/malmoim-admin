import type { Schedule } from './schedule-types';
export function koreaToday(now = new Date()) { return new Date(now.getTime() + 9 * 3600000).toISOString().slice(0, 10); }
export function validDate(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value; }
export function addDays(date: string, count: number) { const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + count); return d.toISOString().slice(0,10); }
export function monthGrid(raw?: string) {
  const month = raw && /^\d{4}-(0[1-9]|1[0-2])$/.test(raw) && Number(raw.slice(0,4)) >= 1900 && Number(raw.slice(0,4)) <= 2100 ? raw : koreaToday().slice(0,7);
  const first = `${month}-01`; const start = addDays(first, -new Date(first).getUTCDay());
  return {month, start, end: addDays(start,41), days: Array.from({length:42},(_,i)=>addDays(start,i))};
}
export function weekSegments(rows: Schedule[], start: string) {
  const end = addDays(start,6); const lanes: string[] = [];
  return rows.filter(r=>r.start_date<=end && r.end_date>=start).sort((a,b)=>a.start_date.localeCompare(b.start_date)||b.end_date.localeCompare(a.end_date)||a.id.localeCompare(b.id)).map(row=>{
    const from = row.start_date < start ? start : row.start_date; const to = row.end_date > end ? end : row.end_date;
    let lane = lanes.findIndex(last=>last<from); if(lane<0) lane=lanes.length; lanes[lane]=to;
    return {row, lane, column: Math.round((Date.parse(from)-Date.parse(start))/86400000)+1, span: Math.round((Date.parse(to)-Date.parse(from))/86400000)+1, continuesBefore: row.start_date<start, continuesAfter: row.end_date>end};
  });
}
