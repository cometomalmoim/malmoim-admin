import assert from 'node:assert/strict';
import { test } from 'node:test';
import { eventInput, eventLocalDate } from '../src/lib/event-validation.ts';
function form(overrides={}) {
 const values={title:'테스트 행사',description:'소개',location:'서울',starts_at:'2026-11-01T19:00',ends_at:'2026-11-01T22:00',opens_at:'2026-10-15T09:00',closes_at:'2026-10-31T23:59',capacity:'30',...overrides};
 const data=new FormData();for(const [key,value] of Object.entries(values))data.set(key,value);return data;
}
test('한국시간 저장과 편집 값의 왕복 변환',()=>{
 const result=eventInput(form());assert.equal(result.starts_at,'2026-11-01T10:00:00.000Z');assert.equal(eventLocalDate(result.starts_at),'2026-11-01T19:00');assert.equal(result.capacity,30);
});
test('필수 정보와 불가능한 날짜 거부',()=>{
 for(const input of [{title:' '},{location:''},{starts_at:'2026-02-30T19:00'},{opens_at:'bad'},{title:'x'.repeat(151)}])assert.throws(()=>eventInput(form(input)));
});
test('행사와 모집 기간 역전 및 행사 이후 마감 거부',()=>{
 for(const input of [{ends_at:'2026-11-01T18:00'},{closes_at:'2026-10-15T09:00'},{closes_at:'2026-11-02T10:00'}])assert.throws(()=>eventInput(form(input)));
});
test('정원은 선택 정수, 이미지 주소는 인증정보 없는 HTTPS만 허용',()=>{
 assert.equal(eventInput(form({capacity:''})).capacity,null);
 for(const capacity of ['0','-1','1.5','100001','1e2'])assert.throws(()=>eventInput(form({capacity})));
 for(const image_url of ['javascript:alert(1)','http://example.com/x','https://user:pass@example.com/x'])assert.throws(()=>eventInput(form({image_url})));
 assert.equal(eventInput(form({image_url:'https://example.com/a.jpg'})).image_url,'https://example.com/a.jpg');
});
test('초안 모집 기간은 미정 가능, 한쪽만 지정하거나 잘못된 스타일은 거부',()=>{
 const result=eventInput(form({opens_at:'',closes_at:'',visual_theme:'halloween'}));
 assert.equal(result.opens_at,null);assert.equal(result.closes_at,null);assert.equal(result.visual_theme,'halloween');
 assert.throws(()=>eventInput(form({opens_at:''})));
 assert.throws(()=>eventInput(form({closes_at:''})));
 assert.throws(()=>eventInput(form({visual_theme:'untrusted'})));
 assert.equal(eventInput(form()).visual_theme,'default');
});
