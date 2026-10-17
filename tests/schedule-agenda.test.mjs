import assert from 'node:assert/strict';
import { test } from 'node:test';
import { archiveStartDate, daysUntilSchedule, filterClosedSchedules, scheduleAgenda } from '../src/lib/schedule-agenda.ts';

const row = (id, start_date, end_date = start_date, hidden_at = null) => ({id, title:id, start_date, end_date, hidden_at});
test('D-Day uses calendar days across month/year and leap-day boundaries', () => {
  assert.equal(daysUntilSchedule(row('a','2027-01-01'),'2026-12-31'),1);
  assert.equal(daysUntilSchedule(row('a','2028-03-01'),'2028-02-28'),2);
  assert.equal(daysUntilSchedule(row('a','2026-10-17'),'2026-10-17'),0);
  assert.equal(daysUntilSchedule(row('a','2026-10-01'),'2026-10-17'),0);
});
test('today inclusive, ongoing and all future months are upcoming; hidden rows excluded', () => {
  const result=scheduleAgenda([row('later','2027-01-01'),row('tomorrow','2026-10-18'),row('ongoing','2026-10-01','2026-10-19'),row('today','2026-10-17'),row('yesterday','2026-10-16'),row('hidden','2026-10-17','2026-10-17','2026-10-17')],'2026-10-17');
  assert.deepEqual(result.upcoming.map(row=>row.id),['today','ongoing','tomorrow','later']);
  assert.deepEqual(result.closed.map(row=>row.id),['yesterday']);
});
test('closed schedules ordered by most recent end date with stable ties', () => {
  const result=scheduleAgenda([row('old','2026-09-01'),row('b','2026-10-16'),row('a','2026-10-16')],'2026-10-17');
  assert.deepEqual(result.closed.map(row=>row.id),['a','b','old']);
  assert.deepEqual(scheduleAgenda([],'2026-10-17'),{upcoming:[],closed:[]});
});

test('rolling-month archive filters clamp month ends and handle year boundaries', () => {
  assert.equal(archiveStartDate('1m','2026-03-31'),'2026-02-28');
  assert.equal(archiveStartDate('1m','2028-03-31'),'2028-02-29');
  assert.equal(archiveStartDate('3m','2026-01-31'),'2025-10-31');
  assert.equal(archiveStartDate('year','2026-10-17'),'2026-01-01');
  assert.equal(archiveStartDate('all','2026-10-17'),null);
});

test('archive search combines title, tag and note with inclusive end-date filters', () => {
  const rows=[{...row('회의','2026-09-17'),tag_id:'a',notes:'SEOUL'},
    {...row('행사','2026-08-01'),tag_id:'b',notes:'오래된 비고'},
    row('오늘','2026-10-17'),row('숨김','2026-10-16','2026-10-16','2026-10-17')];
  const tags=[{id:'a',name:'운영진'},{id:'b',name:'행사'}];
  assert.equal(filterClosedSchedules(rows,tags,' seoul ','1m','2026-10-17').length,1);
  assert.equal(filterClosedSchedules(rows,tags,'운영진','all','2026-10-17').length,1);
  assert.equal(filterClosedSchedules(rows,tags,'회의','all','2026-10-17').length,1);
  assert.equal(filterClosedSchedules(rows,tags,'비고','1m','2026-10-17').length,0);
  assert.equal(filterClosedSchedules(rows,tags,'비고','3m','2026-10-17').length,1);
  assert.equal(filterClosedSchedules(rows,tags,'','all','2026-10-17').length,2);
  assert.equal(filterClosedSchedules(rows,tags,'없는 검색어','all','2026-10-17').length,0);
});
