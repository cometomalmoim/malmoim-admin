import {test} from 'node:test';
import assert from 'node:assert/strict';
import {refundRequestInput,refundUpdateInput} from '../src/lib/refund-validation.ts';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import {compileFunction} from 'node:vm';
const id='11111111-1111-4111-8111-111111111111';
function form(overrides={}){const data=new FormData();for(const [key,value] of Object.entries({source:'manual',application_id:id,reason:'가상 환불 사유',requested_at:'2026-01-01T12:00',refund_id:id,refund_action:'approve',...overrides}))data.set(key,value);return data;}
async function load(file,names,values,exportName){
 const source=stripTypeScriptTypes(await readFile(new URL(file,import.meta.url),'utf8')).replace(/^import .*;$/gm,'').replace(/^export /gm,'');
 return compileFunction(source+`\nreturn ${exportName};`,names)(...values);
}
test('환불 요청 사유·신청자·한국시간 날짜 검증',()=>{
 assert.equal(refundRequestInput(form()).requestedAt,'2026-01-01T03:00:00.000Z');
 for(const values of [{reason:' '},{reason:'x'.repeat(2001)},{source:'other'},{application_id:'bad'},{requested_at:'2026-02-30T12:00'},{requested_at:'invalid'},{requested_at:'2999-01-01T12:00'}])assert.throws(()=>refundRequestInput(form(values)));
});
test('완료에는 정수 금액과 외부 송금 확인이 필수이며 관리자 ID·처리일은 입력받지 않는다',()=>{
 for(const action of ['approve','reject'])assert.equal(refundUpdateInput(form({refund_action:action})).action,action);
 const result=refundUpdateInput(form({refund_action:'process',processed_amount_krw:'37500',transfer_confirmed:'on',processed_by:'fake',processed_at:'fake'}));
 assert.deepEqual(result,{id,action:'process',amount:37500,transferConfirmed:true});
 for(const amount of ['', '-1','1.5','1e3','2147483648'])assert.throws(()=>refundUpdateInput(form({refund_action:'process',processed_amount_krw:amount,transfer_confirmed:'on'})));
 assert.equal(refundUpdateInput(form({refund_action:'process',processed_amount_krw:'0',transfer_confirmed:'on'})).amount,0);
 assert.throws(()=>refundUpdateInput(form({refund_action:'process',processed_amount_krw:'100'})));
 assert.throws(()=>refundUpdateInput(form({refund_action:'approved'})));
 assert.throws(()=>refundUpdateInput(form({processed_amount_krw:'100'})));
});
test('서버 액션 권한·RPC 전달·오류·캐시 갱신',async()=>{
 let admin=true,code='saved',error=null;const calls=[],refreshes=[];
 const dependencies=[async()=>({status:admin?'admin':'denied'}),async()=>({rpc:async(name,args)=>{calls.push({name,args});return {data:{code},error};}}),refundRequestInput,refundUpdateInput,(...args)=>refreshes.push(args)];
 const names=['getAdminAccess','createClient','refundRequestInput','refundUpdateInput','revalidatePath'];
 const request=await load('../src/app/actions/refunds.ts',names,dependencies,'requestRefund');
 const update=await load('../src/app/actions/refunds.ts',names,dependencies,'updateRefund');
 assert.equal((await request('demo',{},form())).code,'saved');
 assert.equal(calls[0].name,'create_event_refund_request');assert.equal(calls[0].args.p_source,'manual');
 assert.equal(calls[0].args.p_requested_at,'2026-01-01T03:00:00.000Z');
 assert.equal((await update('demo',{},form({refund_action:'process',processed_amount_krw:'123',transfer_confirmed:'on'}))).code,'saved');
 assert.deepEqual(calls[1],{name:'update_event_refund',args:{p_slug:'demo',p_refund_id:id,p_action:'process',p_processed_amount_krw:123,p_transfer_confirmed:true}});
 code='invalid_transition';assert.equal((await update('demo',{},form())).code,'invalid_transition');assert.equal(refreshes.length,2);
 error={message:'db failure'};assert.equal((await request('demo',{},form())).code,'error');assert.equal(refreshes.length,2);
 const count=calls.length;
 assert.equal((await request('demo',{},form({reason:''}))).code,'invalid');assert.equal(calls.length,count);
 admin=false;
 assert.equal((await request('demo',{},form())).code,'forbidden');assert.equal((await update('demo',{},form())).code,'forbidden');assert.equal(calls.length,count);
});
test('환불 조회는 현재 이벤트·현재 페이지 신청자·출처로 제한하고 관리자 권한을 확인한다',async()=>{
 let admin=true,fail=false;const calls=[];
 const rows=[{id:'r1',application_id:id,source:'manual'},{id:'r2',application_id:id,source:'registration'}];
 const chain=new Proxy({}, {get(_target,key){if(key==='then')return resolve=>resolve({data:rows,error:fail?{}:null});return (...args)=>{calls.push([key,...args]);return chain;};}});
 const get=await load('../src/lib/refunds.ts',['getAdminAccess','createClient'],[async()=>({status:admin?'admin':'denied'}),async()=>({from(table){assert.equal(table,'event_application_refunds');return chain;}})],'getApplicantRefunds');
 assert.deepEqual(await get('demo',[{id,source:'manual'}]),{kind:'ready',rows:[rows[0]]});
 assert.ok(calls.some(call=>JSON.stringify(call)===JSON.stringify(['eq','recruitment_events.slug','demo'])));
 assert.ok(calls.some(call=>JSON.stringify(call)===JSON.stringify(['in','application_id',[id]])));
 assert.deepEqual(await get('demo',[]),{kind:'ready',rows:[]});
 fail=true;assert.equal((await get('demo',[{id,source:'manual'}])).kind,'error');
 admin=false;assert.equal((await get('demo',[{id,source:'manual'}])).kind,'error');
});

