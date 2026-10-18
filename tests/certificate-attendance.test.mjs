import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import * as model from '../src/lib/certificate-model.ts';
import * as delivery from '../src/lib/certificate-delivery.ts';
const require=createRequire(import.meta.url);
const row={event_id:'event',source:'manual',application_id:'app',name:'동명이인',attendance:'attended',confirmation:'confirmed'};
const template={id:'template',placement:model.defaultPlacement};
function load(file,mocks){
 const {outputText}=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true,jsx:ts.JsxEmit.ReactJSX}});
 const loaded={exports:{}};
 runInNewContext(outputText,{module:loaded,exports:loaded.exports,require:n=>Object.hasOwn(mocks,n)?mocks[n]:require(n),Error,Response,Request,Headers,File,Buffer,console,process:{cwd:()=>process.cwd()}});return loaded.exports;
}
test('attendance selection clears stale, absent, missing and no-show identities',()=>{
 const rows=[row,...['absent','unrecorded','no_show'].map(attendance=>({...row,application_id:attendance,attendance}))];
 assert.deepEqual(model.eligibleSelection(rows,rows.map(model.identity).concat('missing')),[model.identity(row)]);
 assert.deepEqual(model.eligibleSelection([{...row,attendance:'absent'}],[model.identity(row)]),[]);
 for(const r of rows.slice(1))assert.throws(()=>model.requireAttended([row,r]),/출석 완료/);
 assert.equal(model.requireAttended([row])[0],row);
});
test('rendered certificate screen disables 12 ineligible checkboxes out of 32',()=>{
 const rows=Array.from({length:32},(_,i)=>({...row,application_id:String(i),attendance:i<20?'attended':i<26?'absent':'unrecorded'}));
 const data={events:[],templates:[],history:[],candidates:rows};let state=0;
 const {CertificateView}=load('src/components/admin/certificate-view.tsx',{
  react:{...React,useState:initial=>[state++===0?false:initial?.candidates?data:initial,()=>{}],useEffect:()=>{},useRef:()=>({current:''})},
  './admin-shell':{AdminShell:({children})=>React.createElement('main',null,children)},
  '@/lib/certificate-model':model,'./certificates.css':{},'@/lib/participation-validation':{attendances:{attended:'출석',absent:'결석',unrecorded:'미기록'},confirmations:{confirmed:'확정'}},
 });
 const html=renderToStaticMarkup(React.createElement(CertificateView,{enabled:true}));
 const boxes=html.match(/<input[^>]*aria-label="[^>]*선택"[^>]*>/g)||[];
 assert.equal(boxes.length,32);assert.equal(boxes.filter(s=>s.includes('disabled=""')).length,12);
});
function api({attendance='attended',action='issue',rpcError=null,storeError=null,existingJob=null,signError=null}={}){
 let rpcCalls=0,pdfCalls=0;
 const db={from:name=>({select:()=>({eq:()=>({
  maybeSingle:async()=>({data:name==='certificate_jobs'?existingJob:null}),
  single:async()=>({data:name==='certificate_issues'?{...row,id:'old',template_id:'template'}:name==='certificate_jobs'?{id:'11111111-1111-4111-8111-111111111111',status:'ready',path:'path',mime:'application/pdf',expires_at:new Date(Date.now()+60000).toISOString()}:template}),
 })})}),storage:{from:()=>({upload:async()=>({error:storeError}),createSignedUrl:async()=>({error:signError,data:{signedUrl:'http://127.0.0.1/file'}}),remove:async()=>({})})},rpc:async name=>{
  if(name==='begin_certificate_job')return {data:'claimed'};
  if(name==='finish_certificate_job'){rpcCalls++;return {error:rpcError};}
  return {};
 }};
 const route=load('src/app/api/admin/certificates/route.ts',{
  '@/lib/auth':{getAdminAccess:async()=>({status:'admin'})},'@/lib/supabase/server':{createClient:async()=>db},
  '@/lib/certificates':{certificatesEnabled:()=>true,certificateData:async()=>({candidates:[{...row,attendance}]}),templateBackground:async()=>({})},
  '@/lib/certificate-model':model,'@/lib/certificate-delivery':delivery,'@/lib/certificate-pdf':{certificatePdf:async()=>{pdfCalls++;return new Uint8Array([1]);},certificateZip:()=>new Uint8Array([2])},
  '@/lib/pdf-validation':{},'@/lib/certificate-cleanup':{cleanCertificateFiles:async()=>({removed:0})},'node:fs/promises':{readFile:async()=>new Uint8Array()},
 });
 const request=new Request('http://127.0.0.1:3100/api/admin/certificates',{method:'POST',headers:{host:'127.0.0.1:3100',origin:'http://127.0.0.1:3100','content-type':'application/json'},body:JSON.stringify({job:'11111111-1111-4111-8111-111111111111',action,template:'template',event:'event',keys:[model.identity(row)],confirm:true,issue:'old'})});
 return {run:()=>route.POST(request),counts:()=>({rpcCalls,pdfCalls})};
}
for(const action of ['issue','reissue'])for(const attendance of ['absent','unrecorded','no_show'])test(`API ${action} rejects ${attendance} before PDF or RPC`,async()=>{
 const a=api({action,attendance});assert.equal((await a.run()).status,409);assert.deepEqual(a.counts(),{rpcCalls:0,pdfCalls:0});
});
test('API refuses PDF response if final transactional attendance check fails',async()=>{
 const a=api({rpcError:{message:'attendance_required'}});assert.equal((await a.run()).status,409);assert.deepEqual(a.counts(),{rpcCalls:1,pdfCalls:1});
});
test('attended reissue retains saved name and template flow',async()=>{
 const a=api({action:'reissue'});assert.equal((await a.run()).status,200);assert.equal(a.counts().rpcCalls,1);
});

