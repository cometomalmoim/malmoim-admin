import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {resolveExternalAccountKey,EXTERNAL_ACCOUNT_LOCAL_KEY_FILE} from '../src/lib/external-account-key.mjs';

function directory(t){
  const root=resolve(tmpdir());const path=mkdtempSync(join(root,'external-key-test-'));
  t.after(()=>{assert.ok(resolve(path).startsWith(join(root,'external-key-test-')));rmSync(path,{recursive:true,force:true});});return path;
}
test('development/test fallback persists one random 32-byte key across independent loads',t=>{
  const path=directory(t);
  const first=resolveExternalAccountKey({env:{NODE_ENV:'development'},directory:path});
  const second=resolveExternalAccountKey({env:{NODE_ENV:'test'},directory:path});
  assert.equal(first.length,32);assert.deepEqual(first,second);
  assert.equal(readFileSync(join(path,EXTERNAL_ACCOUNT_LOCAL_KEY_FILE),'utf8').trim(),first.toString('hex'));
});
test('explicit keys take priority and malformed keys never silently rotate to a fallback',t=>{
  const path=directory(t);const messages=[];
  const original=resolveExternalAccountKey({env:{NODE_ENV:'test'},directory:path});
  const supplied='ad'.repeat(32);
  assert.equal(resolveExternalAccountKey({env:{NODE_ENV:'production',EXTERNAL_ACCOUNTS_ENCRYPTION_KEY:supplied},directory:path}).toString('hex'),supplied);
  assert.throws(()=>resolveExternalAccountKey({env:{NODE_ENV:'development',EXTERNAL_ACCOUNTS_ENCRYPTION_KEY:'private-invalid-value'},directory:path,report:message=>messages.push(message)}));
  assert.ok(messages[0].includes('invalid format'));assert.ok(!messages[0].includes('private-invalid-value'));
  assert.equal(readFileSync(join(path,EXTERNAL_ACCOUNT_LOCAL_KEY_FILE),'utf8').trim(),original.toString('hex'));
});
test('production fails with a clear non-secret diagnostic even when a local key exists',t=>{
  const path=directory(t);resolveExternalAccountKey({env:{NODE_ENV:'development'},directory:path});
  const messages=[];
  assert.throws(()=>resolveExternalAccountKey({env:{NODE_ENV:'production'},directory:path,report:message=>messages.push(message)}));
  assert.match(messages[0],/EXTERNAL_ACCOUNTS_ENCRYPTION_KEY: missing/);
});
test('damaged local keys fail without being replaced',t=>{
  const path=directory(t);const file=join(path,EXTERNAL_ACCOUNT_LOCAL_KEY_FILE);writeFileSync(file,'damaged');
  assert.throws(()=>resolveExternalAccountKey({env:{NODE_ENV:'development'},directory:path,report:()=>{}}));
  assert.equal(readFileSync(file,'utf8'),'damaged');
});
test('initializer preserves other local settings and is idempotent without printing secrets',t=>{
  const path=directory(t);writeFileSync(join(path,'.env.local'),'NEXT_PUBLIC_SUPABASE_URL=https://synthetic.example.com\nEXTERNAL_ACCOUNTS_ENCRYPTION_KEY=\n');
  const script=resolve('scripts/setup-external-account-key.mjs');
  const run=()=>spawnSync(process.execPath,[script],{cwd:path,env:{...process.env,NODE_ENV:'development',EXTERNAL_ACCOUNTS_ENCRYPTION_KEY:''},encoding:'utf8'});
  const first=run();assert.equal(first.status,0,first.stderr);
  const configured=readFileSync(join(path,'.env.local'),'utf8');
  assert.ok(configured.includes('NEXT_PUBLIC_SUPABASE_URL=https://synthetic.example.com'));
  const value=configured.match(/^EXTERNAL_ACCOUNTS_ENCRYPTION_KEY=([a-f\d]{64})$/m)?.[1];assert.ok(value);
  assert.ok(!first.stdout.includes(value));assert.ok(!first.stderr.includes(value));
  const second=run();assert.equal(second.status,0,second.stderr);assert.equal(readFileSync(join(path,'.env.local'),'utf8'),configured);
  assert.ok(existsSync(join(path,EXTERNAL_ACCOUNT_LOCAL_KEY_FILE)));assert.ok(!second.stdout.includes(value));
});
