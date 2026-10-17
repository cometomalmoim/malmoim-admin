import assert from 'node:assert/strict';
import { test } from 'node:test';
import { daysUntilSchedule, scheduleAgenda } from '../src/lib/schedule-agenda.ts';

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
