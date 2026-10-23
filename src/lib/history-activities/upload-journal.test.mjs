import { policyModule } from './photo-policy.test-support.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
const require = createRequire(import.meta.url);
function load(file, dependencies = {}, mode = 'test') {
  const loaded = { exports: {} };
  const { outputText } = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  runInNewContext(outputText, { module: loaded, exports: loaded.exports, structuredClone, Uint8Array, setTimeout, clearTimeout,
    process: { env: { NODE_ENV: mode } }, require: name => { if (name.endsWith('photo-policy')) return policyModule;
      if (name === 'server-only') return {};
      if (name === 'node:crypto') return require(name);
      assert.ok(Object.hasOwn(dependencies, name), `Unexpected import ${name}`); return dependencies[name];
    } });
  return loaded.exports;
}
const contract = load('./upload-journal.ts');
const memory = mode => load('./test-support/memory-upload-journal.ts', { '../upload-journal': contract }, mode);
const { createUploadCoordinator } = load('./upload-coordinator.ts');
const initial = () => ({ requestId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', activityId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', actorId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', fingerprint: 'mock-fingerprint', revision: 0, phase: 'claimed', deleteRequested: false, reserveId: 'reserve', beginIds: ['begin'], endIds: ['end'], photos: [], attempts: [null], tickets: [null], completed: 0 });
const backend = () => memory().createMemoryUploadJournalBackend();
test('test-only factory refuses development and production', () => {
  for (const mode of ['production', 'development']) assert.throws(() => memory(mode).createMemoryUploadJournalBackend(), /test-only/);
});
test('concurrent claims share one winner across worker connections', async () => {
  const store = backend(); const a = store.connect(); const b = store.connect();
  const results = await Promise.all([a.claim(initial()), b.claim(initial())]);
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal((await a.read(initial().requestId)).revision, 0);
});
test('stale CAS loses without overwriting state or confirmation', async () => {
  const journal = backend().connect(); const record = initial(); await journal.claim(record);
  const results = await Promise.all([
    journal.compareAndSwap(record.requestId, 0, { ...record, revision: 1, phase: 'reserved' }),
    journal.compareAndSwap(record.requestId, 0, { ...record, revision: 1, phase: 'failed' }),
  ]);
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(await journal.confirm(record.requestId, 0, {kind:'reservation',photoIndex:null}), false);
  assert.equal((await journal.read(record.requestId)).phase, 'reserved');
});
test('new worker restores incomplete state and detached snapshots without starting IO', async () => {
  const store = backend(); let worker = store.connect(); const record = initial();
  await worker.claim(record); await worker.compareAndSwap(record.requestId, 0, {...record, revision:1, phase:'uploading',tickets:['issued-ticket']});
  worker = store.connect(); const restored = await worker.listForRecovery();
  assert.equal(restored[0].record.tickets[0], 'issued-ticket');
  restored[0].record.tickets[0] = 'mutated';
  assert.equal((await worker.read(record.requestId)).tickets[0], 'issued-ticket');
  assert.equal(await worker.claim(record), false);
});
test('deletion intent is monotonic and cannot be converted to upload success', async () => {
  const journal = backend().connect(); const record = initial(); await journal.claim(record);
  const pending = {...record, revision:1, deleteRequested:true, phase:'deletion_pending'};
  await journal.compareAndSwap(record.requestId,0,pending);
  await assert.rejects(journal.compareAndSwap(record.requestId,1,{...pending,revision:2,phase:'succeeded'}),/evidence|transition/);
  await assert.rejects(journal.compareAndSwap(record.requestId,1,{...pending,revision:2,deleteRequested:false}),/transition/);
  assert.equal((await journal.listForRecovery()).length,1);
});
test('last confirmation is explicit, versioned and never inferred from elapsed time', async () => {
  let time=100; const journal=backend().connect(contract.JOURNAL_BUCKET,()=>time); const record=initial();
  await journal.claim(record); time=10000;
  await journal.compareAndSwap(record.requestId,0,{...record,revision:1,phase:'uncertain'});
  assert.equal((await journal.inspectEntry(record.requestId)).lastConfirmedAt,null);
  await assert.rejects(journal.confirm(record.requestId,1,{kind:'ticket_issued',photoIndex:0}),/evidence/);
  await journal.compareAndSwap(record.requestId,1,{...record,revision:2,phase:'uncertain',tickets:['ticket']});
  await journal.confirm(record.requestId,2,{kind:'ticket_issued',photoIndex:0});
  const entry=await journal.inspectEntry(record.requestId);
  assert.equal(entry.lastConfirmedAt,10000); assert.equal(entry.record.revision,3);
  assert.equal(entry.record.phase,'uncertain');
});
test('bucket scope, immutable operation IDs and ticket preservation are enforced', async () => {
  const store=backend(); assert.throws(()=>store.connect('history-review-photos'),/bucket/);
  const journal=store.connect();const record=initial();await journal.claim(record);
  await assert.rejects(journal.compareAndSwap(record.requestId,0,{...record,revision:1,reserveId:'other'}),/transition/);
  await journal.compareAndSwap(record.requestId,0,{...record,revision:1,tickets:['ticket']});
  await assert.rejects(journal.compareAndSwap(record.requestId,1,{...record,revision:2}),/transition/);
});
function setup() {
  const store=backend(); const record=initial(); let uploads=0; let revoked=false; let deleting=false;
  const adapters={journal:store.connect(),admin:{async requireAdmin(){if(revoked)throw Error('revoked');return {actorId:record.actorId};}},
    activity:{async snapshot(){return {revision:1,count:0,bytes:0,deletionPending:deleting};},
      async reserve({files}){return files.map(file=>({...file,photoId:record.requestId,path:`${record.activityId}/${record.requestId}.jpg`}));},
      async begin(){return {ticket:record.requestId};},async end(){}},
    storage:{async upload({bucket}){assert.equal(bucket,contract.JOURNAL_BUCKET);uploads++;return 'stored';},async verify(){return true;}}};
  return {store,adapters,input:{requestId:record.requestId,activityId:record.activityId,files:[{bytes:new Uint8Array([1]),mime:'image/jpeg'}]},
    uploads:()=>uploads,revoke:()=>{revoked=true;},deleting:()=>{deleting=true;}};
}
test('real coordinator with shared mock journals uploads concurrent request only once', async()=>{
  const s=setup();const a=createUploadCoordinator(s.adapters,{enabled:true});const b=createUploadCoordinator({...s.adapters,journal:s.store.connect()},{enabled:true});
  await Promise.all([a.upload(s.input),b.upload(s.input)]);assert.equal(s.uploads(),1);
});
test('timeout remains uncertain across new worker and late remote success', async()=>{
  const s=setup();let finish;s.adapters.storage.upload=()=>new Promise(resolve=>{finish=resolve;});
  const result=await createUploadCoordinator(s.adapters,{enabled:true,timeoutMs:5}).upload(s.input);
  assert.equal(result.phase,'uncertain');finish('stored');await new Promise(resolve=>setImmediate(resolve));
  const worker=createUploadCoordinator({...s.adapters,journal:s.store.connect()},{enabled:true});
  assert.equal((await worker.upload(s.input)).phase,'uncertain');assert.equal((await s.store.connect().listForRecovery()).length,1);
});
test('deletion pending blocks storage and revoked administrator cannot restore work',async()=>{
  const s=setup();s.deleting();const worker=createUploadCoordinator(s.adapters,{enabled:true});
  assert.equal((await worker.upload(s.input)).phase,'deletion_pending');assert.equal(s.uploads(),0);
  s.revoke();await assert.rejects(worker.inspect(s.input.requestId),/Administrator/);assert.equal(s.uploads(),0);
});
test('repeated version conflicts stop coordinator before Storage IO', async()=>{
  const s=setup();const journal=s.adapters.journal;
  s.adapters.journal={...journal,async compareAndSwap(){return false;}};
  const result=await createUploadCoordinator(s.adapters,{enabled:true}).upload(s.input);
  assert.equal(result.phase,'uncertain');assert.equal(s.uploads(),0);
  assert.equal((await journal.read(s.input.requestId)).phase,'claimed');
  assert.equal((await journal.listForRecovery()).length,1);
});
test('memory record contract rejects eleven slots and oversized photo metadata',async()=>{
  const journal=backend().connect();const record=initial();
  await assert.rejects(journal.claim({...record,beginIds:Array(11).fill('begin'),endIds:Array(11).fill('end'),tickets:Array(11).fill(null)}),/Invalid journal record/);
  await journal.claim(record);
  await assert.rejects(journal.compareAndSwap(record.requestId,0,{...record,revision:1,photos:[{photoId:record.requestId,path:`${record.activityId}/${record.requestId}.jpg`,size:4.5*1024*1024+1,mime:'image/jpeg'}]}),/Invalid journal record/);
});
test('intent precedes adapter entry; success response and byte verification precede completion',async()=>{
  const s=setup();const journal=s.adapters.journal;
  s.adapters.storage.upload=async()=>{
    const record=await journal.read(s.input.requestId);
    assert.equal(record.attempts[0].dispatch,'invoked');
    assert.equal(record.attempts[0].response,'unknown');
    assert.equal((await journal.inspectEntry(s.input.requestId)).lastConfirmedAt,null);
    return 'stored';
  };
  s.adapters.storage.verify=async()=>{
    const record=await journal.read(s.input.requestId);
    assert.equal(record.attempts[0].response,'stored');assert.equal(record.attempts[0].verification,'pending');
    assert.equal(record.completed,0);return true;
  };
  assert.equal((await createUploadCoordinator(s.adapters,{enabled:true}).upload(s.input)).phase,'succeeded');
  const entry=await journal.inspectEntry(s.input.requestId);
  assert.equal(entry.record.attempts[0].endConfirmed,true);assert.equal(entry.confirmation.kind,'file_verified');
  assert.ok(entry.lastConfirmedAt!==null);
});
test('abort after intent commit never invokes Storage or records success evidence',async()=>{
  const s=setup();const controller=new AbortController();const journal=s.adapters.journal;
  s.adapters.journal={...journal,async compareAndSwap(id,revision,next){
    const accepted=await journal.compareAndSwap(id,revision,next);
    if(accepted && next.attempts[0]?.dispatch==='intent_recorded')controller.abort();
    return accepted;
  }};
  assert.equal((await createUploadCoordinator(s.adapters,{enabled:true}).upload({...s.input,signal:controller.signal})).phase,'uncertain');
  const entry=await journal.inspectEntry(s.input.requestId);
  assert.equal(s.uploads(),0);assert.equal(entry.record.attempts[0].dispatch,'intent_recorded');assert.equal(entry.lastConfirmedAt,null);
});
test('response loss restores unknown attempt without redispatch or confirmation timestamp',async()=>{
  const s=setup();let calls=0;s.adapters.storage.upload=async()=>{calls++;throw Error('lost response');};
  await createUploadCoordinator(s.adapters,{enabled:true}).upload(s.input);
  const journal=s.store.connect();const next=createUploadCoordinator({...s.adapters,journal},{enabled:true});
  assert.equal((await next.upload(s.input)).phase,'uncertain');assert.equal(calls,1);
  const entry=await journal.inspectEntry(s.input.requestId);
  assert.equal(entry.record.attempts[0].response,'unknown');assert.equal(entry.record.attempts[0].endConfirmed,false);assert.equal(entry.lastConfirmedAt,null);
});
test('no response or verification evidence means completion and explicit proof are refused',async()=>{
  const journal=backend().connect();const record=initial();await journal.claim(record);
  await assert.rejects(journal.compareAndSwap(record.requestId,0,{...record,revision:1,completed:1,phase:'succeeded'}),/evidence/);
  await assert.rejects(journal.confirm(record.requestId,0,{kind:'file_verified',photoIndex:0}),/evidence/);
  assert.equal((await journal.read(record.requestId)).revision,0);
});
test('dispatch CAS conflict stops before adapter entry',async()=>{
  const s=setup();const journal=s.adapters.journal;
  s.adapters.journal={...journal,async compareAndSwap(id,revision,next){
    if(next.attempts[0]?.dispatch==='intent_recorded')return false;
    return journal.compareAndSwap(id,revision,next);
  }};
  assert.equal((await createUploadCoordinator(s.adapters,{enabled:true}).upload(s.input)).phase,'uncertain');assert.equal(s.uploads(),0);
});
test('administrator revoked after intent commit cannot dispatch',async()=>{
  const s=setup();const journal=s.adapters.journal;
  s.adapters.journal={...journal,async compareAndSwap(id,revision,next){
    const accepted=await journal.compareAndSwap(id,revision,next);
    if(accepted && next.attempts[0]?.dispatch==='intent_recorded')s.revoke();return accepted;
  }};
  assert.equal((await createUploadCoordinator(s.adapters,{enabled:true}).upload(s.input)).phase,'uncertain');assert.equal(s.uploads(),0);
});
