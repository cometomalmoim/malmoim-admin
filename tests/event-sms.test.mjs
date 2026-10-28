import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
function load(path,requires={}){const module={exports:{}};runInNewContext(ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,TextEncoder,Intl,Date,require:n=>{if(n in requires)return requires[n];throw Error(n);}});return module.exports;}
const purpose=load('../src/lib/sms-purpose.ts');
const preparationErrors=load('../src/lib/sms-preparation-error.ts');
const paymentNotice=load('../src/lib/payment-notice.ts');
const compose=load('../src/lib/messaging-templates.ts');
const m=load('../src/lib/event-sms.ts',{'./messaging-templates':compose});
const event={title:'한글 행사',starts_at:'2026-10-31T19:00:00+09:00',ends_at:'2026-10-31T23:30:00+09:00',location:'서울',fee_notice:'얼리버드 25,000원 · 일반 30,000원'};
test('입금과 승인 모두 필요하며 SMS 90 UTF8 bytes 경계 적용',()=>{assert.equal(m.defaultSmsCategory('accepted','paid'),'confirmation');assert.equal(m.defaultSmsCategory('accepted','unpaid'),'payment');assert.equal(m.defaultSmsCategory('received','paid'),'payment');assert.equal(m.smsMessageType('가'.repeat(30)),'SMS');assert.equal(m.smsMessageType('가'.repeat(31)),'LMS');});
test('모호한 가격을 자동 확정하지 않고 개별 금액 최우선',()=>{assert.equal(m.unambiguousFee(event.fee_notice),'');assert.equal(m.unambiguousFee('참가비 추후 안내'),'');assert.equal(m.unambiguousFee('30,000원'),'30,000원');const t={language:'ko',body:'{이름} {참가비} {종료시간}'};assert.ok(m.renderEventSms(t,event,'테스트',{},'').missing.includes('참가비'));const r=m.renderEventSms(t,event,'테스트',{'참가비':'30,000원'},'25,000원');assert.match(r.text,/25,000원/);assert.match(r.text,/11:30/);assert.equal(r.missing.length,0);});
test('한영 할로윈 4개 예시의 변수와 운영 일정 자동 치환',()=>{for(const t of m.halloweenSmsExamples){const r=m.renderEventSms(t,event,'Synthetic',{'은행':'토스','계좌번호':'000-TEST','예금주':'테스트','영문행사명':'Halloween','영문장소':'Seoul','영문은행':'Test Bank','영문예금주':'Test Holder'},'25,000 KRW');assert.equal(r.missing.length,0);assert.ok(!r.text.includes('{'));assert.ok(new TextEncoder().encode(r.text).length<=2000);assert.ok(r.text.includes('11:30'));if(t.language==='en')assert.match(r.text,/Halloween/);}});
test('신규 서버 액션은 비관리자를 DB/API 접근 전에 거부',async()=>{
 let touched=false;
 const actions=load('../src/app/actions/event-sms.ts',{'@/lib/season9-sms-templates':classes,'@/lib/sms-purpose':purpose,'@/lib/auth':{getAdminAccess:async()=>({status:'forbidden'})},'@/lib/supabase/server':{createClient:()=>{touched=true;throw Error('must not connect');}},'@/lib/solapi':{},'@/lib/sms-contract':{},'@/lib/sms-preparation-error':preparationErrors,'@/lib/payment-notice':paymentNotice,'@/lib/event-sms':m});
 for(const name of ['eventSmsData','saveEventSmsTemplate','saveEventSmsDetails','eventSmsVersions','prepareApplicantSms','cancelApplicantSms','eventSmsLogs','eventSmsHistory','prepareApplicantSmsBatch','failedSmsApplicants','resolveApplicantSmsDraft','smsBatchOutcomes'])await assert.rejects(actions[name]({}),/관리자 권한/);
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
 const actions=load('../src/app/actions/event-sms.ts',{'@/lib/season9-sms-templates':classes,'@/lib/sms-purpose':purpose,'@/lib/auth':{getAdminAccess:async()=>({status:'admin'})},'@/lib/supabase/server':{createClient:async()=>db},'@/lib/solapi':{smsConfig:()=>({sender:'01000000000'}),smsPrice:async()=>({SMS:10,LMS:30}),maskPhone:()=> 'masked'},'@/lib/sms-contract':contract,'@/lib/sms-preparation-error':preparationErrors,'@/lib/payment-notice':paymentNotice,'@/lib/event-sms':m});
 const input={batch:uid,event:uid,id:uid,source:'manual',template:uid,language:'ko',fee:'',resend:false,body:'{이름}: {행사명} 입금 확인',purpose:'payment_received'};
 const preview=await actions.prepareApplicantSms(input);assert.match(preview.text,/Synthetic/);assert.match(preview.text,/입금 확인/);assert.equal(calls,1);
 template.title='입금 요청';await assert.rejects(actions.prepareApplicantSms(input),/안내 템플릿/);assert.equal(calls,1);template.title='입금 확인 안내';
 payment='unpaid';await assert.rejects(actions.prepareApplicantSms(input),/입금 완료/);assert.equal(calls,1);
 await assert.rejects(actions.prepareApplicantSms({...input,body:'가'.repeat(1000)}),/입력 오류/);assert.equal(calls,1);
});

