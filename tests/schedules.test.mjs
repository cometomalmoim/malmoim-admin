import assert from 'node:assert/strict';
import {test} from 'node:test';
import {koreaToday,monthGrid,weekSegments,validDate} from '../src/lib/schedule-calendar.ts';
import {scheduleInput} from '../src/lib/schedule-validation.ts';
test('Korean today and leap dates',()=>{
 assert.equal(koreaToday(new Date('2026-10-15T15:00:00Z')),'2026-10-16');
 assert.equal(validDate('2026-02-29'),false);assert.equal(validDate('2028-02-29'),true);
 assert.equal(validDate('2026-04-31'),false);
});
test('month grid includes adjacent month and year boundary',()=>{
 const grid=monthGrid('2027-01');assert.equal(grid.days.length,42);assert.equal(grid.start,'2026-12-27');assert.equal(grid.end,'2027-02-06');
 assert.equal(monthGrid('2026-99').month,koreaToday().slice(0,7));
});
test('inclusive dates, overlapping lanes and week continuations',()=>{
 const rows=[{id:'a',start_date:'2026-10-16',end_date:'2026-10-18'},{id:'b',start_date:'2026-10-17',end_date:'2026-10-17'},{id:'c',start_date:'2026-10-16',end_date:'2026-10-16'}];
 const first=weekSegments(rows,'2026-10-11');assert.equal(first[0].column,6);assert.equal(first[0].span,2);assert.equal(first[0].continuesAfter,true);
 assert.notEqual(first.find(s=>s.row.id==='b').lane,first[0].lane);
 const second=weekSegments(rows,'2026-10-18');assert.equal(second.length,1);assert.equal(second[0].span,1);assert.equal(second[0].continuesBefore,true);
});
test('manual schedule validates dates, required tag, title and note limits',()=>{
 function form(p={}){const f=new FormData();Object.entries({title:'회의',start_date:'2026-10-16',end_date:'2026-10-16',tag_id:'tag',...p}).forEach(([k,v])=>f.set(k,v));return f;}
 assert.equal(scheduleInput(form()).assignee_id,null);
 for(const patch of [{title:' '},{tag_id:''},{start_date:'2026-02-30'},{end_date:'2026-10-15'},{notes:'x'.repeat(5001)}])assert.throws(()=>scheduleInput(form(patch)));
});

test('optional minute times allow omission, partial input and overnight dates',()=>{
 function form(p={}){const f=new FormData();Object.entries({title:'회의',start_date:'2026-10-17',end_date:'2026-10-17',tag_id:'tag',...p}).forEach(([k,v])=>f.set(k,v));return f;}
 assert.equal(scheduleInput(form()).start_time,null);
 assert.equal(scheduleInput(form({start_time:'09:30'})).end_time,null);
 assert.equal(scheduleInput(form({end_time:'00:00'})).end_time,'00:00');
 assert.equal(scheduleInput(form({start_time:'23:00',end_time:'01:00',end_date:'2026-10-18'})).start_time,'23:00');
 for(const p of [{start_time:'24:00'},{start_time:'9:30'},{end_time:'12:60'},{start_time:'09:00:00'},{start_time:'10:00',end_time:'09:00'}])assert.throws(()=>scheduleInput(form(p)));
});
