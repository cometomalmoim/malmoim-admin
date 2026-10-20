import {test} from 'node:test';
import assert from 'node:assert/strict';
import {languageStoredValue,languageLevelLabel} from '../src/lib/applicant-languages.ts';
test('언어별 모국어 필터는 기존 저장값을 정확하게 사용한다',()=>{
 assert.equal(languageStoredValue('korean','native'),'저는 한국 사람입니다 / I am Korean');
 assert.equal(languageStoredValue('english','native'),'모국어 / Native');
 assert.equal(languageStoredValue('english','basic'),'조금 가능 / Basic');
});
test('미입력은 별도 NULL 조회로 처리하고 임의 필터값은 저장값으로 만들지 않는다',()=>{
 assert.equal(languageStoredValue('korean','unknown'),undefined);
 assert.equal(languageStoredValue('english','invalid'),undefined);
});

test('목록 표는 수준을 짧게 표시하고 미입력·기존 원문을 보존한다',()=>{
 assert.equal(languageLevelLabel('korean',null),'미입력');
 assert.equal(languageLevelLabel('english','조금 가능 / Basic'),'기초');
 assert.equal(languageLevelLabel('korean','저는 한국 사람입니다 / I am Korean'),'모국어');
 assert.equal(languageLevelLabel('english','기존 답변'),'기존 답변');
});
