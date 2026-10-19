import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inquiryInput,inquiryReplyInput,inquiryReceiptUrl,inquiryToken} from '../src/lib/inquiry-validation.ts';
const form=()=>{const data=new FormData();for(const [key,value] of Object.entries({event:'season9',token:'a'.repeat(64),name:'가상 문의자',subject:'요일 변경',content:'다른 요일에 참여 가능한가요?',consent:'on',locale:'ko'}))data.set(key,value);return data;};
test('문의 접수는 동의·유효한 비밀 토큰·제목·내용이 필요하다',()=>{
 assert.equal(inquiryInput(form()).slug,'season9');
 for(const [key,value] of [['consent',''],['token','known-id'],['name',''],['subject',''],['content',''],['content','a'.repeat(3001)],['website','spam'],['event','../admin']]){const data=form();data.set(key,value);assert.equal(inquiryInput(data),null,key);}
});
test('비밀 링크는 경로·쿼리에 토큰을 노출하지 않고 fragment로 전달한다',()=>{
 const url=new URL(inquiryReceiptUrl('a'.repeat(64)));assert.equal(url.search,'');assert.equal(url.pathname,'/inquiries/receipt');assert.equal(url.hash,'#token='+'a'.repeat(64));assert.equal(inquiryReceiptUrl('invalid'),'');assert.equal(inquiryToken('A'.repeat(64)),false);
});
test('답변 저장은 ID·리비전·내용을 검증한다',()=>{
 const data=new FormData();data.set('id','11111111-1111-4111-8111-111111111111');data.set('revision','2');data.set('body',' 답변입니다 ');assert.equal(inquiryReplyInput(data).body,'답변입니다');data.set('revision','-1');assert.equal(inquiryReplyInput(data),null);data.set('revision','2');data.set('body','');assert.equal(inquiryReplyInput(data),null);
});
