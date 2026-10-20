import {test} from 'node:test';
import assert from 'node:assert/strict';
import {season9RequiredFields,season9GenderChoices,season9ParticipationFields} from '../src/lib/season9-required.ts';
function fixture(){const data=new FormData();data.set('s9-gender','남성 / Male');data.set('s9-field-4',' 대학생 ');data.set('s9-answer-0',' 영어로 대화해보고 싶어요 ');return data;}
test('성별·직업·참여 이유를 필수로 받고 원래 성별 저장값을 유지한다',()=>{for(const choice of season9GenderChoices){const data=fixture();data.set('s9-gender',choice.value);const result=season9RequiredFields(data);assert.equal(result.gender,choice.value);assert.equal(result.occupation,'대학생');assert.equal(result.motivation,'영어로 대화해보고 싶어요');}});
test('누락·공백·잘못된 성별·길이 초과는 저장 전에 차단한다',()=>{for(const [key,value] of [['s9-gender',''],['s9-gender','unknown'],['s9-field-4','\t\n'],['s9-field-4','a'.repeat(201)],['s9-answer-0',' '],['s9-answer-0','a'.repeat(2001)]]){const data=fixture();data.set(key,value);assert.equal(season9RequiredFields(data),null,key);}});

test('두 언어와 참석 여부 필수: 일부 참석도 유효하고 누락·잘못된 값은 차단한다',()=>{
 const data=new FormData();data.set('s9-korean','저는 한국 사람입니다 / I am Korean');data.set('s9-english','조금 가능 / Basic');data.set('s9-attendance','no');
 assert.equal(season9ParticipationFields(data).fullAttendance,false);
 data.set('s9-attendance','yes');assert.equal(season9ParticipationFields(data).fullAttendance,true);
 for(const key of ['s9-korean','s9-english','s9-attendance']){const copy=new FormData();for(const [k,v] of data)copy.set(k,v);copy.set(key,'');assert.equal(season9ParticipationFields(copy),null);copy.set(key,'invalid');assert.equal(season9ParticipationFields(copy),null);}
});
