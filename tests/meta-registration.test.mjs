import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
const require=createRequire(import.meta.url);
function load(file,mocks={},globals={}){const {outputText}=ts.transpileModule(readFileSync(new URL('../'+file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}});const m={exports:{}};runInNewContext(outputText,{module:m,exports:m.exports,FormData,Date,URLSearchParams,Error,...globals,require:n=>Object.hasOwn(mocks,n)?mocks[n]:n.startsWith('@/')?load('src/'+n.slice(2)+'.ts',mocks):n==='./meta-pixel'?load('src/lib/meta-pixel.ts'):require(n)});return m.exports;}
const {registrationReceipt}=load('src/lib/meta-registration-receipt.ts');
const {completeRegistration}=load('src/lib/meta-registration.ts');
const id='11111111-1111-4111-8111-111111111111';
function harness(){const calls=[],map=new Map();let tail=Promise.resolve();const ctx={host:'malmoim.com',path:'/season9/apply',storage:{getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)},lock:(_key,fn)=>{const task=tail.then(fn);tail=task.catch(()=>{});return task;}};return {calls,map,ctx,w:{fbq:(...args)=>calls.push(args),malmoimMetaReady:true}};}
test('응답 재시도는 같은 익명 eventID, 언어·행사 구분만 허용',()=>{const a=registrationReceipt('season9',id,'en'),b=registrationReceipt('season9',id,'ko');assert.equal(a.eventId,b.eventId);assert.equal(a.language,'en');assert.equal(registrationReceipt('season9','invalid','ko'),undefined);assert.equal(registrationReceipt('season9',id,'unexpected').language,'ko');});
test('두 행사 한·영 성공 receipt만 CompleteRegistration, 개인정보 없음',async()=>{for(const event of ['season9','halloween-2026'])for(const language of ['ko','en']){const h=harness();h.ctx.path=event==='season9'?(language==='en'?'/season9/en/apply':'/season9/apply'):language==='en'?'/2026halloweenparty/en':'/2026halloweenparty';const receipt=registrationReceipt(event,id,language);assert.equal(await completeRegistration(h.w,receipt,h.ctx),true);const track=h.calls.find(v=>v[0]==='trackSingle');assert.equal(track[1],'1120189660978956');assert.equal(track[2],'CompleteRegistration');assert.equal(JSON.stringify(track[3]),JSON.stringify({event_slug:event,language}));assert.equal(track[4].eventID,receipt.eventId);}});
test('동일 응답·동시 탭·새로고침 후에도 한 번만 dispatch',async()=>{const h=harness(),r=registrationReceipt('season9',id,'ko');await Promise.all([completeRegistration(h.w,r,h.ctx),completeRegistration(h.w,r,h.ctx)]);const reloaded={fbq:(...args)=>h.calls.push(args),malmoimMetaReady:true};assert.equal(await completeRegistration(reloaded,r,h.ctx),false);assert.equal(h.calls.filter(v=>v[0]==='trackSingle').length,1);});
test('SDK 차단·비운영·관리자·receipt 없음은 전송 안 함',async()=>{for(const change of [h=>h.w.malmoimMetaReady=false,h=>h.ctx.host='localhost',h=>h.ctx.path='/admin']){const h=harness();change(h);assert.equal(await completeRegistration(h.w,registrationReceipt('season9',id,'ko'),h.ctx),false);assert.equal(h.calls.length,0);}const h=harness();assert.equal(await completeRegistration(h.w,undefined,h.ctx),false);});
test('저장소 차단·픽셀 예외도 호출자에게 throw하지 않으며 모호한 전송 재시도 없음',async()=>{const h=harness(),r=registrationReceipt('season9',id,'ko');h.ctx.storage.setItem=()=>{throw Error('blocked');};assert.equal(await completeRegistration(h.w,r,h.ctx),false);assert.equal(h.calls.length,0);const x=harness();x.w.fbq=()=>{throw Error('pixel blocked');};assert.equal(await completeRegistration(x.w,r,x.ctx),false);assert.equal(await completeRegistration(x.w,r,x.ctx),false);});
function seasonForm(){const f=new FormData();for(const [k,v] of Object.entries({'s9-field-0':'TEST NAME','s9-field-1':'TEST','s9-field-2':'2000-01-01','s9-field-3':'01000000001','s9-class':'thursday','s9-gender':'답변하지 않음 / Prefer not to say','s9-field-4':'TEST','s9-answer-0':'TEST','s9-korean':'조금 가능 / Basic','s9-english':'유창함 / Fluent','s9-attendance':'yes',contact_type:'phone',privacy_consent:'on',fee_confirmed:'on',photo_consent:'on',submission_id:id,application_language:'en'}))f.set(k,v);return f;}
function actionMocks(response){return {'@/lib/supabase/server':{createClient:async()=>({rpc:async()=>response})},'next/server':{after:()=>{throw Error('scheduler unavailable');}},'next/cache':{revalidatePath:()=>{}},'@/lib/sms-worker':{processSmsQueue:async()=>{}},'@/lib/auth':{getAdminAccess:async()=>({status:'admin'})}};}
test('9기 서버는 DB accepted=true일 때만 receipt, 실패/검증 오류에는 없음',async()=>{for(const response of [{data:{accepted:true}},{data:{accepted:false}},{error:{message:'DB failure'}}]){const api=load('src/app/actions/season9.ts',actionMocks(response));const result=await api.submitSeason9({},seasonForm());assert.equal(!!result.conversion,response.data?.accepted===true);if(result.conversion)assert.equal(result.conversion.language,'en');}const api=load('src/app/actions/season9.ts',actionMocks({data:{accepted:true}}));const f=seasonForm();f.delete('privacy_consent');assert.equal((await api.submitSeason9({},f)).conversion,undefined);});
function partyForm(){const f=new FormData();for(const [k,v] of Object.entries({name:'TEST NAME',contact:'01000000001',birth_year:'1998',nationality:'Canada',gender:'female',history:'new',privacy_consent:'on',submission_id:id,version:'TEST',application_language:'en'}))f.set(k,v);return f;}
test('할로윈 서버는 DB saved에만 receipt, 오류/중복/관리자 테스트는 전환 없음',async()=>{for(const code of ['saved','duplicate','closed','invalid','error']){const api=load('src/app/actions/registration.ts',actionMocks({data:code}));const result=await api.registerEvent('halloween-2026',false,{},partyForm());assert.equal(!!result.conversion,code==='saved');}const api=load('src/app/actions/registration.ts',actionMocks({data:'saved'}));assert.equal((await api.registerEvent('halloween-2026',true,{},partyForm())).conversion,undefined);const bad=partyForm();bad.delete('privacy_consent');assert.equal((await api.registerEvent('halloween-2026',false,{},bad)).conversion,undefined);const failed=load('src/app/actions/registration.ts',actionMocks({error:{message:'DB error'}}));assert.equal((await failed.registerEvent('halloween-2026',false,{},partyForm())).conversion,undefined);});

