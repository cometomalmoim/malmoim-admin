import {test} from 'node:test';
import assert from 'node:assert/strict';
import {reviewInput} from '../src/lib/review-validation.ts';
function fixture(){const data=new FormData();for(const [key,value] of Object.entries({id:'11111111-1111-4111-8111-111111111111',event:'22222222-2222-4222-8222-222222222222',revision:'0',name:'익명',locale:'ko',body:'실제 후기 원문',note:'운영 메모',order:'1'}))data.set(key,value);return data;}
test('후기는 기본 비공개이며 원문과 동의 확인 없이는 게시할 수 없다',()=>{const data=fixture();assert.equal(reviewInput(data).published,false);data.set('published','on');assert.equal(reviewInput(data),null);data.set('confirmed','on');assert.equal(reviewInput(data).published,true);});
test('후기 언어·내용 길이·순서·이벤트·리비전을 검증한다',()=>{for(const [key,value] of [['event','../event'],['locale','unknown'],['body',''],['body','a'.repeat(1001)],['order','-1'],['order','10000'],['revision','NaN'],['name',''],['note','a'.repeat(501)]]){const data=fixture();data.set(key,value);assert.equal(reviewInput(data),null,key);}});
