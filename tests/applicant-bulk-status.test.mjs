import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {applicantEditData} from '../src/lib/applicant-inline.ts';
import {applicationStatuses,paymentStatuses} from '../src/lib/applicant-validation.ts';
const module={exports:{}};
const code=ts.transpileModule(readFileSync(new URL('../src/lib/applicant-bulk-status.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
runInNewContext(code,{module,exports:module.exports,require:key=>key==='./applicant-inline'?{applicantEditData}:{applicationStatuses,paymentStatuses}});
const apply=module.exports.applyApplicantStatuses;
const row=(id,extra={})=>({id,source:'season9',event_slug:'season9',revision:7,name:'TEST',contact:'01000000000',contact_type:'phone',status:'received',payment_status:'unknown',internal_note:'keep',...extra});
test('bulk status preserves individual revision and fields, skips unchanged and reports partial failures',async()=>{
 const calls=[];const result=await apply([row('a'),row('b',{status:'accepted'}),row('c'),row('d')],'status','accepted',async(slug,previous,data)=>{calls.push(data);assert.equal(slug,'season9');assert.equal(data.get('revision'),'7');assert.equal(data.get('internal_note'),'keep');assert.equal(data.get('payment_status'),'unknown');assert.equal(data.get('status'),'accepted');if(data.get('id')==='d')throw Error('network');return {code:data.get('id')==='c'?'conflict':'saved'};});
 assert.equal(calls.length,3);assert.deepEqual(Array.from(result,r=>r.code),['saved','unchanged','conflict','error']);
});
test('invalid selection is rejected before save and archived applicants are not changed',async()=>{
 let calls=0;const save=async()=>{calls++;return {code:'saved'};};
 for(const [rows,value] of [[[],'paid'],[Array.from({length:51},(_,i)=>row(String(i))),'paid'],[[row('a')],'invalid']])await assert.rejects(apply(rows,'payment_status',value,save));
 const result=await apply([row('a',{is_archived:true}),row('b',{event_slug:null})],'payment_status','paid',save);assert.equal(calls,0);assert.ok(result.every(r=>r.code==='invalid'));
});