const contract=load('../src/lib/sms-contract.ts');
const bulk=load('../src/lib/bulk-sms.ts',{'./sms-contract':contract,'./messaging-templates':compose});
const classes=load('../src/lib/season9-sms-templates.ts',{'./bulk-sms':bulk});
test('bulk audience scopes event, removes duplicate phones and protects final confirmations',()=>{
 const row={id:'1',source:'manual',event_id:'e',name:'TEST',contact:'01000000001',contact_type:'phone',status:'accepted',payment_status:'paid'};
 const result=bulk.bulkSmsAudience([row,{...row,id:'2',contact:'+82 10-0000-0001'},{...row,id:'3',event_id:'other'},{...row,id:'4',contact_type:'instagram'},{...row,id:'5',contact:'01000000005',payment_status:'unpaid'}],'e','confirmation');
 assert.equal(result.eligible.length,1);assert.equal(result.excluded.length,4);
});
test('all starter templates use supported variables and explicit languages',()=>{
 for(const language of ['ko','en'])for(const template of bulk.smsStarterTemplates('e',language)){assert.equal(template.language,language);if(!template.body)continue;const text=m.renderEventSms(template,event,'TEST',{'영문행사명':'Test Event','영문장소':'Seoul','참가비':'TEST FEE','은행':'TEST BANK','계좌번호':'TEST ACCOUNT','예금주':'TEST HOLDER'},'');assert.equal(text.missing.length,0,template.title);assert.ok(new TextEncoder().encode(text.text).length<=2000);}
});
test('bulk preparation shares one price lookup, preserves individual fees and does not approve or send',async()=>{
 const eventId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',templateId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333'];
 const apps=Object.fromEntries(ids.map((id,i)=>[id,{name:'TEST '+i,contact:i===1?'+821000000001':i===0?'01000000001':'01000000003',contact_type:'phone',revision:1,status:'accepted',payment_status:'unpaid'}]));
 const jobs=new Map(),calls=[];let prices=0;
 const template={id:templateId,category:'payment',language:'ko',active:true,body:'{이름}: {참가비}'};
 const db={from(table){const filters={};const result=()=>({data:table==='recruitment_events'?{...event,id:eventId}:table==='event_sms_current'?[template]:table==='event_sms_details'?null:table==='applicant_sms_details'?{fee:filters.application_id===ids[0]?'25,000원':'30,000원'}:table==='event_application_admin_list'?apps[filters.id]:table==='sms_jobs'?jobs.get(filters.batch_id):table==='sms_batches'?{unit_price:30}:null,error:null});const q={select(){return q;},eq(k,v){filters[k]=v;return q;},single:async()=>result(),maybeSingle:async()=>result(),then(resolve,reject){return Promise.resolve(result()).then(resolve,reject);}};return q;},rpc:async(name,args)=>{calls.push({name,args});if(name==='cancel_applicant_sms_preview')return {data:null,error:null};jobs.set(args.p_batch,{body:args.p_text,message_type:args.p_type,recipient:apps[args.p_app].contact});return {data:args.p_batch,error:null};}};
 const actions=load('../src/app/actions/event-sms.ts',{'@/lib/season9-sms-templates':classes,'@/lib/sms-purpose':purpose,'@/lib/auth':{getAdminAccess:async()=>({status:'admin'})},'@/lib/supabase/server':{createClient:async()=>db},'@/lib/solapi':{smsConfig:()=>({sender:'01000000000'}),smsPrice:async()=>{prices++;return {SMS:10,LMS:30};},maskPhone:()=> 'masked'},'@/lib/sms-contract':contract,'@/lib/sms-preparation-error':preparationErrors,'@/lib/payment-notice':paymentNotice,'@/lib/event-sms':m});
 const result=await actions.prepareApplicantSmsBatch({event:eventId,template:templateId,language:'ko',body:template.body,fee:'',resend:false,items:ids.map(id=>({id,source:'manual',batch:id}))});
 assert.equal(prices,1);assert.equal(result.ready.length,2);assert.equal(result.errors.length,1);assert.match(result.ready[0].text,/25,000원/);assert.match(result.ready[1].text,/30,000원/);assert.ok(calls.every(call=>['prepare_applicant_sms','cancel_applicant_sms_preview'].includes(call.name)));assert.equal(calls.filter(call=>call.name==='prepare_applicant_sms').length,2);
 await assert.rejects(actions.prepareApplicantSmsBatch({items:[]}),/최대 50명/);
});





