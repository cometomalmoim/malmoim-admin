import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
function load(path,requires={}){const module={exports:{}};runInNewContext(ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,TextEncoder,Intl,Date,require:n=>{if(n in requires)return requires[n];throw Error(n);}});return module.exports;}
const compose=load('../src/lib/messaging-templates.ts');
const m=load('../src/lib/event-sms.ts',{'./messaging-templates':compose});
const event={title:'한글 행사',starts_at:'2026-10-31T19:00:00+09:00',ends_at:'2026-10-31T23:30:00+09:00',location:'서울',fee_notice:'얼리버드 25,000원 · 일반 30,000원'};
test('입금과 승인 모두 필요하며 SMS 90 UTF8 bytes 경계 적용',()=>{assert.equal(m.defaultSmsCategory('accepted','paid'),'confirmation');assert.equal(m.defaultSmsCategory('accepted','unpaid'),'payment');assert.equal(m.defaultSmsCategory('received','paid'),'payment');assert.equal(m.smsMessageType('가'.repeat(30)),'SMS');assert.equal(m.smsMessageType('가'.repeat(31)),'LMS');});
test('모호한 가격을 자동 확정하지 않고 개별 금액 최우선',()=>{assert.equal(m.unambiguousFee(event.fee_notice),'');assert.equal(m.unambiguousFee('참가비 추후 안내'),'');assert.equal(m.unambiguousFee('30,000원'),'30,000원');const t={language:'ko',body:'{이름} {참가비} {종료시간}'};assert.ok(m.renderEventSms(t,event,'테스트',{},'').missing.includes('참가비'));const r=m.renderEventSms(t,event,'테스트',{'참가비':'30,000원'},'25,000원');assert.match(r.text,/25,000원/);assert.match(r.text,/11:30/);assert.equal(r.missing.length,0);});
test('한영 할로윈 4개 예시의 변수와 운영 일정 자동 치환',()=>{for(const t of m.halloweenSmsExamples){const r=m.renderEventSms(t,event,'Synthetic',{'은행':'토스','계좌번호':'000-TEST','예금주':'테스트','영문행사명':'Halloween'},'25,000 KRW');assert.equal(r.missing.length,0);assert.ok(!r.text.includes('{'));assert.ok(new TextEncoder().encode(r.text).length<=2000);assert.ok(r.text.includes('11:30'));if(t.language==='en')assert.match(r.text,/Halloween/);}});
test('신규 서버 액션은 비관리자를 DB/API 접근 전에 거부',async()=>{
 let touched=false;
 const actions=load('../src/app/actions/event-sms.ts',{'@/lib/auth':{getAdminAccess:async()=>({status:'forbidden'})},'@/lib/supabase/server':{createClient:()=>{touched=true;throw Error('must not connect');}},'@/lib/solapi':{},'@/lib/sms-contract':{},'@/lib/event-sms':m});
 for(const name of ['eventSmsData','saveEventSmsTemplate','saveEventSmsDetails','eventSmsVersions','prepareApplicantSms','cancelApplicantSms','eventSmsLogs','eventSmsHistory','prepareApplicantSmsBatch'])await assert.rejects(actions[name]({}),/관리자 권한/);
 assert.equal(touched,false);
});

test('edited payment notice snapshots use current applicant data and reject unpaid state',async()=>{
 const uid='11111111-1111-4111-8111-111111111111';
 let payment='paid',snapshot='',calls=0;
 const template={id:uid,event_id:uid,category:'custom',language:'ko',title:'입금 확인 안내',body:'원본',active:true};
 const db={from(table){let result;
  const rows={recruitment_events:{...event,id:uid,slug:'test'},event_sms_current:[template],event_sms_details:null,applicant_sms_details:null,event_application_admin_list:{name:'Synthetic',contact:'01000000000',contact_type:'phone',revision:1,status:'received',payment_status:payment},sms_jobs:{body:snapshot,message_type:'SMS',recipient:'01000000000'},sms_batches:{unit_price:10}};
  result={data:rows[table],error:null};
  const q={select(){return q;},eq(){return q;},single:async()=>result,maybeSingle:async()=>result,then(resolve,reject){return Promise.resolve(result).then(resolve,reject);}};return q;
 },rpc:async(_name,args)=>{calls++;snapshot=args.p_text;return {data:uid,error:null};}};
 const contract=load('../src/lib/sms-contract.ts');
 const actions=load('../src/app/actions/event-sms.ts',{'@/lib/auth':{getAdminAccess:async()=>({status:'admin'})},'@/lib/supabase/server':{createClient:async()=>db},'@/lib/solapi':{smsConfig:()=>({sender:'01000000000'}),smsPrice:async()=>({SMS:10,LMS:30}),maskPhone:()=> 'masked'},'@/lib/sms-contract':contract,'@/lib/event-sms':m});
 const input={batch:uid,event:uid,id:uid,source:'manual',template:uid,language:'ko',fee:'',resend:false,body:'{이름}: {행사명} 입금 확인',purpose:'payment_received'};
 const preview=await actions.prepareApplicantSms(input);assert.match(preview.text,/Synthetic/);assert.match(preview.text,/입금 확인/);assert.equal(calls,1);
 payment='unpaid';await assert.rejects(actions.prepareApplicantSms(input),/입금 완료/);assert.equal(calls,1);
 await assert.rejects(actions.prepareApplicantSms({...input,body:'가'.repeat(1000)}),/입력 오류/);assert.equal(calls,1);
});

