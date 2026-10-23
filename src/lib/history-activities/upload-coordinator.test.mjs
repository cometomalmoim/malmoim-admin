import { policyModule } from './photo-policy.test-support.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const loaded = { exports: {} };
const { outputText } = ts.transpileModule(readFileSync(new URL('./upload-coordinator.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
runInNewContext(outputText, { module: loaded, exports: loaded.exports, Uint8Array, AbortController, setTimeout, clearTimeout,
  require: name => { if (name.endsWith('photo-policy')) return policyModule; if (name === 'server-only') return {}; assert.equal(name, 'node:crypto'); return require(name); } });
const { createUploadCoordinator, validateActivityPhotoBatch, ACTIVITY_PHOTO_BUCKET } = loaded.exports;
const actor = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const activity = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const request = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const photoId = i => `dddddddd-dddd-4ddd-8ddd-${String(i).padStart(12, '0')}`;
const ticket = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const input = () => ({ requestId: request, activityId: activity, files: [{ bytes: new Uint8Array([255,216,255]), mime: 'image/jpeg' }] });
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
async function until(predicate) { for (let i = 0; i < 100; i++) { if (predicate()) return; await new Promise(resolve => setImmediate(resolve)); } assert.fail('Mock milestone not reached'); }
function setup() {
  const records = new Map(); const calls = []; let admin = true; let deleted = false;
  const state = { revision: 1, count: 0, bytes: 0 };
  const journal = {
    async claim(record) { if (records.has(record.requestId)) return false; records.set(record.requestId, structuredClone(record)); return true; },
    async read(id) { return records.has(id) ? structuredClone(records.get(id)) : null; },
    async compareAndSwap(id, revision, next) { if (records.get(id)?.revision !== revision) return false; records.set(id, structuredClone(next)); return true; },
  };
  const adapters = {
    admin: { async requireAdmin() { if (!admin) throw Error('PRIVATE_AUTH_ERROR'); return { actorId: actor }; } }, journal,
    activity: {
      async snapshot() { return { ...state, deletionPending: deleted }; },
      async reserve(x) { calls.push('reserve'); assert.equal(x.revision, state.revision++); validateActivityPhotoBatch(x.files, state); return x.files.map((file,i) => ({ ...file, photoId: photoId(i), path: `${activity}/${photoId(i)}.jpg` })); },
      async begin(x) { calls.push('begin'); assert.equal(x.revision, state.revision++); return { ticket }; },
      async end(x) { calls.push('end'); assert.equal(x.ticket, ticket); assert.equal(x.revision, state.revision++); },
    },
    storage: {
      async upload(x) { calls.push('upload'); assert.equal(x.bucket, ACTIVITY_PHOTO_BUCKET); assert.equal(x.upsert, false); return 'stored'; },
      async verify(x) { calls.push('verify'); assert.equal(x.bucket, ACTIVITY_PHOTO_BUCKET); return true; },
    },
  };
  return { adapters, records, calls, state, revoke() { admin = false; }, delete() { deleted = true; state.revision++; },
    coordinator: (options = {}) => createUploadCoordinator(adapters, { enabled: true, ...options }) };
}
test('disabled by default: no auth/journal/storage side effect', async () => {
  const s=setup(); const r=await createUploadCoordinator(s.adapters).upload(input()); assert.equal(r.phase,'disabled'); assert.equal(s.records.size,0); assert.deepEqual(s.calls,[]);
});
test('successful attempt follows reserve/begin/upload/verify/end and hides server fields', async () => {
  const s=setup(); const r=await s.coordinator().upload(input()); assert.equal(r.phase,'succeeded');
  assert.deepEqual(s.calls,['reserve','begin','upload','verify','end']); assert.equal(s.records.get(request).completed,1);
  assert.ok(!JSON.stringify(r).includes(ticket)); assert.ok(!JSON.stringify(r).includes('path')); assert.ok(!JSON.stringify(r).includes(actor));
});
test('confirmed remote rejection closes ticket and reports failure', async () => {
  const s=setup(); s.adapters.storage.upload=async()=>{s.calls.push('upload');return 'rejected';};
  const r=await s.coordinator().upload(input()); assert.equal(r.phase,'failed'); assert.equal(r.issue,'storage_rejected'); assert.ok(s.calls.includes('end')); assert.ok(!s.calls.includes('verify'));
});
test('transport error remains uncertain and never closes ticket', async () => {
  const s=setup(); s.adapters.storage.upload=async()=>{throw Error('PRIVATE_TOKEN');};
  const r=await s.coordinator().upload(input()); assert.equal(r.phase,'uncertain'); assert.ok(!s.calls.includes('end')); assert.ok(!JSON.stringify(s.records.get(request)).includes('PRIVATE_TOKEN'));
});
test('deadline then late success cannot silently complete or repeat upload', async () => {
  const s=setup(); const late=deferred(); let uploads=0;
  s.adapters.storage.upload=()=>{uploads++;return late.promise;}; const c=s.coordinator({timeoutMs:5});
  assert.equal((await c.upload(input())).phase,'uncertain'); late.resolve('stored'); await new Promise(resolve=>setImmediate(resolve));
  assert.equal((await c.upload(input())).phase,'uncertain'); assert.equal(uploads,1); assert.ok(!s.calls.includes('end'));
});
test('browser abort stops waiting, not remote upload; late success stays uncertain', async () => {
  const s=setup(); const late=deferred(); const abort=new AbortController(); let started=false;
  s.adapters.storage.upload=()=>{started=true;return late.promise;}; const c=s.coordinator(); const work=c.upload({...input(),signal:abort.signal});
  await until(()=>started); abort.abort(); assert.equal((await work).phase,'uncertain'); late.resolve('stored');
  await new Promise(resolve=>setImmediate(resolve)); assert.equal((await c.inspect(request)).phase,'uncertain'); assert.ok(!s.calls.includes('end'));
});
test('concurrent same-ID calls across coordinator instances upload once', async () => {
  const s=setup(); const late=deferred(); let uploads=0; s.adapters.storage.upload=()=>{uploads++;return late.promise;};
  const c1=s.coordinator(); const c2=s.coordinator(); const first=c1.upload(input()); await until(()=>uploads===1);
  const other=await c2.upload(input()); assert.equal(other.needsReview,true); late.resolve('stored'); assert.equal((await first).phase,'succeeded'); assert.equal(uploads,1);
  assert.equal((await c2.upload(input())).phase,'succeeded'); assert.equal(uploads,1);
});
test('same request ID with changed bytes is rejected', async () => {
  const s=setup(); const c=s.coordinator(); await c.upload(input()); const changed=input(); changed.files[0].bytes[0]=1;
  await assert.rejects(c.upload(changed),/conflict/); assert.equal(s.calls.filter(x=>x==='upload').length,1);
});
test('deletion during upload preserves deletion state while closing a confirmed terminated attempt', async () => {
  const s=setup(); const late=deferred(); let started=false; s.adapters.storage.upload=()=>{started=true;return late.promise;};
  const c=s.coordinator(); const work=c.upload(input()); await until(()=>started); await c.noteDeletion(request); s.delete(); late.resolve('stored');
  const r=await work; assert.equal(r.phase,'deletion_pending'); assert.ok(s.calls.includes('end')); assert.equal(s.records.get(request).deleteRequested,true);
});
test('deletion during verification cannot be overwritten by success', async () => {
  const s=setup(); const late=deferred(); let verifying=false; s.adapters.storage.verify=()=>{verifying=true;return late.promise;};
  const c=s.coordinator(); const work=c.upload(input()); await until(()=>verifying); await c.noteDeletion(request); late.resolve(true);
  assert.equal((await work).phase,'deletion_pending');
});
test('restart inspects persisted mid-upload state without reissuing any operation', async () => {
  const s=setup(); const late=deferred(); let started=false; s.adapters.storage.upload=()=>{started=true;return late.promise;};
  const abort=new AbortController();
  const work=s.coordinator().upload({...input(),signal:abort.signal}); await until(()=>started);
  const restarted=s.coordinator(); const before=s.calls.length; const r=await restarted.inspect(request);
  assert.equal(r.phase,'uploading'); assert.equal(r.needsReview,true); await restarted.upload(input()); assert.equal(s.calls.length,before);
  abort.abort(); assert.equal((await work).phase,'uncertain'); late.resolve('stored');
});
test('revoked administrator after Storage result cannot close ticket or declare success', async () => {
  const s=setup(); s.adapters.storage.upload=async()=>{s.revoke();return 'stored';};
  const r=await s.coordinator().upload(input()); assert.equal(r.phase,'uncertain'); assert.ok(!s.calls.includes('end'));
  await assert.rejects(s.coordinator().inspect(request),/Administrator required/);
});
test('lost begin RPC response keeps stable operation ID and never starts Storage on retry', async () => {
  const s=setup(); s.adapters.activity.begin=async()=>{s.calls.push('begin');throw Error('RESPONSE_LOST');}; const c=s.coordinator();
  assert.equal((await c.upload(input())).phase,'uncertain'); const id=s.records.get(request).beginIds[0]; await c.upload(input());
  assert.equal(s.records.get(request).beginIds[0],id); assert.equal(s.calls.filter(x=>x==='begin').length,1); assert.ok(!s.calls.includes('upload'));
});
test('failed durable journal prevents upload', async () => {
  const s=setup(); s.adapters.journal.claim=async()=>{throw Error('JOURNAL_UNAVAILABLE');};
  await assert.rejects(s.coordinator().upload(input()),/JOURNAL_UNAVAILABLE/); assert.deepEqual(s.calls,[]);
});
test('validation failure is terminal only after verified remote termination', async () => {
  const s=setup(); s.adapters.storage.verify=async()=>false;
  const r=await s.coordinator().upload(input()); assert.equal(r.phase,'failed'); assert.equal(r.issue,'invalid_file'); assert.ok(s.calls.includes('end'));
});
test('malformed/outside-bucket reservation path is rejected before upload', async () => {
  const s=setup(); s.adapters.activity.reserve=async()=>[{photoId:photoId(0),path:'history-review-photos/other',mime:'image/jpeg',size:3}];
  assert.equal((await s.coordinator().upload(input())).phase,'uncertain'); assert.ok(!s.calls.includes('upload'));
});
test('batch limits include prior reservations and exact 4.5MiB/45MiB boundaries', () => {
  const MB=1024*1024; const file=size=>({size,mime:'image/jpeg'}); const empty={count:0,bytes:0};
  validateActivityPhotoBatch(Array.from({length:10},()=>file(4.5*MB)),empty);
  assert.throws(()=>validateActivityPhotoBatch(Array.from({length:11},()=>file(1)),empty));
  assert.throws(()=>validateActivityPhotoBatch([file(4.5*MB+1)],empty));
  assert.throws(()=>validateActivityPhotoBatch([file(1)],{count:10,bytes:1}));
  assert.throws(()=>validateActivityPhotoBatch([file(1)],{count:9,bytes:45*MB}));
  assert.throws(()=>validateActivityPhotoBatch([file(0)],empty));
  assert.throws(()=>validateActivityPhotoBatch([{size:1,mime:'image/gif'}],empty));
});

test('ten files upload in order with fixed bucket, eleven fail before any reservation', async () => {
  const s=setup(); const ten=input(); ten.files=Array.from({length:10},()=>input().files[0]);
  assert.equal((await s.coordinator().upload(ten)).phase,'succeeded');
  assert.equal(s.calls.filter(x=>x==='upload').length,10);
  const other=setup(); const eleven=input(); eleven.files=Array.from({length:11},()=>input().files[0]);
  await assert.rejects(other.coordinator().upload(eleven),/limits/); assert.deepEqual(other.calls,[]); assert.equal(other.records.size,0);
});
test('lost end response never reissues end or upload automatically', async () => {
  const s=setup(); s.adapters.activity.end=async()=>{s.calls.push('end');throw Error('END_RESPONSE_LOST');}; const c=s.coordinator();
  assert.equal((await c.upload(input())).phase,'uncertain'); await c.upload(input());
  assert.equal(s.calls.filter(x=>x==='end').length,1); assert.equal(s.calls.filter(x=>x==='upload').length,1);
});
test('revoked administrator cannot start work', async () => {
  const s=setup(); s.revoke(); await assert.rejects(s.coordinator().upload(input()),/Administrator required/);
  assert.equal(s.records.size,0); assert.deepEqual(s.calls,[]);
});