test('login-free preview renders synthetic design with all work controls disabled',()=>{
 const {CertificateView}=load('src/components/admin/certificate-view.tsx',{
  react:{...React,useState:initial=>[initial,()=>{}],useEffect:()=>{},useRef:()=>({current:''})},
  './admin-shell':{AdminShell:({children})=>React.createElement('main',null,children)},
  '@/lib/certificate-model':model,'./certificates.css':{},'@/lib/participation-validation':{attendances:{},confirmations:{}},
 });
 const html=renderToStaticMarkup(React.createElement(CertificateView,{preview:true}));
 assert.match(html,/<fieldset disabled=""/);
 assert.match(html,/화면 확인 전용/);assert.match(html,/가상 수료증 디자인/);
 assert.equal((html.match(/aria-label="[^>]*선택"/g)||[]).length,32);
 assert.doesNotMatch(html,/<iframe/);
});
test('preview page fails closed outside development',()=>{
 for(const mode of ['development','production','test']){
  const loaded={exports:{}};
  const {outputText}=ts.transpileModule(readFileSync('src/app/preview/certificates/page.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}});
  runInNewContext(outputText,{module:loaded,exports:loaded.exports,process:{env:{NODE_ENV:mode}},require:n=>n==='next/navigation'?{notFound:()=>{throw new Error('404');}}:n==='@/components/admin/certificate-view'?{CertificateView:()=>null}:require(n)});
  if(mode==='development')assert.equal(loaded.exports.default().props.preview,true);
  else assert.throws(()=>loaded.exports.default(),/404/);
 }
});

test('name substring search preserves duplicate identities, source and original selection',()=>{
 const rows=[row,{...row,source:'registration',application_id:'other'}, {...row,name:'박하늘',application_id:'absent',attendance:'absent'}];
 const selection=rows.slice(0,2).map(model.identity);
 assert.equal(model.searchCandidates(rows,'명이').length,2);
 assert.equal(model.searchCandidates(rows,' 하늘 ').length,1);
 assert.deepEqual(model.searchCandidates(rows,'unknown'),[]);
 assert.equal(model.searchCandidates([{...row,name:'Alex Kim'}],'aLEX').length,1);
 assert.equal(model.searchCandidates(rows,'')[2].attendance,'absent');
 assert.deepEqual(selection,rows.slice(0,2).map(model.identity));
 const uuid='22222222-2222-4222-8222-123456789012';
 assert.equal(model.shortApplicationId(uuid),'22222222…789012');
 assert.equal(model.shortApplicationId('short'),'short');
});
test('filtered screen keeps global counts and selected hidden applicants, and full IDs remain available',()=>{
 const rows=[row,{...row,application_id:'absent-application-123456789',name:'박하늘',attendance:'absent'},{...row,application_id:'hidden',name:'이예원'}];
 const data={events:[],templates:[],history:[],candidates:rows};
 function render(query,preview=false){
  let index=0;
  const {CertificateView}=load('src/components/admin/certificate-view.tsx',{
   react:{...React,useState:initial=>{const i=index++;return [i===0?false:i===1?data:i===5?[model.identity(row),model.identity(rows[2])]:i===14?query:initial,()=>{}];},useEffect:()=>{},useRef:()=>({current:''})},
   './admin-shell':{AdminShell:({children})=>React.createElement('main',null,children)},
   '@/lib/certificate-model':model,'./certificates.css':{},'@/lib/participation-validation':{attendances:{},confirmations:{}},
  });
  return renderToStaticMarkup(React.createElement(CertificateView,{preview,enabled:true}));
 }
 const filtered=render('하늘');
 assert.equal((filtered.match(/aria-label="[^>]*선택"/g)||[]).length,1);
 assert.match(filtered,/전체 신청자 <strong>3명/);assert.match(filtered,/발급 가능 <strong>2명/);assert.match(filtered,/현재 선택 <strong>2명/);
 assert.match(filtered,/검색 결과 1명/);assert.match(filtered,/disabled=""[^>]*title="출석 완료/);
 assert.match(filtered,/전체 식별자 보기/);assert.match(filtered,/absent-application-123456789/);
 const cleared=render('');assert.equal((cleared.match(/aria-label="[^>]*선택"/g)||[]).length,3);assert.equal((cleared.match(/checked=""/g)||[]).length,2);
 assert.match(render('notfound'),/검색 결과가 없습니다/);
 const preview=render('하늘',true);assert.match(preview,/type="search"/);assert.match(preview,/<input type="checkbox"[^>]*disabled=""/);
});

test('actual issuance API returns a small JSON link, never a PDF response',async()=>{
 const a=api();const response=await a.run();assert.equal(response.status,200);
 assert.match(response.headers.get('content-type'),/application\/json/);
 const text=await response.text();assert.ok(text.length<2048);assert.equal(JSON.parse(text).url,'http://127.0.0.1/file');
});
test('Storage upload failure never calls the final issuance recorder',async()=>{
 const a=api({storeError:{message:'storage unavailable'}});assert.equal((await a.run()).status,409);
 assert.deepEqual(a.counts(),{rpcCalls:0,pdfCalls:1});
});
test('ready same-job retry returns existing download without generating or recording again',async()=>{
 const a=api({existingJob:{request:{action:'issue',event:'event',template:'template',issue:'old',keys:[model.identity(row)],zip:false}}});
 assert.equal((await a.run()).status,200);assert.deepEqual(a.counts(),{rpcCalls:0,pdfCalls:0});
});
test('same job ID cannot be reused with a different request',async()=>{
 const a=api({existingJob:{request:{action:'reissue'}}});assert.equal((await a.run()).status,409);assert.deepEqual(a.counts(),{rpcCalls:0,pdfCalls:0});
});
test('URL signing failure returns retryable error after one finalization',async()=>{
 const a=api({signError:{message:'network error'}});assert.equal((await a.run()).status,503);assert.equal(a.counts().rpcCalls,1);
});
