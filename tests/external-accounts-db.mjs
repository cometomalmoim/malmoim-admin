// Disposable local database only. Uses the same optional PGlite cache as existing DB tests.
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const { PGlite } = await import('../work/sql/node_modules/@electric-sql/pglite/dist/index.js');
const db=new PGlite();
const master='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', staff='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', other='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
await db.exec(`create role anon; create role authenticated; create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('test.jwt',true),''),'{}')::jsonb$$;
create table admin_users(user_id uuid primary key);create table admin_profiles(user_id uuid primary key,display_name text);
insert into admin_users values('${master}'),('${staff}'),('${other}');
insert into admin_profiles values('${master}','회장'),('${staff}','운영진'),('${other}','다른 부서');
grant usage on schema auth to authenticated,anon;grant select on admin_users to authenticated;`);
await db.exec(await readFile('supabase/022_external_accounts.sql','utf8'));
await db.query(`insert into external_account_members values($1,'master','임원'),($2,'staff','디자인'),($3,'staff','마케팅')`,[master,staff,other]);
async function asUser(id){await db.exec('reset role');await db.query("select set_config('test.uid',$1,false)",[id]);await db.exec('set role authenticated');}
const input={service_name:'Figma',service_url:'https://figma.com',login_id:'team@example.com',category:'design',department:'디자인',primary_manager:staff,sub_manager:'',billing_cycle:'monthly',payment_method:'법인 1234',amount:100,currency:'USD',next_billing_date:'2026-10-26',renewal_notice_days:7,notes:''};
const save=(id=null,version=null,patch={},secret=null,remove=false)=>db.query('select manage_external_account($1,$2,$3::jsonb,$4,$5) id',[id,version,JSON.stringify({...input,...patch}),secret,remove]);
await asUser(master);
const id=(await save(null,null,{},'encrypted-ciphertext-placeholder-123456')).rows[0].id;
const version=async()=> (await db.query('select updated_at::text v from external_accounts where id=$1',[id])).rows[0].v;
assert.equal((await db.query('select * from external_accounts')).rows.length,1);
await assert.rejects(()=>db.query('select * from external_account_secrets'));
await assert.rejects(()=>db.query('select * from external_account_mfa_uses'));
await assert.rejects(()=>db.query("update external_accounts set login_id='forged'"));
await assert.rejects(()=>db.query('delete from account_access_logs'));
await assert.rejects(()=>db.query("insert into account_access_logs(account_id,actor_id,actor_name,action) values($1,$2,'forged','view')",[id,master]));
await assert.rejects(()=>save(id,'2000-01-01'));
await save(id,await version(),{primary_manager:other},'new-encrypted-ciphertext-placeholder');
const changes=(await db.query("select changes from account_access_logs where action='update'")).rows[0].changes;
assert.equal(changes.password,'changed');assert.equal(changes.primary_manager.before,staff);assert.equal(changes.primary_manager.after,other);
assert.ok(!JSON.stringify(changes).includes('ciphertext'));
await asUser(staff);
await assert.rejects(()=>db.query("update external_account_members set role='master' where user_id=$1",[staff]));
assert.equal((await db.query('select * from external_accounts')).rows.length,1); // department access
assert.equal((await db.query('select * from external_account_renewals')).rows.length,1);
await assert.rejects(()=>save());
await assert.rejects(()=>db.query("select reveal_external_account($1,'view')",[id]));
await asUser(other);
assert.equal((await db.query('select * from external_accounts')).rows.length,1); // assigned access
await asUser(master);
await save(id,await version(),{primary_manager:staff});
await asUser(other);
assert.equal((await db.query('select * from external_accounts')).rows.length,0);
assert.equal((await db.query('select * from account_access_logs')).rows.length,0);
assert.equal((await db.query('select * from external_account_renewals')).rows.length,0);
await asUser(master);
const reveal=()=>db.query("select reveal_external_account($1,'view') secret",[id]);
await assert.rejects(reveal); // missing AAL
async function jwt(aal,seconds){await db.query("select set_config('test.jwt',$1,false)",[JSON.stringify({aal,amr:[{method:'totp',timestamp:Math.floor(Date.now()/1000)+seconds}]})]);}
await jwt('aal1',0);await assert.rejects(reveal);
await jwt('aal2',-120);await assert.rejects(reveal);
await jwt('aal2',0);
assert.equal((await reveal()).rows[0].secret,'new-encrypted-ciphertext-placeholder');
await assert.rejects(reveal); // one consumption per fresh MFA verification
assert.equal((await db.query("select * from account_access_logs where action='view'")).rows.length,1);
await save(id,await version(),{},null,true);
assert.equal((await db.query('select * from external_accounts')).rows.length,0);
assert.ok((await db.query('select * from account_access_logs')).rows.length>=4);
await db.exec('reset role;set role anon');
await assert.rejects(()=>db.query('select * from external_accounts'));
await assert.rejects(reveal);
await db.close();
console.log('External accounts RLS, secret isolation, MFA replay, stale writes, audit retention and renewal feed passed');
