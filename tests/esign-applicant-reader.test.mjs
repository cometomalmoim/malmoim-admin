import {test} from 'node:test';import assert from 'node:assert/strict';
import {EsignApplicantReader} from '../src/lib/esign-applicant-reader.ts';
import {inspectSigningTarget} from '../src/lib/esign-server-contracts.ts';
import {AsyncMemoryRequestRepository} from '../src/lib/esign-request-repository.ts';
const key={event_id:'11111111-1111-4111-8111-111111111111',source:'manual',application_id:'22222222-2222-4222-8222-222222222222'};
const base=()=>({id:key.application_id,event_id:key.event_id,source:key.source,name:'가상 대상',contact:'+821000000001',contact_type:'phone',status:'accepted',revision:2,is_archived:false,archive_revision:0});
const auth={async currentAdmin(){return{id:'test-admin',eventIds:[key.event_id]};}};
function fixture(){let app=base(),part=null;const calls=[];const source={async read(work){const a=structuredClone(app),p=structuredClone(part);return work({async one(table,columns,filters){calls.push({table,columns,filters});if(table==='recruitment_events')return{id:key.event_id};if(filters.event_id!==key.event_id||filters.source!==a.source||(filters.id??filters.application_id)!==a.id)return null;return table==='event_application_admin_list'?a:p;}});}};
 return{reader:new EsignApplicantReader(source),calls,set(patch){app={...app,...patch};},part(value){part=value;}};}
test('reads effective admin view with every compound key and participation/archive revisions',async()=>{
 const f=fixture();assert.equal((await inspectSigningTarget(auth,f.reader,key)).code,'OK');const row=await f.reader.find(key);assert.equal(row.revision,2);assert.equal(row.archiveRevision,0);assert.equal(row.participationRevision,null);
 assert.equal(f.calls[1].table,'event_application_admin_list');assert.deepEqual(f.calls[1].filters,{event_id:key.event_id,source:key.source,id:key.application_id});
 assert.deepEqual(f.calls[2].filters,{event_id:key.event_id,source:key.source,application_id:key.application_id});
});
test('effective state changes are read fresh; selection, archive and confirm-only policy remain conservative',async()=>{
 const f=fixture();for(const [patch,code]of [[{status:'waitlisted'},'WAITLISTED'],[{status:'declined'},'DECLINED'],[{status:'withdrawn'},'WITHDRAWN'],[{status:'accepted',is_archived:true},'ARCHIVED'],[{is_archived:null},'ARCHIVE_POLICY_HOLD'],[{status:'reviewing',is_archived:false},'POLICY_HOLD']]){
  if(code==='POLICY_HOLD')f.part({...key,confirmation:'confirmed',revision:3});f.set({...patch,revision:4});assert.equal((await inspectSigningTarget(auth,f.reader,key)).code,code);
 }
 f.set({status:'accepted'});f.part({...key,confirmation:'cancelled',revision:5});assert.equal((await inspectSigningTarget(auth,f.reader,key)).code,'PARTICIPATION_CANCELLED');
});
test('identical applicant IDs across event/source never fall back to name or phone',async()=>{
 const f=fixture();assert.equal(await f.reader.find({...key,source:'registration'}),undefined);
 await assert.rejects(f.reader.find({...key,event_id:'33333333-3333-4333-8333-333333333333'}),/EVENT_DATA_MISMATCH/);
 assert.equal((await inspectSigningTarget(auth,f.reader,{...key,event_id:'33333333-3333-4333-8333-333333333333'})).code,'EVENT_FORBIDDEN');
});
test('transport failures, missing fields, duplicate rows and wrong returned identity fail closed',async()=>{
 await assert.rejects(new EsignApplicantReader({async read(){throw new Error('private transport detail');}}).find(key),/^Error: APPLICANT_LOOKUP_FAILED$/);
 for(const raw of [[base(),base()],{...base(),revision:undefined},{...base(),status:'unknown'},{...base(),source:'season9'}]){
  const reader=new EsignApplicantReader({async read(work){return work({async one(table){return table==='recruitment_events'?{id:key.event_id}:raw;}});}});await assert.rejects(reader.find(key));
 }
 const f=fixture();f.part({...key,event_id:'33333333-3333-4333-8333-333333333333',confirmation:'confirmed',revision:1});await assert.rejects(f.reader.find(key),/MISMATCH/);
});
test('concurrent lookup and reservation keep one request; next lookup sees withdrawal',async()=>{
 const f=fixture(),repo=new AsyncMemoryRequestRepository();
 const reserve=async id=>{const a=await f.reader.find(key);return repo.transaction(async tx=>{await tx.save({id,key,name:a.name,document:{id:'test-document',name:'가상 서류',revision:1},applicantStatus:a.status,phoneSnapshot:a.phone,revisionSnapshot:a.revision,status:'pending',createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+86400000).toISOString(),completedAt:null,generation:1,history:[]});});};
 const results=await Promise.allSettled([reserve('one'),reserve('two')]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal((await repo.list([key.event_id])).length,1);
 f.set({status:'withdrawn',revision:3});assert.equal((await inspectSigningTarget(auth,f.reader,key)).code,'WITHDRAWN');
});
