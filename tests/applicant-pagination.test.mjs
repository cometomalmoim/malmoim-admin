import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applicantPages} from '../src/lib/applicant-pagination.ts';
test('적은 페이지 전체 표시 및 빈 결과',()=>{
 assert.deepEqual(applicantPages(1,0),[]);
 assert.deepEqual(applicantPages(1,3),[1,2,3]);
});
test('긴 목록의 처음·현재·마지막과 건너뜀 표시',()=>{
 assert.deepEqual(applicantPages(5,10),[1,null,3,4,5,6,7,null,10]);
 assert.deepEqual(applicantPages(1,10),[1,2,3,null,10]);
 assert.deepEqual(applicantPages(99,10),[1,null,8,9,10]);
});
