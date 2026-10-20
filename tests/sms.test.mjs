import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {domesticPhone,validSmsText} from '../src/lib/sms-contract.ts';
import {composeMessaging} from '../src/lib/messaging-templates.ts';
import {randomUUID} from 'node:crypto';
const require=createRequire(import.meta.url);
function load(file,mocks,globals={}){const {outputText}=ts.transpileModule(readFileSync(new URL('../'+file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}});const m={exports:{}};runInNewContext(outputText,{module:m,exports:m.exports,require:n=>Object.hasOwn(mocks,n)?mocks[n]:require(n),...globals});return m.exports;}
const fakeEnv={SOLAPI_API_KEY:'TEST_ONLY_KEY',SOLAPI_API_SECRET:'TEST_ONLY_SECRET',SOLAPI_SENDER_NUMBER:'01000000001',SOLAPI_ADMIN_NOTIFY_NUMBER:'01000000002'};

test('문의 답변 문자는 완료된 문의의 유효 링크를 수신자 한 명에게만 준비한다',async()=>{
 for(const [status,numbers,link,allowed] of [['answered','01000000003','https://malmoim.com/inquiries/receipt#token='+'a'.repeat(64),true],['received','01000000003','https://malmoim.com/inquiries/receipt#token='+'a'.repeat(64),false],['answered','01000000003,01000000004','https://malmoim.com/inquiries/receipt#token='+'a'.repeat(64),false],['answered','01000000003','https://other.example/secret',false]]){
  let prepared=0;
  const chain={select(){return this;},eq(){return this;},async single(){return {data:{event_id:'synthetic-event',status},error:null};}};
  const client={from:()=>chain,rpc:async()=>{prepared++;return {error:null};}};
  const {prepareSms}=load('src/app/actions/messaging.ts',{'@/lib/supabase/server':{createClient:async()=>client},'@/lib/auth':{getAdminAccess:async()=>({status:'admin'})},'@/lib/solapi':{smsConfig:()=>({sender:'01000000001'}),smsPrice:async()=>({LMS:30}),maskPhone:v=>v},'@/lib/sms-contract':{domesticPhone,validSmsText,smsUuid:()=>true},'@/lib/messaging-templates':{composeMessaging},'@/lib/sms-worker':{}},{crypto:{randomUUID}});
  const result=await prepareSms({eventId:'',mode:'direct',recipients:[],numbers,body:'{답변링크}',name:'',due:'',contact:'',replyUrl:link});
  assert.equal(!!result.preview,allowed);assert.equal(prepared,allowed?1:0);
 }
});
test('국내 휴대폰만 정규화하고 해외·잘못된 번호 제외',()=>{assert.equal(domesticPhone('+82 10-0000-0001'),'01000000001');assert.equal(domesticPhone('00821000000001'),'01000000001');for(const v of ['123','+12025550123','02-1234-5678','0101234567','abc'])assert.equal(domesticPhone(v),null);});
test('빈 내용·제어문자·치환하지 않은 변수·긴 UTF-8 본문 거부',()=>{for(const v of ['','  ','{이름}님','a\u0000b','가'.repeat(667)])assert.equal(validSmsText(v),false);assert.equal(validSmsText('가'.repeat(666)),true);});
function provider(fetch){return load('src/lib/solapi.ts',{'server-only':{},'./sms-contract':{domesticPhone,validSmsText,smsUuid:()=>true}},{process:{env:fakeEnv},fetch,AbortSignal,Date,TextEncoder});}
test('업체 요청은 HMAC 인증과 등록된 발신번호로만 구성',async()=>{let request;const api=provider(async(url,options)=>{request={url,options};return {ok:true,json:async()=>({groupInfo:{groupId:'G4VTEST00000000000000000000000000',count:{registeredSuccess:1}},failedMessageList:[]})};});const id=await api.sendSms('01000000003','가상 테스트','LMS');assert.ok(id.startsWith('G4V'));assert.match(request.options.headers.Authorization,/^HMAC-SHA256 apiKey=TEST_ONLY_KEY, date=.*salt=.*signature=[a-f0-9]{64}$/);const body=JSON.parse(request.options.body);assert.equal(body.messages[0].from,'01000000001');assert.equal(body.messages[0].to,'01000000003');assert.equal(body.messages[0].type,'LMS');assert.equal(body.allowDuplicates,false);assert.equal(JSON.stringify(body).includes('TEST_ONLY_SECRET'),false);});
test('HTTP 성공만으로 발송 성공 처리하지 않음',async()=>{for(const response of [{},{failedMessageList:[{statusCode:'3000'}],groupInfo:{groupId:'G4VTEST00000000000000000000000000'}}]){await assert.rejects(provider(async()=>({ok:true,json:async()=>response})).sendSms('01000000003','가상','LMS'));}});
test('네트워크/5xx 불명과 명확한 4xx 거부를 구분',async()=>{for(const status of [400,401,403,429])await assert.rejects(provider(async()=>({ok:false,status})).sendSms('01000000003','가상','LMS'),/sms_rejected/);await assert.rejects(provider(async()=>({ok:false,status:500})).sendSms('01000000003','가상','LMS'),/sms_unknown/);});
test('업체 접수·도달·실패 상태를 구분',async()=>{for(const [count,expected] of [[{},'accepted'],[{sentSuccess:1},'delivered'],[{sentFailed:1},'failed']])assert.equal(await provider(async()=>({ok:true,json:async()=>({count})})).smsDelivery('G4VTEST00000000000000000000000000'),expected);});
test('Worker는 한 번 claim한 요청만 처리하고 불명 결과를 재발송하지 않음',async()=>{const calls=[];let claimed=false,sent=0;const client={rpc:async(name,args)=>{calls.push({name,args});if(name==='sms_claim'){if(claimed)return {data:[],error:null};claimed=true;return {data:[{id:'test-id',kind:'notification',body:'TEST'}]};}return {};}};const {processSmsQueue}=load('src/lib/sms-worker.ts',{'server-only':{},'./solapi':{smsConfig:()=>({worker:'TEST_WORKER',notify:'01000000002'}),sendSms:async()=>{sent++;throw new Error('ambiguous network outcome');}}});await processSmsQueue(client);assert.equal(sent,1);assert.equal(calls.find(x=>x.name==='sms_finish').args.p_state,'unknown');});
test('Worker 설정 없으면 업체 요청도 DB claim도 하지 않음',async()=>{let called=false;const {processSmsQueue}=load('src/lib/sms-worker.ts',{'server-only':{},'./solapi':{smsConfig:()=>null}});await processSmsQueue({rpc:async()=>{called=true;}});assert.equal(called,false);});
test('관리자 아닌 계정은 모든 문자 액션에서 DB·업체 요청 전에 차단',async()=>{let touched=false;const actions=load('src/app/actions/messaging.ts',{'@/lib/supabase/server':{createClient:async()=>{touched=true;throw new Error('must not access');}},'@/lib/auth':{getAdminAccess:async()=>({status:'not_admin'})},'@/lib/solapi':{smsConfig:()=>{touched=true;throw new Error('must not read');}},'@/lib/sms-contract':{},'@/lib/messaging-templates':{},'@/lib/sms-worker':{processSmsQueue:async()=>{touched=true;}}});const status=await actions.messagingStatus();assert.equal(status.ready,false);assert.equal(status.configured,false);for(const result of [await actions.initializeMessaging(),await actions.toggleMessaging(true,true),await actions.prepareSms({}),await actions.approveSms('bad'),await actions.refreshSms('bad'),await actions.processPendingAlerts()])assert.ok(result.ok===false||typeof result.message==='string');assert.equal(touched,false);});
test('신청 알림은 길이에 따라 SMS/LMS를 선택하고 지정된 운영자 번호로만 전송',async()=>{
 for(const [body,type] of [['[MALMOIM] New application','SMS'],['[말모임] 새 참가 신청\n이벤트: 할로윈 파티\n신청자: 가상 이름\nhttps://admin.malmoim.com/admin/events/halloween-2026/applicants','LMS']]){
  let sent,claimed=false;
  const {processSmsQueue}=load('src/lib/sms-worker.ts',{'server-only':{},'./solapi':{smsConfig:()=>({worker:'TEST_WORKER',notify:'01000000002'}),sendSms:async(...args)=>{sent=args;return 'GTEST0000000001';}}});
  await processSmsQueue({rpc:async(name)=>name==='sms_claim'&&!claimed?(claimed=true,{data:[{id:'test-id',kind:'notification',recipient:'01000000003',body}]}):{data:[]}});
  assert.equal(sent[0],'01000000002');assert.equal(sent[1],body);assert.equal(sent[2],type);
 }
});
