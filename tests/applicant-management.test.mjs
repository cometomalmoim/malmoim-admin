import {test} from 'node:test';import assert from 'node:assert/strict';import {applicantInput,paymentAmountInput} from '../src/lib/applicant-validation.ts';
function form(values={}){const d=new FormData();for(const [k,v]of Object.entries({source:'manual',id:'',revision:'0',name:'가상',contact:'01000009999',contact_type:'phone',birth_year:'1998',nationality:'가상국적',status:'waitlisted',payment_status:'paid',internal_note:'가상 메모',source_note:'가상 전화 접수',...values}))d.set(k,v);return d;}
test('수동 접수와 출생연도·입금·상태 해석',()=>{const value=applicantInput(form());assert.equal(value.birth_year,1998);assert.equal(value.id,null);assert.equal(value.payment,'paid');assert.equal(value.status,'waitlisted');});
test('미확인 정보는 빈값, 임의 상태·미래 출생·근거 없는 추가 차단',()=>{assert.equal(applicantInput(form({birth_year:''})).birth_year,null);for(const values of [{birth_year:'3000'},{birth_year:'1998.5'},{status:'hacked'},{payment_status:'true'},{source_note:''},{name:''},{contact:'invalid'},{revision:'-1'},{id:'bad'}])assert.throws(()=>applicantInput(form(values)));});
test('기존 신청자 수정은 접수 근거를 위조하지 않음',()=>{const value=applicantInput(form({source:'registration',id:'11111111-1111-4111-8111-111111111111',source_note:''}));assert.equal(value.source_note,'');});

test('기존 납부 상태 네 개와 확인 대기를 모두 허용하고 확인 기록 입력은 무시한다',()=>{
 for(const payment_status of ['unknown','unpaid','pending_confirmation','paid','refunded']){
  const result=applicantInput(form({payment_status,payment_confirmed_by:'forged-admin',payment_confirmed_at:'2000-01-01'}));
  assert.equal(result.payment,payment_status);
  assert.equal('payment_confirmed_by' in result,false);
  assert.equal('payment_confirmed_at' in result,false);
 }
});

test('확인 시각은 한국시간으로 표시하며 기존 미기록 값을 보존한다',async()=>{
 const {paymentConfirmationTime}=await import('../src/lib/applicant-validation.ts');
 assert.equal(paymentConfirmationTime(null),'미기록');
 assert.equal(paymentConfirmationTime(undefined),'미기록');
 assert.equal(paymentConfirmationTime('bad'),'확인 필요');
 const result=paymentConfirmationTime('2026-10-15T15:30:00.000Z');
 assert.match(result,/2026\. 10\. 16\./);assert.match(result,/12:30/);assert.match(result,/KST/);
});

async function loadServer(file,names,values,exportName){
 const {readFile}=await import('node:fs/promises');
 const {stripTypeScriptTypes}=await import('node:module');
 const {compileFunction}=await import('node:vm');
 const source=stripTypeScriptTypes(await readFile(new URL(file,import.meta.url),'utf8')).replace(/^import .*;$/gm,'').replace(/^export /gm,'');
 return compileFunction(source+`\nreturn ${exportName};`,names)(...values);
}

test('신청자 저장은 관리자 검사·기존 RPC·충돌 응답을 유지하고 확인 기록을 전송하지 않는다',async()=>{
 let admin=true,code='saved';const calls=[],refreshes=[];
 const save=await loadServer('../src/app/actions/applicants.ts',['getAdminAccess','createClient','applicantInput','revalidatePath'],[
  async()=>({status:admin?'admin':'denied'}),
  async()=>({rpc:async(name,args)=>{calls.push({name,args});return {data:{code},error:null};}}),
  applicantInput,(...args)=>refreshes.push(args)
 ],'saveApplicant');
 const values={id:'11111111-1111-4111-8111-111111111111',revision:'3',payment_status:'pending_confirmation',payment_confirmed_by:'forged'};
 assert.equal((await save('demo',{code:''},form(values))).code,'saved');
 assert.equal(calls[0].name,'manage_event_application');assert.equal(calls[0].args.p_revision,3);
 assert.equal(calls[0].args.p_payment,'pending_confirmation');assert.equal(calls[0].args.p_slug,'demo');
 assert.equal(Object.keys(calls[0].args).some(key=>key.includes('confirmed')),false);
 code='conflict';assert.equal((await save('demo',{code:''},form(values))).code,'conflict');
 assert.equal(refreshes.length,1);
 admin=false;assert.equal((await save('demo',{code:''},form(values))).code,'forbidden');assert.equal(calls.length,2);
});

