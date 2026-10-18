// Isolated PostgreSQL only. Never connect this test to the production database.
// npm install --prefix /tmp/malmoim-intake-pg --ignore-scripts @electric-sql/pglite
// PGLITE_MODULE=/tmp/malmoim-intake-pg/node_modules/@electric-sql/pglite/dist/index.js node tests/intake-db.test.mjs
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
const {PGlite}=await import(process.env.PGLITE_MODULE??'@electric-sql/pglite');
const db=new PGlite();
const sql=file=>readFile(new URL(`../supabase/${file}`,import.meta.url),'utf8');
const scalar=async(query,params=[])=>(await db.query(query,params)).rows[0].value;
async function denied(query,params=[]){let failed=false;try{await db.query(query,params);}catch{failed=true;}assert.equal(failed,true);}
try{
 await db.exec(`create role anon; create role authenticated; create schema auth; create function auth.uid() returns uuid language sql stable as 'select nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid'; grant usage on schema auth to anon,authenticated; create table public.admin_users(user_id uuid primary key); grant select on public.admin_users to authenticated;`);
 for(const file of ['003_recruitment_applications.sql','006_event_management.sql','007_event_draft_period_theme.sql','008_event_test_flag.sql','009_event_registration.sql'])await db.exec(await sql(file));
 await db.exec('alter table public.recruitment_events add column is_archived boolean not null default false;');
 await db.exec(await sql('manual/open_season9_halloween.sql'));
 assert.equal(await scalar("select public.event_registration_info('halloween-2026',false)->>'open' as value"),'true');
 await db.exec("update public.recruitment_events set applications_open=false where slug='season9'");
 await db.exec(await sql('031_season9_intake_gate.sql'));
 assert.equal(await scalar(`select public.season9_registration_info()->>'open' as value`),'false');
 await db.exec(await sql('032_season9_open.sql'));
 const payload={submission_id:randomUUID(),name:'[가상] SQL 검증',nationality:'TEST',date_of_birth:'2000-01-01',contact:'+821000000001',contact_type:'phone',preferred_class:'thursday',notice_version:'season9-2026-10-14-v1',privacy_consent:true,fee_confirmed:true,referral_sources:[],full_attendance:true};
 const submit=data=>scalar('select public.submit_season9_application($1::jsonb) as value',[JSON.stringify(data)]);
 await db.exec('set role anon');
 assert.equal((await submit(payload)).accepted,true);
 assert.equal((await submit(payload)).accepted,true);
 await denied('select public.submit_season9_application($1::jsonb)',[JSON.stringify({...payload,submission_id:randomUUID()})]);
 await denied('select public.submit_season9_application($1::jsonb)',[JSON.stringify({...payload,submission_id:randomUUID(),contact:'+821000000002',privacy_consent:false})]);
 await denied('select public.submit_season9_application($1::jsonb)',[JSON.stringify({...payload,submission_id:randomUUID(),contact:'+821000000002',preferred_class:null})]);
 await denied('select * from public.event_applications');
 await denied('select * from public.event_registration_responses');
 await db.exec('reset role');
 assert.equal(await scalar('select count(*)::int as value from public.event_applications'),1);
 assert.equal(await scalar('select privacy_notice_snapshot is not null as value from public.event_applications'),true);
 await db.exec("update public.recruitment_events set opens_at=clock_timestamp()-interval '1 day',closes_at=clock_timestamp()-interval '1 second' where slug='season9'");
 await denied('select public.submit_season9_application($1::jsonb)',[JSON.stringify({...payload,submission_id:randomUUID(),contact:'+821000000002'})]);
 console.log('PASS season9: saved, idempotent retry, duplicate, consent, missing group, deadline, snapshot, anonymous read blocked');

 await db.exec(await sql('033_halloween_optional_deadline.sql'));
 await db.exec(await sql('034_halloween_open.sql'));
 assert.equal(await scalar("select closes_at is null as value from public.recruitment_events where slug='halloween-2026'"),true);
 const id=randomUUID();
 const party=(sub,contact,consent=true)=>scalar("select public.submit_event_registration('halloween-2026',$1,'[가상] 파티',$2,'new','',$3,'halloween-2026-10-18-v1',false,false) as value",[sub,contact,consent]);
 await db.exec('set role anon');
 assert.equal(await party(id,'+821000000003'),'saved');
 assert.equal(await party(id,'+821000000003'),'saved');
 assert.equal(await party(randomUUID(),'+821000000003'),'duplicate');
 assert.equal(await party(randomUUID(),'+821000000004',false),'consent');
 await db.exec('reset role');
 await db.exec("update public.recruitment_events set capacity=1 where slug='halloween-2026'");
 assert.equal(await party(randomUUID(),'+821000000004'),'full');
 await db.exec(await sql('035_halloween_close.manual.sql'));
 assert.equal(await party(randomUUID(),'+821000000004'),'closed');
 await db.exec('set role authenticated');
 assert.equal(await scalar('select count(*)::int as value from public.event_applications'),0);
 assert.equal(await scalar('select count(*)::int as value from public.event_registration_responses'),0);
 await db.exec('reset role');
 const admin=randomUUID();await db.query('insert into public.admin_users(user_id) values($1)',[admin]);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[admin]);await db.exec('set role authenticated');
 assert.equal(await scalar('select count(*)::int as value from public.event_applications'),1);
 assert.equal(await scalar('select count(*)::int as value from public.event_registration_responses'),1);
 console.log('PASS Halloween: optional deadline, saved, retry, duplicate, consent, capacity, manual close, regular-user blocked, admin read allowed');
}catch(error){console.error(error.message);process.exitCode=1;}finally{await db.close();}
