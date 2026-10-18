import {test} from 'node:test';
import assert from 'node:assert/strict';
import {messagingTemplates,composeMessaging} from '../src/lib/messaging-templates.ts';

test('7종 안내 템플릿은 고유하며 모든 변수가 치환된다',()=>{
 assert.equal(new Set(messagingTemplates.map(t=>t.id)).size,7);
 const values={'이름':'가상 A','이벤트명':'할로윈','일정':'한국 시간 일정','장소':'행사장','참가비안내':'운영진 안내','납부기한':'확인한 기한','문의처':'운영진'};
 for(const template of messagingTemplates){const result=composeMessaging(template.body,values);assert.equal(result.empty,false);assert.deepEqual(result.missing,[]);assert.ok(result.text.includes('가상 A'));assert.ok(result.text.includes('할로윈'));assert.equal(result.text.includes('{'),false);}
});
test('미입력·지원하지 않는 변수는 보존하고 빠진 항목을 알린다',()=>{
 const result=composeMessaging('{이름} {문의처} {모르는변수} {문의처}',{'이름':'가상 A','문의처':' '});
 assert.deepEqual(result.missing,['문의처','모르는변수']);assert.equal(result.text,'가상 A {문의처} {모르는변수} {문의처}');
 assert.equal(composeMessaging(' ',{}).empty,true);
});
test('이벤트 전환 시 원본 템플릿을 기준으로 새 정보가 반영된다',()=>{
 const template='{이름} {이벤트명} {장소}';
 assert.equal(composeMessaging(template,{'이름':'예시','이벤트명':'A','장소':'서울'}).text,'예시 A 서울');
 assert.equal(composeMessaging(template,{'이름':'예시','이벤트명':'B','장소':'부산'}).text,'예시 B 부산');
});
test('환불 기본 안내는 환불 완료·금액을 확정하지 않는다',()=>{
 const body=messagingTemplates.find(t=>t.id==='refund').body;
 assert.ok(body.includes('요청이 접수'));assert.equal(body.includes('환불 완료'),false);assert.equal(body.includes('원'),false);
});
