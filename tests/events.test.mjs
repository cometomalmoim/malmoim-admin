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

test('참가비는 자동 입력 없이 미정·무료·관리자 입력 금액을 구분한다',()=>{
 assert.equal(eventInput(form()).fee_amount_krw,null);
 assert.equal(eventInput(form({fee_amount_krw:'0'})).fee_amount_krw,0);
 assert.equal(eventInput(form({fee_amount_krw:'37500'})).fee_amount_krw,37500);
 for(const fee_amount_krw of ['-1','1.5','1e3','50,000','2147483648'])assert.throws(()=>eventInput(form({fee_amount_krw})));
});

test('입금 안내와 한국시간 납부 기한을 저장하고 비울 수 있다',()=>{
 const result=eventInput(form({payment_method:' 계좌 이체 ',payment_bank_name:'테스트은행',payment_account_number:'001-0123',payment_account_holder:'운영팀',payment_due_at:'2026-10-31T18:30',payment_notice:'첫 줄\n둘째 줄'}));
 assert.equal(result.payment_method,'계좌 이체');assert.equal(result.payment_bank_name,'테스트은행');
 assert.equal(result.payment_account_number,'001-0123');assert.equal(result.payment_account_holder,'운영팀');
 assert.equal(eventLocalDate(result.payment_due_at),'2026-10-31T18:30');assert.equal(result.payment_notice,'첫 줄\n둘째 줄');
 assert.equal(eventInput(form({payment_due_at:''})).payment_due_at,null);
 for(const payment_due_at of ['2026-02-30T12:00','invalid'])assert.throws(()=>eventInput(form({payment_due_at})));
 for(const [key,max] of [['payment_method',80],['payment_bank_name',100],['payment_account_number',100],['payment_account_holder',100],['payment_notice',2000]])assert.throws(()=>eventInput(form({[key]:'x'.repeat(max+1)})));
});

test('기존 이벤트 참가비 반복 저장은 같은 행만 갱신하고 관리자 권한을 확인한다',async()=>{
 const {readFile}=await import('node:fs/promises');
 const {stripTypeScriptTypes}=await import('node:module');
 const {compileFunction}=await import('node:vm');
 const source=stripTypeScriptTypes(await readFile(new URL('../src/app/actions/events.ts',import.meta.url),'utf8')).replace(/^import .*;$/gm,'').replace(/^export /gm,'');
 let admin=true;const updates=[];const invalidated=[];
 const client={
  from(table){
   assert.equal(table,'recruitment_events');
   return {
    update(input){
     return {
      eq(key,id){
       updates.push({input,key,id});
       return {select:()=>({single:async()=>({data:{slug:'example'},error:null})})};
      }
     };
    },
    insert(){assert.fail('기존 이벤트에 새 행을 생성하면 안 됩니다.');}
   };
  }
 };
 const save=compileFunction(source+'\nreturn saveEvent;', ['getAdminAccess','createClient','eventInput','revalidatePath'])(async()=>({status:admin?'admin':'denied'}),async()=>client,eventInput,(...args)=>invalidated.push(args));
 const id='12345678-1234-1234-1234-123456789abc';
 for(const fee_amount_krw of ['37500','42000','']){
  const result=await save({},form({id,fee_amount_krw}));assert.equal(result.slug,'example');
 }
 assert.deepEqual(updates.map(({input,key,id:actualId})=>[input.fee_amount_krw,key,actualId]),[[37500,'id',id],[42000,'id',id],[null,'id',id]]);
 assert.equal(invalidated.length,3);
 admin=false;assert.equal((await save({},form({id}))).slug,undefined);assert.equal(updates.length,3);
});
