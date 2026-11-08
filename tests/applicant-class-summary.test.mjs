import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
function load(path,deps){const mod={exports:{}};runInNewContext(ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{module:mod,exports:mod.exports,require:name=>deps[name],URLSearchParams});return mod.exports;}
function setup({admin=true,fail=false}={}){
 const calls=[];
 const client={from(table){const call={table,filters:[],head:false};calls.push(call);const builder={select(columns,opts){call.head=opts?.head;return builder;},then(resolve){return Promise.resolve(table==='recruitment_events'?{data:[{id:'cohort',slug:'season9',title:'9기'}]}:call.head?{count:37,error:fail?{}:null}:{data:[],count:80}).then(resolve);}};for(const key of ['eq','or','ilike','order','range'])builder[key]=(...args)=>{call.filters.push([key,...args]);return builder;};return builder;}};
 const lib=load('../src/lib/recruitment.ts',{'server-only':{},'./auth':{getAdminAccess:async()=>({status:admin?'admin':'guest'})},'./supabase/server':{createClient:async()=>client},'./applicant-languages':{applicantLanguageLevels:{},languageStoredValue:()=>''},'./applicant-validation':{applicationStatuses:{accepted:'합격'},paymentStatuses:{unpaid:'미납'}}});
 return {calls,get:lib.getRecruitment};
}
test('cohort counts cover full query, not loaded rows, and replace only class/nationality',async()=>{
 const {calls,get}=setup();const result=await get(undefined,1,{event:'cohort',preferred_class:'thursday',nationality_group:'korean',status:'accepted',payment:'unpaid',q:'Kim'},true,{includeClassSummary:true});
 assert.equal(result.kind,'ready');assert.equal(result.classCounts.length,6);assert.equal(result.classCounts[5].count,37);assert.equal(result.rows.length,0);
 const counts=calls.filter(c=>c.head);assert.equal(counts.length,6);
 for(const c of counts){assert.equal(c.filters.some(x=>x[0]==='range'),false);for(const [key,value] of [['event_id','cohort'],['status','accepted'],['payment_status','unpaid']])assert.ok(c.filters.some(x=>x[0]==='eq'&&x[1]===key&&x[2]===value));assert.ok(c.filters.some(x=>x[0]==='or'&&x[1].includes('Kim')));}
 const last=counts[5].filters;assert.ok(last.some(x=>x[1]==='preferred_class'&&x[2]==='saturday'));assert.ok(last.some(x=>x[1]==='nationality_group'&&x[2]==='unknown'));
});
test('counts retain admin boundary and are opt-in; failed counts do not turn into zero',async()=>{
 const denied=setup({admin:false});assert.equal((await denied.get(undefined,1,{},true,{includeClassSummary:true})).kind,'error');assert.equal(denied.calls.length,0);
 const normal=setup();await normal.get(undefined,1,{event:'cohort'},true);assert.equal(normal.calls.filter(x=>x.head).length,0);
 const failed=setup({fail:true});assert.equal((await failed.get(undefined,1,{event:'cohort'},true,{includeClassSummary:true})).classCounts,null);
});
test('class links reset pagination, retain search/status and switch both group dimensions',()=>{
 const {applicantClassHref}=load('../src/components/admin/applicant-class-summary.tsx',{'next/link':{},'react/jsx-runtime':{}});
 const query={event:'cohort',q:'김',page:'3',status:'accepted',preferred_class:'thursday',nationality_group:'korean'};
 const url=new URL(applicantClassHref(query,'saturday','foreign'),'https://example.com');assert.equal(url.searchParams.get('preferred_class'),'saturday');assert.equal(url.searchParams.get('nationality_group'),'foreign');assert.equal(url.searchParams.get('q'),'김');assert.equal(url.searchParams.get('status'),'accepted');assert.equal(url.searchParams.has('page'),false);
 const reset=new URL(applicantClassHref(query),'https://example.com');assert.equal(reset.searchParams.has('preferred_class'),false);assert.equal(reset.searchParams.has('nationality_group'),false);assert.equal(reset.searchParams.get('event'),'cohort');
});
