import {test} from 'node:test';import assert from 'node:assert/strict';
import {OfflineApplicantAdapter,OfflinePdfStore,OfflinePdfRecovery,transitionOfflineRequest} from '../src/lib/esign-integration-fixtures.ts';
import {normalizeApplicantKey,validApplicantKey,inspectSigningTarget} from '../src/lib/esign-server-contracts.ts';
import {PreviewService} from '../src/lib/esign-preview-server.ts';
const key={event_id:'abcdefab-1111-4111-8111-111111111111',source:'manual',application_id:'abcdefab-2222-4222-8222-222222222222'};
const snapshot=()=>({...key,name:'가상 대상',status:'accepted',confirmation:null,phone:'+821000000001',contactType:'phone',revision:1,selectionRevoked:false,archived:false});
const pdf=new TextEncoder().encode('%PDF-1.7\nTEST ONLY'),hash='a'.repeat(64);
function request(){const p=new PreviewService(),a=p.applicants[0];return p.execute('fixture-admin',{operation:'validate',eventId:a.event_id,keys:[a],documentId:'fixture-template-1',version:1,days:1,idempotencyKey:'fixture-123'}).body.result.requests[0];}
test('strict source typing, UUID normalization, whitespace and invalid snapshot rejection',async()=>{
 for(const source of [['manual'],{toString:()=> 'manual'},null,1])assert.equal(validApplicantKey({...key,source}),false);
 assert.throws(()=>normalizeApplicantKey({...key,event_id:' '+key.event_id}),/INVALID/);
 const upper={...key,event_id:key.event_id.toUpperCase(),application_id:key.application_id.toUpperCase()};assert.deepEqual(normalizeApplicantKey(upper),key);
 const adapter=new OfflineApplicantAdapter([{...snapshot(),...upper}]);assert.deepEqual((await adapter.find(key)).event_id,key.event_id);
 const a=await adapter.find(key);a.status='withdrawn';assert.equal((await adapter.find(key)).status,'accepted');
 assert.throws(()=>adapter.replace({...snapshot(),revision:NaN}),/INVALID/);
 assert.throws(()=>adapter.replace({...snapshot(),archived:'false'}),/INVALID/);
});
test('fresh offline lookup rejects archive, cancellation and changed contact; unknown policy stays held',async()=>{
 const adapter=new OfflineApplicantAdapter([snapshot()]),auth={async currentAdmin(){return {id:'test-admin',eventIds:[key.event_id]};}};
 assert.equal((await inspectSigningTarget(auth,adapter,key)).code,'OK');
 for(const [patch,code]of [[{archived:true},'ARCHIVED'],[{archived:undefined},'ARCHIVE_POLICY_HOLD'],[{status:'reviewing',confirmation:'confirmed'},'POLICY_HOLD'],[{confirmation:'cancelled'},'PARTICIPATION_CANCELLED'],[{phone:null},'INVALID_PHONE']]){
  adapter.replace({...snapshot(),...patch});assert.equal((await inspectSigningTarget(auth,adapter,key)).code,code);
 }
});
test('offline transitions preserve history, enforce time and never authorize reissue',()=>{
 const r=request();assert.throws(()=>transitionOfflineRequest(r,'expire',r.createdAt),/NOT_EXPIRED/);
 const expired=transitionOfflineRequest(r,'expire',r.expiresAt);assert.equal(expired.status,'expired');assert.equal(expired.history.length,r.history.length+1);
 assert.deepEqual(transitionOfflineRequest(expired,'expire',r.expiresAt),expired);
 const cancelled=transitionOfflineRequest(r,'cancel',r.createdAt);assert.deepEqual(transitionOfflineRequest(cancelled,'cancel',r.createdAt),cancelled);
 for(const row of [r,expired,cancelled])assert.throws(()=>transitionOfflineRequest(row,'reissue',r.expiresAt),/POLICY_HOLD/);
 assert.throws(()=>transitionOfflineRequest({...r,status:'completed'},'cancel',r.createdAt),/IMMUTABLE/);
});
test('render failure then upload failure remain retryable, without duplicate artifacts',async()=>{
 const store=new OfflinePdfStore(),jobs=new OfflinePdfRecovery(store);let renders=0;
 const render=async()=>{renders++;if(renders===1)throw new Error('RENDER_FAILED');return pdf;};
 await assert.rejects(jobs.run('job-1',hash,render,async()=>{}),/RENDER_FAILED/);assert.equal(store.get('job-1'),undefined);
 store.failUploads=1;await assert.rejects(jobs.run('job-1',hash,render,async()=>{}),/UPLOAD_FAILED/);assert.equal(jobs.state('job-1'),'pending');
 await jobs.run('job-1',hash,render,async()=>{});assert.equal(renders,2);assert.equal(store.uploads,1);assert.equal(jobs.state('job-1'),'completed');
});
test('lost finalization response preserves uploaded file and retries same operation',async()=>{
 const store=new OfflinePdfStore(),jobs=new OfflinePdfRecovery(store);let finalizations=0;const receipts=new Set();
 const finalize=async h=>{receipts.add(h);if(++finalizations===1)throw new Error('RESPONSE_LOST');};
 await assert.rejects(jobs.run('job-2',hash,async()=>pdf,finalize),/RESPONSE_LOST/);assert.equal(jobs.state('job-2'),'uploaded');assert.ok(store.get('job-2'));
 await jobs.run('job-2',hash,async()=>{throw new Error('must reuse');},finalize);assert.equal(receipts.size,1);assert.equal(store.uploads,1);
});
test('concurrent identical submissions share one generation/upload/finalization; changed payload denied',async()=>{
 const store=new OfflinePdfStore(),jobs=new OfflinePdfRecovery(store);let renders=0,commits=0;
 const run=()=>jobs.run('job-3',hash,async()=>{renders++;return pdf;},async()=>{commits++;});
 const [a,b]=await Promise.all([run(),run()]);assert.equal(a,b);assert.equal(renders,1);assert.equal(commits,1);assert.equal(store.uploads,1);
 await assert.rejects(jobs.run('job-3','b'.repeat(64),async()=>pdf,async()=>{}),/IDEMPOTENCY_CONFLICT/);
 await assert.rejects(store.put('job-3',new TextEncoder().encode('%PDF-other')),/ARTIFACT_CONFLICT/);
 const copy=store.get('job-3');copy.bytes[0]=0;assert.equal(store.get('job-3').bytes[0],37);
});
