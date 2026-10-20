import {test} from 'node:test';
import assert from 'node:assert/strict';
import {wideApplicantResponse} from '../src/lib/applicant-response-layout.ts';
test('서술형 답변과 긴 원문은 전체 폭, 짧은 기본 정보는 묶음으로 표시한다',()=>{
 assert.equal(wideApplicantResponse('참여 동기','친구를 사귀고 싶어요'),true);
 assert.equal(wideApplicantResponse('기대 활동·추가 소개','보드게임'),true);
 assert.equal(wideApplicantResponse('국적','대한민국'),false);
 assert.equal(wideApplicantResponse('기타','가'.repeat(81)),true);
 assert.equal(wideApplicantResponse('기타','첫 줄\n둘째 줄'),true);
});