test('성공 화면 hook은 늦은 SDK 준비를 기다리고 중복 ready 이벤트에도 한 번만 전송',async()=>{
 const h=harness(),listeners=new Map(),r=registrationReceipt('season9',id,'en');h.w.malmoimMetaReady=false;
 h.w.addEventListener=(name,fn)=>listeners.set(name,fn);h.w.removeEventListener=(name)=>listeners.delete(name);
 let cleanup;
 const hook=load('src/components/use-registration-conversion.ts',{'react':{useEffect:fn=>{cleanup=fn();}},'@/lib/meta-registration':{completeRegistration}},{window:h.w,location:{hostname:'malmoim.com',pathname:'/season9/apply'},navigator:{locks:{request:h.ctx.lock}},localStorage:h.ctx.storage});
 hook.useRegistrationConversion(r);await new Promise(resolve=>setImmediate(resolve));assert.equal(h.calls.length,0);
 h.w.malmoimMetaReady=true;listeners.get('malmoim-meta-ready')();listeners.get('malmoim-meta-ready')();await new Promise(resolve=>setImmediate(resolve));assert.equal(h.calls.filter(v=>v[0]==='trackSingle').length,1);cleanup();assert.equal(listeners.size,0);
});
test('실패 receipt 없음은 hook에서 전환 실행·이벤트 대기 없음',()=>{
 let called=false;
 const hook=load('src/components/use-registration-conversion.ts',{'react':{useEffect:fn=>fn()},'@/lib/meta-registration':{completeRegistration:()=>{called=true;}}});
 hook.useRegistrationConversion(undefined);assert.equal(called,false);
});

test('QR 영어 신청 경로의 DB 성공 receipt도 전환 전송',async()=>{
 const h=harness();h.ctx.path='/season9/apply/en';
 assert.equal(await completeRegistration(h.w,registrationReceipt('season9',id,'en'),h.ctx),true);
 assert.equal(h.calls.find(v=>v[0]==='trackSingle')[3].language,'en');
});

test('할로윈 국적은 새 저장 RPC로 전달하되 Meta 매개변수에는 포함하지 않음',async()=>{
 let args;
 const mocks=actionMocks({data:'saved'});
 mocks['@/lib/supabase/server']={createClient:async()=>({rpc:async(name,values)=>{args={name,values};return {data:'saved'};}})};
 const api=load('src/app/actions/registration.ts',mocks),form=partyForm();form.set('nationality',' Canada ');
 const result=await api.registerEvent('halloween-2026',false,{},form);
 assert.equal(args.name,'submit_event_registration_with_profile');assert.equal(args.values.p_gender,'female');assert.equal(args.values.p_nationality,'Canada');
 assert.equal(result.code,'saved');assert.equal(Object.hasOwn(result.conversion,'nationality'),false);assert.equal(Object.hasOwn(result.conversion,'gender'),false);
 form.set('nationality','x'.repeat(101));args=undefined;
 assert.equal((await api.registerEvent('halloween-2026',false,{},form)).code,'nationality');assert.equal(args,undefined);
});

test('9기 사진 활용 동의 없이는 DB 호출·전환 없음, 명시 동의와 새 안내 버전만 전달',async()=>{
 let calls=0,payload;
 const mocks=actionMocks({data:{accepted:true}});mocks['@/lib/supabase/server']={createClient:async()=>({rpc:async(_name,args)=>{calls++;payload=args.payload;return {data:{accepted:true}};}})};
 const api=load('src/app/actions/season9.ts',mocks);
 for(const value of [null,'','false','true']){const form=seasonForm();if(value===null)form.delete('photo_consent');else form.set('photo_consent',value);const result=await api.submitSeason9({},form);assert.equal(result.success,false);assert.match(result.message,/활동 사진/);assert.equal(result.conversion,undefined);}
 assert.equal(calls,0);const result=await api.submitSeason9({},seasonForm());assert.equal(result.success,true);assert.equal(payload.photo_consent,true);assert.equal(payload.notice_version,'season9-2026-10-22-photo-required-v2');assert.equal(payload.future_updates_consent,false);
});
