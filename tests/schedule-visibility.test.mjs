import test from 'node:test';
import assert from 'node:assert/strict';
import {visibleEventSchedules} from '../src/lib/schedule-visibility.ts';
const rows=[{id:'manual',source_kind:'manual',event_id:null,hidden_at:null},{id:'event',source_kind:'event',event_id:'a',hidden_at:null},{id:'recruitment',source_kind:'recruitment',event_id:'a',hidden_at:null},{id:'hidden',source_kind:'event',event_id:'a',hidden_at:'2026-10-01'},{id:'orphan',source_kind:'event',event_id:null,hidden_at:null}];
test('archiving removes both generated schedules while keeping manual work',()=>{
 assert.deepEqual(visibleEventSchedules(rows,[]).map(row=>row.id),['manual']);
});
test('restoring brings linked schedules back without reviving individually hidden rows',()=>{
 assert.deepEqual(visibleEventSchedules(rows,[{id:'a'}]).map(row=>row.id),['manual','event','recruitment']);
 assert.equal(rows.length,5);
});
test('other active events remain visible when one event is archived',()=>{
 const other={id:'other',source_kind:'event',event_id:'b',hidden_at:null};
 assert.deepEqual(visibleEventSchedules([...rows,other],[{id:'b'}]).map(row=>row.id),['manual','other']);
});
