import test from 'node:test';
import assert from 'node:assert/strict';
import {sessionInput,sessionAttendanceInput} from '../src/lib/session-validation.ts';
const form=value=>{const data=new FormData();for(const [key,v] of Object.entries(value))data.set(key,String(v));return data;};
const id='11111111-1111-4111-8111-111111111111';
test('calendar dates validate leap year and reject normalized invalid dates',()=>{assert.equal(sessionInput(form({session_date:'2028-02-29',title:' 1회차 ',revision:0})).title,'1회차');for(const date of ['2026-02-29','2026-04-31','2026-99-10','1999-12-31','2101-01-01','2026-1-1',''])assert.throws(()=>sessionInput(form({session_date:date,title:'회차',revision:0})));});
test('session create and edit require matching revision modes',()=>{assert.equal(sessionInput(form({session_id:id,session_date:'2026-10-17',title:'회차',revision:2})).revision,2);for(const value of [{session_id:id,revision:0},{revision:1},{revision:-1},{revision:1.1},{session_id:'bad',revision:1}])assert.throws(()=>sessionInput(form({session_date:'2026-10-17',title:'회차',...value})));});
test('blank or long labels fail',()=>{for(const title of [' ','가'.repeat(81)])assert.throws(()=>sessionInput(form({session_date:'2026-10-17',title,revision:0})));});
test('dated attendance requires both attendance and participation versions',()=>{for(const attendance of ['attended','absent','no_show','unrecorded'])assert.equal(sessionAttendanceInput(form({session_id:id,attendance,revision:0,participation_revision:1})).attendance,attendance);for(const value of [{attendance:'paid'},{session_id:'bad'},{revision:-1},{participation_revision:0},{revision:0.5}])assert.throws(()=>sessionAttendanceInput(form({session_id:id,attendance:'attended',revision:0,participation_revision:1,...value})));});
