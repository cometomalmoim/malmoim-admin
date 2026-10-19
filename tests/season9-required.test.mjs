import {test} from 'node:test';
import assert from 'node:assert/strict';
import {season9RequiredFields,season9GenderChoices} from '../src/lib/season9-required.ts';
function fixture(){const data=new FormData();data.set('s9-gender','남성 / Male');data.set('s9-field-4',' 대학생 ');data.set('s9-answer-0',' 영어로 대화해보고 싶어요 ');return data;}
test('성별·직업·참여 이유를 필수로 받고 원래 성별 저장값을 유지한다',()=>{for(const choice of season9GenderChoices){const data=fixture();data.set('s9-gender',choice.value);const result=season9RequiredFields(data);assert.equal(result.gender,choice.value);assert.equal(result.occupation,'대학생');assert.equal(result.motivation,'영어로 대화해보고 싶어요');}});
test('누락·공백·잘못된 성별·길이 초과는 저장 전에 차단한다',()=>{for(const [key,value] of [['s9-gender',''],['s9-gender','unknown'],['s9-field-4','\t\n'],['s9-field-4','a'.repeat(201)],['s9-answer-0',' '],['s9-answer-0','a'.repeat(2001)]]){const data=fixture();data.set(key,value);assert.equal(season9RequiredFields(data),null,key);}});
