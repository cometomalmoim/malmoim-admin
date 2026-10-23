import {test} from 'node:test';
import assert from 'node:assert/strict';
import {safeApplicantListHref} from '../src/lib/applicant-list-memory.ts';
test('restores event, class, language and page filters without dropping search',()=>{
 const href='/admin/recruitment?event=abc&preferred_class=thursday&korean=native&q=test&page=2';
 assert.equal(safeApplicantListHref(href,true),href);
 assert.equal(safeApplicantListHref('/admin/events/season9/applicants?payment=unpaid&page=3'),'/admin/events/season9/applicants?payment=unpaid&page=3');
});
test('rejects external and non-list destinations, strips unrelated parameters',()=>{
 for(const value of [null,'https://evil.example','//evil.example','/admin/events/season9/overview','/admin/recruitment#token','/admin/../login'])assert.equal(safeApplicantListHref(value),null);
 assert.equal(safeApplicantListHref('/admin/events/season9/applicants',true),null);
 assert.equal(safeApplicantListHref('/admin/recruitment?q=test&token=secret&returnTo=https://evil.example'),'/admin/recruitment?q=test');
});