const contract=load('../src/lib/sms-contract.ts');
const bulk=load('../src/lib/bulk-sms.ts',{'./sms-contract':contract,'./messaging-templates':compose});
test('bulk audience scopes event, removes duplicate phones and protects final confirmations',()=>{
 const row={id:'1',source:'manual',event_id:'e',name:'TEST',contact:'01000000001',contact_type:'phone',status:'accepted',payment_status:'paid'};
 const result=bulk.bulkSmsAudience([row,{...row,id:'2',contact:'+82 10-0000-0001'},{...row,id:'3',event_id:'other'},{...row,id:'4',contact_type:'instagram'},{...row,id:'5',contact:'01000000005',payment_status:'unpaid'}],'e','confirmation');
 assert.equal(result.eligible.length,1);assert.equal(result.excluded.length,4);
});
test('all starter templates use supported variables and explicit languages',()=>{
 for(const language of ['ko','en'])for(const template of bulk.smsStarterTemplates('e',language)){assert.equal(template.language,language);if(!template.body)continue;const text=m.renderEventSms(template,event,'TEST',{'참가비':'TEST FEE','은행':'TEST BANK','계좌번호':'TEST ACCOUNT','예금주':'TEST HOLDER'},'');assert.equal(text.missing.length,0,template.title);assert.ok(new TextEncoder().encode(text.text).length<=2000);}
});
test('bulk preparation shares one price lookup, preserves individual fees and does not approve or send',async()=>{
 const eventId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',templateId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333'];
 const apps=Object.fromEntries(ids.map((id,i)=>[id,{name:'TEST '+i,contact:i===1?'+821000000001':i===0?'01000000001':'01000000003',contact_type:'phone',revision:1,status:'accepted',payment_status:'unpaid'}]));
 const jobs=new Map(),calls=[];let prices=0;
 const template={id:templateId,category:'payment',language:'ko',active:true,body:'{이름}: {참가비}'};
 const db={from(table){const filters={};const result=()=>({data:table==='recruitment_events'?{...event,id:eventId}:table==='event_sms_current'?[template]:table==='event_sms_details'?null:table==='applicant_sms_details'?{fee:filters.application_id===ids[0]?'25,000원':'30,000원'}:table==='event_application_admin_list'?apps[filters.id]:table==='sms_jobs'?jobs.get(filters.batch_id):table==='sms_batches'?{unit_price:30}:null,error:null});const q={select(){return q;},eq(k,v){filters[k]=v;return q;},single:async()=>result(),maybeSingle:async()=>result(),then(resolve,reject){return Promise.resolve(result()).then(resolve,reject);}};return q;},rpc:async(name,args)=>{calls.push({name,args});if(name==='cancel_applicant_sms_preview')return {data:null,error:null};jobs.set(args.p_batch,{body:args.p_text,message_type:args.p_type,recipient:apps[args.p_app].contact});return {data:args.p_batch,error:null};}};
 const actions=load('../src/app/actions/event-sms.ts',{'@/lib/auth':{getAdminAccess:async()=>({status:'admin'})},'@/lib/supabase/server':{createClient:async()=>db},'@/lib/solapi':{smsConfig:()=>({sender:'01000000000'}),smsPrice:async()=>{prices++;return {SMS:10,LMS:30};},maskPhone:()=> 'masked'},'@/lib/sms-contract':contract,'@/lib/event-sms':m});
 const result=await actions.prepareApplicantSmsBatch({event:eventId,template:templateId,language:'ko',body:template.body,fee:'',resend:false,items:ids.map(id=>({id,source:'manual',batch:id}))});
 assert.equal(prices,1);assert.equal(result.ready.length,2);assert.equal(result.errors.length,1);assert.match(result.ready[0].text,/25,000원/);assert.match(result.ready[1].text,/30,000원/);assert.ok(calls.every(call=>['prepare_applicant_sms','cancel_applicant_sms_preview'].includes(call.name)));assert.equal(calls.filter(call=>call.name==='prepare_applicant_sms').length,2);
 await assert.rejects(actions.prepareApplicantSmsBatch({items:[]}),/최대 50명/);
});
