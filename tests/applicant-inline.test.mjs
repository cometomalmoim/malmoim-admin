import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applicantEditData} from '../src/lib/applicant-inline.ts';
import {applicantInput} from '../src/lib/applicant-validation.ts';
const row={id:'00000000-0000-0000-0000-000000000001',source:'manual',revision:4,name:'가상 신청자',contact:'+821000000001',contact_type:'phone',birth_year:1998,nationality:'가상국적',status:'received',payment_status:'paid',internal_note:'보존 메모',source_note:'가상 전화 접수 근거'};
test('한 항목 수정 시 납부·메모·접수 근거·revision을 보존',()=>{
 const input=applicantInput(applicantEditData(row,'status','accepted'));
 assert.equal(input.status,'accepted');assert.equal(input.payment,'paid');assert.equal(input.revision,4);assert.equal(input.source_note,row.source_note);assert.equal(input.note,row.internal_note);assert.equal(input.name,row.name);
});
test('선택 필드 빈값 허용, 연락처 검증과 변경 불가 필드 차단',()=>{
 assert.equal(applicantInput(applicantEditData(row,'birth_year','')).birth_year,null);
 assert.throws(()=>applicantInput(applicantEditData(row,'contact','잘못된 번호')));
 assert.throws(()=>applicantEditData(row,'revision','0'));
});
