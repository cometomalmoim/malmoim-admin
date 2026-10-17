import {test} from 'node:test';import assert from 'node:assert/strict';
import {validApplicantKey,signingEligibility,inspectSigningTarget,denyAdminSession} from '../src/lib/esign-server-contracts.ts';
import {AsyncMemoryRequestRepository} from '../src/lib/esign-request-repository.ts';
import {serverFixtures,PreviewService} from '../src/lib/esign-preview-server.ts';
const key={event_id:'11111111-1111-4111-8111-111111111111',source:'manual',application_id:'22222222-2222-4222-8222-222222222222'};
const row=()=>({...serverFixtures()[0],...key,archived:false});
test('compound identifier rejects missing, malformed and unsupported source; preview is explicit',()=>{
 assert.equal(validApplicantKey(key),true);
 for(const k of [null,{}, {...key,event_id:''},{...key,application_id:'preview-1'},{...key,source:'unknown'}])assert.equal(validApplicantKey(k),false);
 assert.equal(validApplicantKey({event_id:'preview-event-1',source:'manual',application_id:'preview-1'},'preview'),true);
});
test('temporary policy covers all application/confirmation combinations and archive holds',()=>{
 for(const status of ['received','reviewing','accepted','waitlisted','declined','withdrawn','unknown'])for(const confirmation of [null,'unconfirmed','confirmed','cancelled','unknown']){
  const result=signingEligibility({...row(),status,confirmation},key.event_id,true);
  assert.equal(result==='OK',status==='accepted'&&[null,'unconfirmed','confirmed'].includes(confirmation));
 }
 assert.equal(signingEligibility({...row(),archived:true},key.event_id,true),'ARCHIVED');
 assert.equal(signingEligibility({...row(),archived:undefined},key.event_id,true),'ARCHIVE_POLICY_HOLD');
 assert.equal(signingEligibility({...row(),phone:null},key.event_id,true),'INVALID_PHONE');
});
test('real-session contract defaults deny, checks scope and distrusts adapter identity',async()=>{
 let reads=0;const reader={async find(){reads++;return row();}};
 assert.equal((await inspectSigningTarget(denyAdminSession,reader,key)).code,'UNAUTHENTICATED');assert.equal(reads,0);
 const auth={async currentAdmin(){return {id:'admin',eventIds:[key.event_id]};}};
 assert.equal((await inspectSigningTarget(auth,reader,key)).code,'OK');
 assert.equal((await inspectSigningTarget({async currentAdmin(){return {id:'admin',eventIds:[]};}},reader,key)).code,'EVENT_FORBIDDEN');
 assert.equal((await inspectSigningTarget(auth,{async find(){return {...row(),application_id:key.event_id};}},key)).code,'EVENT_MISMATCH');
 assert.equal((await inspectSigningTarget(auth,{async find(){return undefined;}},key)).code,'APPLICANT_NOT_FOUND');
});
test('async repository serializes duplicates and rolls back rows plus replay on failure',async()=>{
 const preview=new PreviewService();const a=preview.applicants[0];const result=preview.execute('fixture-admin',{operation:'validate',eventId:a.event_id,keys:[a],documentId:'fixture-template-1',version:1,days:7,idempotencyKey:'async-test-123'});
 const r=result.body.result.requests[0],repo=new AsyncMemoryRequestRepository();
 await assert.rejects(repo.transaction(async tx=>{await tx.save(r);await tx.remember('key',{payload:'p',ids:[r.id]});throw new Error('abort');}),/abort/);
 assert.deepEqual(await repo.list([a.event_id]),[]);
 await repo.transaction(async tx=>assert.equal(await tx.replay('key'),undefined));
 const results=await Promise.allSettled([repo.transaction(async tx=>tx.save(r)),repo.transaction(async tx=>tx.save({...r,id:'other'}))]);
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
});