test('failed retry targets are reloaded from failed jobs and active applicants without sending',async()=>{
 const uid='11111111-1111-4111-8111-111111111111';let failedFilter=false;let writes=0;
 const db={from(table){const q={select(){return q;},in(){return q;},eq(key,value){if(table==='sms_jobs'&&key==='state'&&value==='failed')failedFilter=true;return q;},maybeSingle:async()=>({error:null,data:table==='recruitment_events'?{title:'TEST'}:{id:uid,source:'manual',event_id:uid,name:'TEST',contact:'01000000001',contact_type:'phone',status:'accepted',payment_status:'paid'}}),then(resolve){return Promise.resolve({error:null,data:[{event_id:uid,application_id:uid,application_source:'manual'}]}).then(resolve);}};return q;},rpc(){writes++;throw Error('must not write');}};
 const actions=load('../src/app/actions/event-sms.ts',{'@/lib/season9-sms-templates':classes,'@/lib/sms-purpose':purpose,'@/lib/auth':{getAdminAccess:async()=>({status:'admin'})},'@/lib/supabase/server':{createClient:async()=>db},'@/lib/solapi':{},'@/lib/sms-contract':contract,'@/lib/sms-preparation-error':preparationErrors,'@/lib/payment-notice':paymentNotice,'@/lib/event-sms':m});
 const rows=await actions.failedSmsApplicants([uid]);assert.equal(failedFilter,true);assert.equal(writes,0);assert.equal(rows.length,1);assert.equal(rows[0].event_title,'TEST');await assert.rejects(actions.failedSmsApplicants([]),/실패 문자/);
});


test('prepare errors identify blockers without allowing unknown or other-owner cancellation',()=>{
 const issue=preparationErrors.smsPreparationIssue;
 for(const [state,own,expected] of [['draft',true,'draft'],['draft',false,'other_draft'],['unknown',true,'unknown'],['accepted',true,'awaiting_delivery'],['queued',true,'in_progress'],['dispatching',true,'in_progress']])assert.equal(issue('pending_or_unknown',[{state,own}]).code,expected);
 assert.equal(issue('pending_or_unknown',[{state:'draft',own:true},{state:'unknown',own:true}]).code,'unknown');
 for(const [raw,code] of [['recipient_changed','recipient_changed'],['template_changed','template_changed'],['payment_required','payment_required'],['resend_confirmation_required','resend_required'],['invalid_event','invalid_event']])assert.equal(issue(raw).code,code);
 assert.equal(issue('private database error').code,'unavailable');assert.ok(!issue('private database error').message.includes('private'));
});