test('SQL은 승인 enum·권한·감사 연결과 upsert 보호를 포함하고 이전 단계 SQL을 재정의하지 않는다',async()=>{
 const sql=await readFile(new URL('../supabase/014_applicant_refund_management.sql',import.meta.url),'utf8');
 assert.match(sql,/case when p_action='approve' then 'approved' else 'rejected' end/);
 assert.match(sql,/status in \('requested','approved','rejected','processed'\)/);
 assert.match(sql,/enable row level security/);assert.match(sql,/force row level security/);
 assert.match(sql,/if TG_OP='UPDATE' then prior_payment:=old.payment_status/);
 assert.match(sql,/select payment_status into prior_payment from public.event_application_management/);
 assert.match(sql,/if prior_payment='refunded'/);
 assert.match(sql,/where status='processed'/);
 assert.match(sql,/'refund_requested'/);assert.match(sql,/'refund_'\|\|target/);
 assert.doesNotMatch(sql,/create or replace function public\.manage_event_application/);
 assert.doesNotMatch(sql,/fee_amount_krw|get_published_event_fee/);
 const process=sql.slice(sql.indexOf("target:='processed'"));
 assert.ok(process.indexOf('update public.event_application_refunds')<process.indexOf('update public.event_application_management'));
});

test('거절 후 재요청은 이전 saved 상태로 잠기지 않고 진행 중 요청·처리는 유지한다',async()=>{
 const {createRequire}=await import('node:module');
 const require=createRequire(import.meta.url);
 const ts=require('typescript');
 const {jsx,jsxs,Fragment}=require('react/jsx-runtime');
 let actionState={code:'saved'},pending=false;
 const source=await readFile(new URL('../src/components/admin/applicant-refunds.tsx',import.meta.url),'utf8');
 const javascript=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS}}).outputText;
 const exports={};
 const dependencies={
  'react':{useActionState:()=>[actionState,()=>{},pending],useState:initial=>[initial,()=>{}]},
  'react/jsx-runtime':{jsx,jsxs,Fragment},
  '@/app/actions/refunds':{requestRefund:()=>{},updateRefund:()=>{}},
  '@/lib/refund-validation':{refundStatuses:{requested:'요청',approved:'승인',rejected:'거절',processed:'처리 완료'}},
  '@/lib/applicant-validation':{paymentConfirmationTime:()=> 'KST'}
 };
 compileFunction(javascript,['require','exports'])(name=>{assert.ok(name in dependencies);return dependencies[name];},exports);
 const props={slug:'demo',applicationId:id,source:'manual',paymentStatus:'paid',rows:[{id:'rejected',status:'rejected',processed_amount_krw:null}]};
 function expand(element){
  if(!element||typeof element!=='object')return [];
  if(Array.isArray(element))return element.flatMap(expand);
  if(typeof element.type==='function')return expand(element.type(element.props));
  return [element,...expand(element.props?.children)];
 }
 const nodes=()=>expand(exports.ApplicantRefunds(props));
 const requestFieldset=()=>nodes().find(node=>node.type==='fieldset'&&expand(node.props.children).some(child=>child.type==='legend'&&child.props.children==='환불 요청 등록'));
 assert.equal(requestFieldset().props.disabled,false);
 pending=true;assert.equal(requestFieldset().props.disabled,true);pending=false;
 for(const status of ['requested','approved','processed']){
  props.rows=[{id:status,status,processed_amount_krw:null}];
  assert.equal(requestFieldset(),undefined);
  actionState={code:''};
  if(status==='requested')assert.deepEqual(nodes().filter(node=>node.type==='button').map(node=>node.props.value),['approve','reject']);
  if(status==='approved')assert.ok(nodes().some(node=>node.type==='input'&&node.props.name==='transfer_confirmed'&&node.props.required));
  if(status==='processed')assert.equal(nodes().some(node=>node.type==='form'),false);
 }
});