test('납부 확인 컬럼 조회에도 기존 검색·필터·페이지 범위를 유지한다',async()=>{
 const {applicationStatuses,paymentStatuses}=await import('../src/lib/applicant-validation.ts');
 let admin=true;const calls=[];
 const chain=new Proxy({}, {get(_target,key){if(key==='then')return resolve=>resolve({data:[],count:26,error:null});return (...args)=>{calls.push([key,...args]);return chain;};}});
 const getRecruitment=await loadServer('../src/lib/recruitment.ts',['applicationStatuses','paymentStatuses','getAdminAccess','createClient'],[
  applicationStatuses,paymentStatuses,async()=>({status:admin?'admin':'denied'}),async()=>({from(table){
   if(table==='recruitment_events')return {select:()=>({order:async()=>({data:[{id:'event-id',slug:'demo'}],error:null})})};
   assert.equal(table,'event_application_list');return chain;
  }})
 ],'getRecruitment');
 const result=await getRecruitment('demo',2,{q:'가상',status:'accepted',payment:'pending_confirmation',nationality:'가상국적',year:'1998'});
 assert.equal(result.kind,'ready');assert.equal(result.page,2);assert.equal(result.count,26);
 assert.match(calls.find(item=>item[0]==='select')[1],/payment_confirmed_by,payment_confirmed_at/);
 for(const filter of [['eq','event_id','event-id'],['eq','status','accepted'],['eq','payment_status','pending_confirmation'],['eq','birth_year',1998],['range',25,49]])assert.ok(calls.some(item=>JSON.stringify(item)===JSON.stringify(filter)));
 assert.ok(calls.some(item=>item[0]==='or'));assert.ok(calls.some(item=>item[0]==='ilike'));
 admin=false;assert.equal((await getRecruitment('demo')).kind,'error');
});


test('실제 납부액 입력은 미확인·0·음수·소수·표기 우회·범위 초과를 거부한다',()=>{
 const valid={application_id:'11111111-1111-4111-8111-111111111111',revision:'3',paid_amount_krw:'37500'};
 assert.equal(paymentAmountInput(form(valid)).amount,37500);
 for(const paid_amount_krw of ['', '0','-1','1.5','1e3','37,500','2147483648'])assert.throws(()=>paymentAmountInput(form({...valid,paid_amount_krw})));
 for(const patch of [{revision:''},{revision:'-1'},{application_id:'bad'},{source:'bad'}])assert.throws(()=>paymentAmountInput(form({...valid,...patch})));
 const parsed=paymentAmountInput(form({...valid,paid_amount_recorded_by:'forged',paid_amount_recorded_at:'forged'}));
 assert.deepEqual(parsed,{source:'manual',applicationId:valid.application_id,revision:3,amount:37500});
});

test('실제 납부액 액션은 전용 RPC로 전달하고 충돌·잠금·권한과 오류를 유지한다',async()=>{
 let admin=true,code='saved';const calls=[],refreshed=[];
 const save=await loadServer('../src/app/actions/applicants.ts',['getAdminAccess','createClient','applicantInput','paymentAmountInput','revalidatePath'],[
  async()=>({status:admin?'admin':'denied'}),async()=>({rpc:async(name,args)=>{calls.push({name,args});return {data:{code},error:null};}}),applicantInput,paymentAmountInput,(...args)=>refreshed.push(args)
 ],'recordApplicantPayment');
 const values={application_id:'11111111-1111-4111-8111-111111111111',revision:'3',paid_amount_krw:'37500'};
 assert.equal((await save('demo',{},form(values))).code,'saved');
 assert.deepEqual(calls[0],{name:'record_event_payment',args:{p_slug:'demo',p_source:'manual',p_application_id:values.application_id,p_revision:3,p_amount_krw:37500}});
 for(const errorCode of ['conflict','payment_locked','not_paid']){code=errorCode;assert.equal((await save('demo',{},form(values))).code,errorCode);}
 assert.equal(refreshed.length,1);
 const count=calls.length;assert.equal((await save('demo',{},form({...values,paid_amount_krw:'0'}))).code,'invalid');assert.equal(calls.length,count);
 admin=false;assert.equal((await save('demo',{},form(values))).code,'forbidden');assert.equal(calls.length,count);
});

test('납부액 화면은 참가비로 자동 입력하지 않으며 환불 잠금·기존 납부 상태를 존중한다',async()=>{
 const {createRequire}=await import('node:module');const require=createRequire(import.meta.url);
 const ts=require('typescript');const runtime=require('react/jsx-runtime');
 const {readFile}=await import('node:fs/promises');const {compileFunction}=await import('node:vm');
 const source=await readFile(new URL('../src/components/admin/applicant-payment.tsx',import.meta.url),'utf8');
 const js=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS}}).outputText;
 const deps={
  'react':{useActionState:()=>[{code:''},()=>{},false],startTransition:fn=>fn()},
  'react/jsx-runtime':runtime,
  '@/app/actions/applicants':{recordApplicantPayment:()=>{}},
  '@/lib/applicant-validation':{paymentConfirmationTime:()=> '미기록'}
 };
 const exports={};compileFunction(js,['require','exports'])(name=>deps[name],exports);
 function expand(element){if(!element||typeof element!=='object')return [];if(Array.isArray(element))return element.flatMap(expand);return [element,...expand(element.props?.children)];}
 const props={slug:'demo',locked:false,row:{id:'11111111-1111-4111-8111-111111111111',source:'manual',revision:3,payment_status:'paid',paid_amount_krw:null,fee_amount_krw:50000}};
 const nodes=()=>expand(exports.ApplicantPayment(props));
 assert.equal(nodes().find(node=>node.props?.name==='paid_amount_krw').props.defaultValue,'');
 assert.equal(nodes().find(node=>node.props?.name==='revision').props.value,3);
 props.row.paid_amount_krw=37500;assert.equal(nodes().find(node=>node.props?.name==='paid_amount_krw').props.defaultValue,37500);
 props.locked=true;assert.equal(nodes().some(node=>node.type==='form'),false);
 props.locked=false;props.row.payment_status='refunded';assert.equal(nodes().some(node=>node.type==='form'),false);
});