test('refund notice requires explicit confirmation and records it before using the updated revision',async()=>{
 const uid='11111111-1111-4111-8111-111111111111';let revision=1,note='',prepared=0,conflict=false,payment='refunded';
 const template={id:uid,category:'custom',title:'환불 완료 안내',active:true,language:'ko',body:'{이름}님 환불 완료'};
 const db={from(table){const result=()=>({error:null,data:table==='recruitment_events'?{...event,id:uid,slug:'test'}:table==='event_sms_current'?[template]:table==='event_application_admin_list'?{name:'TEST',contact:'01000000001',contact_type:'phone',birth_year:null,nationality:'',status:'accepted',payment_status:payment,internal_note:note,source_note:'test',revision}:table==='sms_jobs'?{body:'TEST님 환불 완료',message_type:'SMS',recipient:'01000000001'}:table==='sms_batches'?{unit_price:10}:null});const q={select(){return q;},eq(){return q;},single:async()=>result(),maybeSingle:async()=>result(),then(resolve){return Promise.resolve(result()).then(resolve);}};return q;},rpc:async(name,args)=>{if(name==='manage_event_application'){assert.equal(args.p_payment,'refunded');if(conflict)return {data:{code:'conflict'},error:null};note=args.p_note;revision++;return {data:{code:'saved'},error:null};}assert.equal(name,'prepare_applicant_sms');assert.equal(args.p_revision,revision);prepared++;return {data:uid,error:null};}};
 const actions=load('../src/app/actions/event-sms.ts',{'@/lib/season9-sms-templates':classes,'@/lib/sms-purpose':purpose,'@/lib/auth':{getAdminAccess:async()=>({status:'admin'})},'@/lib/supabase/server':{createClient:async()=>db},'@/lib/solapi':{smsConfig:()=>({sender:'01000000000'}),smsPrice:async()=>({SMS:10,LMS:30}),maskPhone:()=> 'masked'},'@/lib/sms-contract':contract,'@/lib/sms-preparation-error':preparationErrors,'@/lib/payment-notice':paymentNotice,'@/lib/event-sms':m});
 const input={batch:uid,event:uid,id:uid,source:'manual',template:uid,language:'ko',fee:'',resend:false,body:template.body,purpose:'refund_completed'};
 await assert.rejects(actions.prepareApplicantSms(input),/환불 완료 확인/);assert.equal(prepared,0);assert.equal(note,'');
 await assert.rejects(actions.prepareApplicantSms({...input,purpose:undefined}),/환불 완료 확인/);
 await actions.prepareApplicantSms({...input,refundConfirmed:true});assert.match(note,/운영진이 실제 환불 완료를 확인함/);assert.equal(prepared,1);assert.equal(revision,2);
 await actions.prepareApplicantSms({...input,refundConfirmed:true});assert.equal(revision,2);
 payment='paid';await assert.rejects(actions.prepareApplicantSms({...input,refundConfirmed:true}),/환불 완료 확인/);
 payment='refunded';note='';conflict=true;await assert.rejects(actions.prepareApplicantSms({...input,refundConfirmed:true}),/다른 운영진/);assert.equal(prepared,2);
});

test('completion labels distinguish provider acceptance from actual delivery',()=>{
 assert.match(contract.smsStates.accepted,/발송 완료.*확인 중/);assert.match(contract.smsStates.delivered,/발송 완료.*도달 성공/);
 for(const state of ['draft','queued','dispatching','failed','unknown','cancelled'])assert.ok(!contract.smsStates[state].includes('발송 완료'));
});


test('draft recovery cancels only current admin drafts for the selected applicant',async()=>{
 const uid='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';let owner=uid;const cancelled=[],filters={};
 const db={auth:{getUser:async()=>({data:{user:{id:uid}}})},from(){const q={select(){return q;},eq(key,value){filters[key]=value;return q;},not(){return q;},then(resolve){return Promise.resolve({data:[{batch_id:other,sms_batches:{created_by:owner}}],error:null}).then(resolve);}};return q;},rpc:async(name,args)=>{assert.equal(name,'cancel_applicant_sms_preview');cancelled.push(args.p_batch);return {error:null};}};
 const actions=load('../src/app/actions/event-sms.ts',{'@/lib/season9-sms-templates':classes,'@/lib/sms-purpose':purpose,'@/lib/auth':{getAdminAccess:async()=>({status:'admin'})},'@/lib/supabase/server':{createClient:async()=>db},'@/lib/solapi':{},'@/lib/sms-contract':contract,'@/lib/sms-preparation-error':preparationErrors,'@/lib/payment-notice':paymentNotice,'@/lib/event-sms':m});
 await actions.resolveApplicantSmsDraft({event:uid,source:'manual',id:uid});assert.equal(filters.state,'draft');assert.equal(filters.event_id,uid);assert.equal(filters.application_id,uid);assert.equal(cancelled.length,1);
 owner=other;await assert.rejects(actions.resolveApplicantSmsDraft({event:uid,source:'manual',id:uid}),/다른 운영진/);assert.equal(cancelled.length,1);
});


test('result totals never label queued or unverified outcomes completed',()=>{
 const {smsResultSummary}=load('../src/lib/sms-result.ts');
 const result=smsResultSummary(['accepted','delivered','queued','dispatching','unknown','unverified','failed','cancelled'].map(state=>({state})));
 assert.equal(result.completed,2);assert.equal(result.waiting,4);assert.equal(result.failed,2);
});

