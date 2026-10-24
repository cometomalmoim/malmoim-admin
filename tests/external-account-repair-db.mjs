// Reproduce the observed live 42703, then upgrade twice without deleting existing accounts.
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {PGlite}=await import('../work/sql/node_modules/@electric-sql/pglite/dist/index.js');
const db=new PGlite();const master='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',staff='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
await db.exec(`create role anon;create role authenticated;create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
create function auth.jwt() returns jsonb language sql stable as $$select '{}'::jsonb$$;
create table admin_users(user_id uuid primary key);create table admin_profiles(user_id uuid primary key,display_name text);
insert into admin_users values('${master}'),('${staff}');insert into admin_profiles values('${master}','Master'),('${staff}','Staff');
grant usage on schema auth to authenticated,anon;grant select on admin_users to authenticated;`);
await db.exec(await readFile('supabase/022_external_accounts.sql','utf8'));
await db.query("insert into external_account_members values($1,'master','임원'),($2,'staff','디자인')",[master,staff]);
async function as(id){await db.exec('reset role');await db.query("select set_config('test.uid',$1,false)",[id]);await db.exec('set role authenticated');}
const input={service_name:'Canva',service_url:'https://canva.com',login_id:'synthetic@example.com',category:'design',department:'',primary_manager:'',sub_manager:'',billing_cycle:'monthly',payment_method:'',amount:'0',currency:'KRW',next_billing_date:'',renewal_notice_days:'7',notes:''};
const save=()=>db.query('select manage_external_account(null,null,$1::jsonb,$2,false) id',[JSON.stringify(input),'preserved-encrypted-password-placeholder']);
await as(master);const legacy=(await save()).rows[0].id;
await assert.rejects(()=>db.query('select created_by from external_accounts'),error=>error.code==='42703');
await db.exec('reset role');
const repair=await readFile('supabase/manual/repair_external_accounts.sql','utf8');await db.exec(repair);await db.exec(repair);
await as(staff);
const original=(await db.query('select * from external_accounts where id=$1',[legacy])).rows[0];assert.equal(original.created_by,master);assert.equal(original.service_name,'Canva');
assert.equal((await db.query("select reveal_external_account($1,'view') secret",[legacy])).rows[0].secret,'preserved-encrypted-password-placeholder');
const created=(await save()).rows[0].id;
assert.equal((await db.query('select created_by from external_accounts where id=$1',[created])).rows[0].created_by,staff);
assert.equal((await db.query('select * from external_accounts')).rows.length,2);
await assert.rejects(()=>db.query('select * from external_account_secrets'));
await db.exec('reset role;set role anon');await assert.rejects(save);
await db.close();console.log('PASS live missing-column reproduction -> idempotent schema repair twice -> existing metadata/secrets/audit preserved -> Staff create/reveal succeeds');
