import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initializeMeta,metaPageView,isMetaLanding,META_PIXEL_ID} from '../src/lib/meta-pixel.ts';
test('운영 4개 랜딩만 허용하고 관리자·신청·미리보기·로컬 제외',()=>{
 for(const path of ['/season9','/season9/en','/2026halloweenparty','/2026halloweenparty/en'])assert.ok(isMetaLanding(path,'malmoim.com'));
 for(const path of ['/','/admin','/login','/season9/apply','/preview/admin','/season90'])assert.equal(isMetaLanding(path,'malmoim.com'),false);
 for(const host of ['admin.malmoim.com','localhost','example.vercel.app','malmoim.com.attacker.test'])assert.equal(isMetaLanding('/season9',host),false);
});
test('추적 비활성 경로에서는 초기화·조회 전송 없음',()=>{const w={};metaPageView(w,'/season9','malmoim.com',false);assert.equal(w.fbq,undefined);assert.equal(w.malmoimMetaInitialized,undefined);});
test('한 번 초기화·자동 수집 해제·명시적 PageView만 전송하며 반복 렌더 중복 제외',()=>{
 const w={};initializeMeta(w);initializeMeta(w);w.malmoimMetaReady=true;metaPageView(w,'/season9','malmoim.com',true);metaPageView(w,'/season9','malmoim.com',true);
 const q=w.fbq.queue;assert.equal(q.filter(v=>v[0]==='init').length,1);assert.deepEqual(q.find(v=>v[0]==='set'),['set','autoConfig',false,META_PIXEL_ID]);assert.deepEqual(q.filter(v=>v[0]==='trackSingle'),[['trackSingle',META_PIXEL_ID,'PageView']]);
 metaPageView(w,'/season9/en','malmoim.com',true);assert.equal(q.filter(v=>v[0]==='trackSingle').length,2);
 metaPageView(w,'/admin','malmoim.com',true);assert.deepEqual(q.at(-1),['consent','revoke']);assert.equal(q.filter(v=>v[0]==='trackSingle').length,2);
});
test('추적 비활성화 시 이벤트 중지, 개인정보나 Lead/Purchase 매개변수 없음',()=>{const w={};initializeMeta(w);w.malmoimMetaReady=true;metaPageView(w,'/2026halloweenparty','malmoim.com',true);metaPageView(w,'/2026halloweenparty','malmoim.com',false);assert.deepEqual(w.fbq.queue.at(-1),['consent','revoke']);for(const event of w.fbq.queue.filter(v=>v[0]==='trackSingle'))assert.deepEqual(event,['trackSingle',META_PIXEL_ID,'PageView']);});

test('SDK 준비 전 또는 추적 비활성화 시 PageView 미전송',()=>{const w={};initializeMeta(w);metaPageView(w,'/season9','malmoim.com',true);assert.equal(w.fbq.queue.filter(v=>v[0]==='trackSingle').length,0);metaPageView(w,'/season9','malmoim.com',false);w.malmoimMetaReady=true;metaPageView(w,'/season9','malmoim.com',false);assert.equal(w.fbq.queue.filter(v=>v[0]==='trackSingle').length,0);});

test('Meta 초기화·조회 예외가 페이지 UI로 전파되지 않음',()=>{const w={fbq:()=>{throw Error('blocked');}};assert.doesNotThrow(()=>initializeMeta(w));w.malmoimMetaInitialized=true;w.malmoimMetaReady=true;assert.doesNotThrow(()=>metaPageView(w,'/season9','malmoim.com',true));});
