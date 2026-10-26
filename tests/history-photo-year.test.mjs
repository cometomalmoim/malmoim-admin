import {test} from 'node:test';
import assert from 'node:assert/strict';
import {activityYear} from '../src/app/(public)/history/history-data.ts';
test('special activity year comes from calendar date rather than upload date or timezone',()=>{const rows=[{category:'special',date:'2025-12-20'},{category:'special',date:'2026-10-26'}];assert.deepEqual(rows.filter(r=>activityYear(r.date)==='2025').map(r=>r.date),['2025-12-20']);assert.deepEqual(rows.filter(r=>activityYear(r.date)==='2026').map(r=>r.date),['2026-10-26']);assert.equal(activityYear('2025-12-31'),'2025');assert.equal(activityYear('2026-01-01'),'2026');});
