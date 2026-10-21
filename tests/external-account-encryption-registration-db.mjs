// Real AES + actual registration/reveal SQL in disposable PostgreSQL only.
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {encryptAccountPassword,decryptAccountPassword} from '../src/lib/external-account-crypto.ts';
import {resolveExternalAccountKey} from '../src/lib/external-account-key.mjs';
const {PGlite}=await import('../work/sql/node_modules/@electric-sql/pglite/dist/index.js');
const db=new PGlite();const actor='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const tempRoot=resolve(tmpdir());const directory=await mkdtemp(join(tempRoot,'external-encryption-test-'));
const previous=process.env.EXTERNAL_ACCOUNTS_ENCRYPTION_KEY;
try {
  process.env.EXTERNAL_ACCOUNTS_ENCRYPTION_KEY=resolveExternalAccountKey({env:{NODE_ENV:'development'},directory}).toString('hex');
  await db.exec(`create role anon;create role authenticated;create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
create function auth.jwt() returns jsonb language sql stable as $$select '{}'::jsonb$$;
create table admin_users(user_id uuid primary key);create table admin_profiles(user_id uuid primary key,display_name text);
insert into admin_users values('${actor}');insert into admin_profiles values('${actor}','Synthetic Staff');
grant usage on schema auth to authenticated;grant select on admin_users to authenticated;`);
  for(const file of ['022_external_accounts.sql','043_external_account_creation.sql','044_external_account_initial_access.sql'])await db.exec(await readFile('supabase/'+file,'utf8'));
  await db.query("select set_config('test.uid',$1,false)",[actor]);await db.exec('set role authenticated');
  const password='합성 비밀번호 !123';const ciphertext=encryptAccountPassword(password);
  const input={service_name:'Synthetic Canva',service_url:'https://canva.com',login_id:'synthetic@example.com',category:'design',department:'',primary_manager:'',sub_manager:'',billing_cycle:'none',payment_method:'',amount:0,currency:'KRW',next_billing_date:'',renewal_notice_days:7,notes:''};
  const id=(await db.query('select manage_external_account(null,null,$1::jsonb,$2,false) id',[JSON.stringify(input),ciphertext])).rows[0].id;
  const metadata=(await db.query('select * from external_accounts where id=$1',[id])).rows[0];
  assert.equal(metadata.created_by,actor);assert.ok(!JSON.stringify(metadata).includes(password));
  // A separately resolved key (like a restarted worker) decrypts the saved account.
  process.env.EXTERNAL_ACCOUNTS_ENCRYPTION_KEY=resolveExternalAccountKey({env:{NODE_ENV:'test'},directory}).toString('hex');
  const returned=(await db.query("select reveal_external_account($1,'view') secret",[id])).rows[0].secret;
  assert.equal(returned,ciphertext);assert.equal(decryptAccountPassword(returned),password);
  const logs=(await db.query('select * from account_access_logs where account_id=$1',[id])).rows;
  assert.equal(logs.length,2);assert.ok(!JSON.stringify(logs).includes(password));assert.ok(!JSON.stringify(logs).includes(ciphertext));
  console.log('PASS generated persistent key -> real AES encryption -> Staff registration -> saved metadata/creator/audit -> reveal/decrypt after key reload');
} finally {
  if(previous===undefined)delete process.env.EXTERNAL_ACCOUNTS_ENCRYPTION_KEY;else process.env.EXTERNAL_ACCOUNTS_ENCRYPTION_KEY=previous;
  await db.close();assert.ok(resolve(directory).startsWith(join(tempRoot,'external-encryption-test-')));await rm(directory,{recursive:true,force:true});
}
