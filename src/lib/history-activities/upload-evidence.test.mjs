import { policyModule } from './photo-policy.test-support.mjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {test} from 'node:test';
import ts from 'typescript';
function load(file,mode='test'){
 const loaded={exports:{}};
 const {outputText}=ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
 runInNewContext(outputText,{module:loaded,exports:loaded.exports,structuredClone,process:{env:{NODE_ENV:mode}},require:name=>{if(name.endsWith('photo-policy'))return policyModule;assert.equal(name,'server-only');return {};}});
 return loaded.exports;
}
const {createCompletionEvidenceValidator}=load('./upload-evidence.ts');
const {createMemoryEvidenceLab}=load('./test-support/memory-upload-evidence.ts');
const id=n=>`${String(n).padStart(8,'0')}-aaaa-4aaa-8aaa-aaaaaaaaaaaa`;
function setup(){
 const binding={requestId:id(1),activityId:id(2),actorId:id(3),photoId:id(4),ticket:id(5),dispatchId:id(6),slot:0,bucket:'history-activity-photos',path:`${id(2)}/${id(4)}.jpg`,size:42,mime:'image/jpeg',contentDigest:'a'.repeat(64)};
 const state={binding,revision:0,phase:'awaiting_evidence',deleteRequested:false};
 const lab=createMemoryEvidenceLab([state]);const subject='mock-worker';
 const facts=['storage_response','file_verified','ticket_closed'].map((kind,i)=>({id:id(10+i),kind,binding:structuredClone(binding),sequence:i+1,issuer:['storage_observer','content_verifier','sql_receipt_verifier'][i],previousId:i===0?null:id(9+i)}));
 const input={requestId:binding.requestId,slot:0,adminContext:lab.issueAdministrator(binding.actorId),reporterContext:lab.issueReporter(subject),proofs:facts.map(f=>lab.issueEvidence(f,subject))};
 return {lab,binding,facts,input,subject,validator:()=>createCompletionEvidenceValidator(lab.adapters),read:()=>lab.adapters.ledger.read(binding.requestId,0)};
}
test('matching mock provenance, chain and all three facts accept once',async()=>{const s=setup();assert.equal(await s.validator().report(s.input),'accepted');assert.equal((await s.read()).phase,'completed');});
for(const [name,index] of [['Storage response',0],['file validation',1],['SQL termination',2]])test(`missing ${name} denies without state mutation`,async()=>{const s=setup();s.input.proofs.splice(index,1);assert.equal(await s.validator().report(s.input),'denied');assert.equal((await s.read()).revision,0);});
for(const field of ['requestId','photoId','ticket','dispatchId','contentDigest'])test(`mixed ${field} proof rejected`,async()=>{const s=setup();s.facts[1].binding[field]=field==='contentDigest'?'b'.repeat(64):id(99);s.input.proofs[1]=s.lab.issueEvidence(s.facts[1],s.subject);assert.equal(await s.validator().report(s.input),'denied');});
test('plain browser capability and fabricated completed proof never authenticate',async()=>{const s=setup();s.input.reporterContext={subjectId:s.subject,capability:'completion_report',server:true};s.input.proofs=s.facts.map(f=>({...f,completed:true}));assert.equal(await s.validator().report(s.input),'denied');assert.equal((await s.read()).revision,0);});
test('even genuine admin/reporter handles cannot authenticate browser evidence objects',async()=>{const s=setup();s.input.proofs=s.facts;assert.equal(await s.validator().report(s.input),'denied');});
test('wrong observation order and unlinked proof rejected',async()=>{const s=setup();s.facts[1].sequence=0;s.input.proofs[1]=s.lab.issueEvidence(s.facts[1],s.subject);assert.equal(await s.validator().report(s.input),'denied');s.facts[1].sequence=2;s.facts[1].previousId=id(99);s.input.proofs[1]=s.lab.issueEvidence(s.facts[1],s.subject);assert.equal(await s.validator().report(s.input),'denied');});
test('duplicate completion and concurrent reports consume evidence exactly once',async()=>{const s=setup();const results=await Promise.all([s.validator().report(s.input),s.validator().report(s.input)]);assert.equal(results.filter(x=>x==='accepted').length,1);assert.equal(await s.validator().report(s.input),'denied');assert.equal((await s.read()).revision,1);});
test('duplicate evidence identity cannot be reused in another step',async()=>{const s=setup();s.facts[1].id=s.facts[0].id;s.facts[2].previousId=s.facts[1].id;s.input.proofs=s.facts.map(f=>s.lab.issueEvidence(f,s.subject));assert.equal(await s.validator().report(s.input),'denied');});
for(const change of ['timeout','delete','version'])test(`${change} during verification prevents commit and preserves flags`,async()=>{const s=setup();const original=s.lab.adapters.evidence.resolve;let once=true;s.lab.adapters.evidence.resolve=async(...args)=>{if(once){once=false;s.lab.interrupt(s.binding.requestId,0,change);}return original(...args);};assert.equal(await s.validator().report(s.input),'denied');const state=await s.read();assert.equal(state.revision,1);assert.equal(state.deleteRequested,change==='delete');assert.notEqual(state.phase,'completed');});
test('timeout before report blocks late success facts',async()=>{const s=setup();s.lab.interrupt(s.binding.requestId,0,'timeout');assert.equal(await s.validator().report(s.input),'denied');assert.equal((await s.read()).phase,'uncertain');});
test('reporter provenance is bound to the authenticating subject',async()=>{const s=setup();s.input.reporterContext=s.lab.issueReporter('different-worker');assert.equal(await s.validator().report(s.input),'denied');});
test('revoked administrator or reporter during verification denies',async()=>{for(const field of ['adminContext','reporterContext']){const s=setup();const original=s.lab.adapters.evidence.resolve;s.lab.adapters.evidence.resolve=async(...args)=>{s.lab.revoke(s.input[field]);return original(...args);};assert.equal(await s.validator().report(s.input),'denied');assert.equal((await s.read()).revision,0);}});
test('unconfigured server authentication defaults disabled, no adapters invoked',async()=>{assert.equal(await createCompletionEvidenceValidator().report({}),'disabled');});
test('test issuer cannot instantiate in production',()=>{assert.throws(()=>load('./test-support/memory-upload-evidence.ts','production').createMemoryEvidenceLab([]),/test-only/);});
test('untrusted adapter errors are denied without exposing raw errors',async()=>{const s=setup();s.lab.adapters.reporter.verify=async()=>{throw Error('private details');};assert.equal(await s.validator().report(s.input),'denied');});
test('evidence identifiers already consumed by another job are rejected globally',async()=>{
 const a=setup();const secondBinding={...a.binding,requestId:id(90),photoId:id(91),dispatchId:id(92),path:`${a.binding.activityId}/${id(91)}.jpg`};
 const lab=createMemoryEvidenceLab([{binding:a.binding,revision:0,phase:'awaiting_evidence',deleteRequested:false},{binding:secondBinding,revision:0,phase:'awaiting_evidence',deleteRequested:false}]);
 const validator=createCompletionEvidenceValidator(lab.adapters);
 const report=binding=>({requestId:binding.requestId,slot:0,adminContext:lab.issueAdministrator(binding.actorId),reporterContext:lab.issueReporter(a.subject),proofs:a.facts.map(f=>lab.issueEvidence({...f,binding},a.subject))});
 assert.equal(await validator.report(report(a.binding)),'accepted');
 assert.equal(await validator.report(report(secondBinding)),'denied');
 assert.equal((await lab.adapters.ledger.read(secondBinding.requestId,0)).revision,0);
});
test('evidence binding enforces exact new activity-photo byte boundary',async()=>{
 const {validEvidenceBinding}=load('./upload-evidence.ts');const s=setup();
 assert.equal(validEvidenceBinding({...s.binding,size:4_718_592}),true);
 assert.equal(validEvidenceBinding({...s.binding,size:4_718_593}),false);
});