test('통합 신청자 목록은 참여 이력·납부 확인·수정·환불과 필터 유지 페이지 이동을 함께 제공한다',async()=>{
 const {createRequire}=await import('node:module');
 const require=createRequire(import.meta.url);
 const ts=require('typescript');
 const {jsx,jsxs,Fragment}=require('react/jsx-runtime');
 const validation=await import('../src/lib/applicant-validation.ts');
 const source=await readFile(new URL('../src/components/admin/applicant-list.tsx',import.meta.url),'utf8');
 const javascript=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
 const refunds=[{application_id:id,source:'manual',status:'rejected'},{application_id:id,source:'registration',status:'requested'}];
 const dependencies={
  'react/jsx-runtime':{jsx,jsxs,Fragment},
  'next/link':({children,...props})=>jsx('a',{...props,children}),
  '@/lib/applicant-validation':validation,
  './applicant-editor':{ApplicantEditor:props=>jsx('mock-applicant-editor',props)},
  './applicant-refunds':{ApplicantRefunds:props=>jsx('mock-applicant-refunds',props)},
  '@/lib/refunds':{getApplicantRefunds:async(slug,rows)=>{assert.equal(slug,'demo');assert.equal(rows[0].id,id);return {kind:'ready',rows:refunds};}},
  './applicants.css':{}
 };
 const exports={};
 compileFunction(javascript,['require','exports'])(name=>{assert.ok(name in dependencies);return dependencies[name];},exports);
 const query={q:'가상 이름',status:'accepted',payment:'pending_confirmation',nationality:'가상국적',year:'1998'};
 const tree=await exports.ApplicantList({slug:'demo',title:'가상',page:2,count:76,query,rows:[{
  id,source:'manual',name:'가상 이름',contact:'01000001234',payment_status:'pending_confirmation',status:'accepted',
  payment_confirmed_by:'confirmed-admin',payment_confirmed_at:'2026-01-01T00:00:00Z',created_at:'2026-01-01T00:00:00Z'
 }]});
 function expand(element){
  if(!element||typeof element!=='object')return [];
  if(Array.isArray(element))return element.flatMap(expand);
  if(typeof element.type==='function')return expand(element.type(element.props));
  return [element,...expand(element.props?.children)];
 }
 const nodes=expand(tree);
 assert.ok(nodes.some(node=>node.type==='a'&&node.props.href===`/admin/events/demo/participants/manual/${id}`));
 assert.ok(nodes.some(node=>node.type==='td'&&node.props.children==='confirmed-admin'));
 assert.ok(nodes.some(node=>node.type==='td'&&String(node.props.children).includes('KST')));
 assert.ok(nodes.some(node=>node.type==='mock-applicant-editor'&&node.props.row?.id===id));
 assert.deepEqual(nodes.find(node=>node.type==='mock-applicant-refunds').props.rows,[refunds[0]]);
 for(const name of ['q','status','payment','nationality','year'])assert.ok(nodes.some(node=>node.props?.name===name));
 const pages=nodes.filter(node=>node.type==='a'&&node.props.href.includes('?')).map(node=>new URL(node.props.href,'https://local.test').searchParams);
 assert.deepEqual(pages.map(params=>params.get('page')),['1','3']);
 for(const params of pages)for(const [key,value] of Object.entries(query))assert.equal(params.get(key),value);
});