test('batch outcome lookup validates selection, masks phones and performs no writes',async()=>{
 const uid='11111111-1111-4111-8111-111111111111';let writes=0;
 const db={from(){const q={select(){return q;},in(key,items){assert.equal(key,'batch_id');assert.equal(items[0],uid);return q;},limit:async()=>({data:[{id:uid,batch_id:uid,applicant_name:'TEST',recipient:'01012345678',body:'TEST',state:'accepted',failure_reason:null}],error:null})};return q;},rpc(){writes++;throw Error('must not write');}};
 const actions=load('../src/app/actions/event-sms.ts',{'@/lib/season9-sms-templates':classes,'@/lib/sms-purpose':purpose,'@/lib/auth':{getAdminAccess:async()=>({status:'admin'})},'@/lib/supabase/server':{createClient:async()=>db},'@/lib/solapi':{maskPhone:()=> 'masked'},'@/lib/sms-contract':contract,'@/lib/sms-preparation-error':preparationErrors,'@/lib/payment-notice':paymentNotice,'@/lib/event-sms':m});
 const result=await actions.smsBatchOutcomes([uid]);assert.equal(result[0].state,'accepted');assert.equal(result[0].to,'masked');assert.equal(writes,0);await assert.rejects(actions.smsBatchOutcomes([]),/선택/);
});


test('functional notice audiences exclude unverified payment and refund states',()=>{
 const row={id:'1',source:'manual',event_id:'e',name:'TEST',contact:'01000000001',contact_type:'phone',status:'accepted',payment_status:'unknown'};
 assert.equal(bulk.bulkSmsAudience([row],'e','payment_received').eligible.length,0);
 assert.equal(bulk.bulkSmsAudience([{...row,payment_status:'paid'}],'e','payment_received').eligible.length,1);
 assert.equal(bulk.bulkSmsAudience([row],'e','refund_completed').eligible.length,0);
 assert.equal(bulk.bulkSmsAudience([{...row,payment_status:'refunded'}],'e','refund_completed').eligible.length,1);
});


test('message categories classify purpose rather than template versions',()=>{
 for(const [template,expected] of [[{category:'custom',title:'입금 확인 안내'},'payment'],[{category:'custom',title:'Refund completed'},'refund'],[{category:'custom',title:'불합격 안내'},'selection'],[{category:'confirmation',title:'Final confirmation'},'selection'],[{category:'receipt',title:'신청 접수'},'receipt'],[{category:'reminder',title:'리마인드'},'event'],[{category:'custom',title:'자유 문자'},'direct']])assert.equal(purpose.smsTemplatePurpose(template),expected);
});

test('season9 class templates keep Saturday dates separate from the Thursday event schedule',()=>{
 const templates=classes.season9ClassSmsTemplates('e');assert.equal(templates.length,16);assert.equal(new Set(templates.map(t=>t.title+':'+t.language)).size,16);
 for(const template of templates){
 const text=m.renderEventSms(template,{...event,starts_at:'2026-11-05T18:30:00+09:00'},'TEST',{},'').text;
 assert.ok(!text.includes('{행사일}'));assert.ok(!text.includes('{시작시간}'));
 if(template.id.includes('saturday')){assert.match(text,template.language==='ko'?/토요일 13:00–15:30/:/Saturday, 1:00–3:30 PM/);assert.ok(!text.includes('18:30'));assert.ok(!text.includes('6:30'));}
 else assert.match(text,template.language==='ko'?/목요일 18:30–21:00/:/Thursday, 6:30–9:00 PM/);
 assert.ok(new TextEncoder().encode(text).length<=2000);assert.ok(!/운영진에게.*확인.*요청/.test(text));
 }
});

test('English templates never silently fall back to Korean event, address or bank details',()=>{
 const template={language:'en',body:'Hi {이름}: {행사명} / {장소} / {은행} / {예금주}'};
 const missing=m.renderEventSms(template,event,'SIMA FEIFEI',{'은행':'토스뱅크','예금주':'홍길동'},'');
 assert.deepEqual(Array.from(missing.missing),['행사명','장소','은행','예금주']);
 const translated=m.renderEventSms(template,event,'SIMA FEIFEI',{'영문행사명':'MALMOIM Season 9','영문장소':'Seoul Youth Center Eunpyeong, 9 Tongil-ro 67-gil, Eunpyeong-gu, Seoul','영문은행':'Toss Bank','영문예금주':'Test Holder'},'');
 assert.equal(translated.missing.length,0);assert.ok(!/[가-힣]/.test(translated.text));
});

test('English numeric won fee is displayed as KRW and Korean fee prose is never copied',()=>{
 const t={language:'en',body:'Fee: {참가비}'};assert.equal(m.renderEventSms(t,event,'TEST',{},'50,000원').text,'Fee: KRW 50,000');assert.ok(m.renderEventSms(t,event,'TEST',{},'현장 납부').missing.includes('참가비'));
});
