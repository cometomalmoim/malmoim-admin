import assert from 'node:assert/strict';
import { test } from 'node:test';
import { defaultScheduleFilters, filterScheduleResults } from '../src/lib/schedule-search.ts';

const today='2026-10-17';
const row=(id,start,end=start,extra={})=>({id,title:id,start_date:start,end_date:end,tag_id:'meeting',assignee_id:null,notes:'',hidden_at:null,...extra});
const rows=[row('closed','2026-10-10'),row('today','2026-10-17'),row('future','2026-11-01','2026-11-02',{assignee_id:'person'}),row('spanning','2026-09-01','2026-12-01',{tag_id:'event'}),row('old','2025-01-01'),row('hidden','2026-10-17','2026-10-17',{hidden_at:'yes'})];
const tags=[{id:'meeting',name:'회의'},{id:'event',name:'행사'}];
const search=(filters={})=>filterScheduleResults(rows,tags,{...defaultScheduleFilters('all'),...filters},today);

test('each entry has independent status defaults and users can change status',()=>{
 assert.equal(defaultScheduleFilters('all').status,'all');
 assert.equal(defaultScheduleFilters('upcoming').status,'active');
 assert.equal(defaultScheduleFilters('closed').status,'closed');
 assert.deepEqual(search({status:'closed'}).map(r=>r.id),['closed','old']);
 assert.deepEqual(search({status:'active'}).map(r=>r.id),['today','spanning','future']);
});
test('month and year quick filters use inclusive overlap boundaries',()=>{
 assert.deepEqual(search({period:'month'}).map(r=>r.id),['today','spanning','closed']);
 assert.equal(search({period:'year'}).some(r=>r.id==='old'),false);
 assert.deepEqual(search({from:'2026-11-02',to:'2026-11-02'}).map(r=>r.id),['spanning','future']);
 assert.equal(search({from:'2026-11-03',to:'2026-11-02'}).length,0);
 assert.equal(search({from:'2026-02-30'}).length,0);
 assert.equal(search({period:'month',from:'2027-01-01'}).length,0);
});
test('keyword, tag, assignee including unassigned and dates combine with AND',()=>{
 assert.deepEqual(search({query:'future',tag:'meeting',assignee:'person',from:'2026-11-01',to:'2026-11-02'}).map(r=>r.id),['future']);
 assert.equal(search({assignee:'__unassigned__'}).some(r=>r.id==='future'),false);
 assert.equal(search({tag:'event',assignee:'person'}).length,0);
 assert.deepEqual(search({query:'행사',tag:'event',status:'active'}).map(r=>r.id),['spanning']);
 assert.equal(search().length,5);
});
