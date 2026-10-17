import assert from 'node:assert/strict';
import {test} from 'node:test';
import {surveyPeriod, surveyResponseInput} from '../src/lib/survey-validation.ts';

function form(values={}) {
 const data=new FormData();
 for(const [key,value] of Object.entries({group:'korean',satisfaction:'5',liked_aspects:['language_growth'],study_feedback:'',activity_feedback:'',other_feedback:'',...values})) {
  if(Array.isArray(value)) for(const item of value)data.append(key,item); else data.set(key,value);
 }
 return data;
}

test('required response fields and optional feedback are normalized',()=>{
 const result=surveyResponseInput(form({group:'international',satisfaction:'4',liked_aspects:['varied_activities','mutual_learning'],study_feedback:'  helpful  '}));
 assert.equal(result.group,'international');assert.equal(result.satisfaction,4);assert.deepEqual(result.likedAspects,['varied_activities','mutual_learning']);assert.equal(result.studyFeedback,'helpful');assert.equal(result.otherFeedback,'');
});

test('rejects invalid group, satisfaction, choices, duplicate choices and exclusive none',()=>{
 for(const values of [{group:'other'},{satisfaction:'0'},{satisfaction:'5.5'},{liked_aspects:[]},{liked_aspects:['unknown']},{liked_aspects:['none','language_growth']},{liked_aspects:['language_growth','language_growth']}]) assert.throws(()=>surveyResponseInput(form(values)));
});

test('optional text is accepted but bounded',()=>{
 assert.equal(surveyResponseInput(form()).studyFeedback,'');
 assert.throws(()=>surveyResponseInput(form({other_feedback:'x'.repeat(3001)})));
});

test('period requires valid dates with close after open',()=>{
 const period=surveyPeriod('2026-10-17T09:00','2026-10-24T09:00');
 assert.equal(Date.parse(period.closesAt)-Date.parse(period.opensAt),7*24*60*60*1000);
 assert.equal(period.opensAt,'2026-10-17T00:00:00.000Z');
 assert.throws(()=>surveyPeriod('bad','2026-10-24T09:00'));
 assert.throws(()=>surveyPeriod('2026-02-30T09:00','2026-03-02T09:00'));
 assert.throws(()=>surveyPeriod('2026-10-24T09:00','2026-10-17T09:00'));
});
