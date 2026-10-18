import {test} from 'node:test';import assert from 'node:assert/strict';import {participationInput,validId} from '../src/lib/participation-validation.ts';
function form(v={}){const d=new FormData();for(const [k,x]of Object.entries({confirmation:'confirmed',attendance:'attended',note:'가상 출석',revision:'1',...v}))d.set(k,x);return d;}
test('참가 확정과 출석은 별도 상태',()=>{assert.equal(participationInput(form()).attendance,'attended');assert.equal(participationInput(form({confirmation:'cancelled',attendance:'unrecorded'})).confirmation,'cancelled');});
test('미확정·취소 참석 기록 및 잘못된 버전 차단',()=>{for(const v of [{confirmation:'unconfirmed'},{confirmation:'cancelled'},{attendance:'paid'},{revision:'-1'},{revision:'1.5'},{note:'x'.repeat(2001)}])assert.throws(()=>participationInput(form(v)));});
test('신청자 식별자 검증',()=>{assert.equal(validId('11111111-1111-4111-8111-111111111111'),true);assert.equal(validId('../admin'),false);});
