// Isolated PostgreSQL. No SOLAPI requests or production database connection.
// PGLITE_MODULE=/tmp/malmoim-intake-pg/node_modules/@electric-sql/pglite/dist/index.js node tests/sms-db.test.mjs
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
const {PGlite}=await import(process.env.PGLITE_MODULE??'@electric-sql/pglite');
const db=new PGlite(),admin=randomUUID(),normal=randomUUID(),token='synthetic-worker-token-only',hash=createHash('sha256').update(token).digest('hex');
const sql=file=>readFile(new URL('../supabase/'+file,import.meta.url),'utf8');
const one=async(q,args=[])=>(await db.query(q,args)).rows[0]?.value;
async function denied(q,args=[]){let failed=false;try{await db.query(q,args);}catch{failed=true;}assert.equal(failed,true,'must reject');}
const as=async(id)=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');};
const claim=async(batch=null)=>(await db.query('select * from public.sms_claim($1,$2)',[token,batch])).rows;
const finish=(id,state)=>db.query('select public.sms_finish($1,$2,$3,null)',[token,id,state]);
async function prepare(kind='test',extra={}){const id=randomUUID();await db.query('select public.sms_prepare($1,$2,$3,45,$4)',[id,extra.event??null,JSON.stringify([{to:'01000000002',text:'[가상] 테스트',...extra.item}]),kind]);return id;}
try{
 await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as 'select nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';grant usage on schema auth to anon,authenticated;create table public.admin_users(user_id uuid primary key);grant select on public.admin_users to authenticated;`);
 await db.query('insert into auth.users(id) values($1),($2)',[admin,normal]);await db.query('insert into public.admin_users values($1)',[admin]);
 for(const file of ['003_recruitment_applications.sql','006_event_management.sql','007_event_draft_period_theme.sql','008_event_test_flag.sql','009_event_registration.sql'])await db.exec(await sql(file));
 await db.exec('alter table public.recruitment_events add column is_archived boolean not null default false; alter table public.event_applications add column revision integer not null default 0,add column is_archived boolean not null default false; create view public.event_application_admin_list with(security_invoker=true) as select id,event_id,revision,is_archived,\'season9\'::text source from public.event_applications;');
 await db.exec(await sql('manual/open_season9_halloween.sql'));
 await db.exec(await sql('036_messaging.sql'));
 await db.exec(await sql('manual/update_application_sms_details.sql'));
 await db.exec(await sql('migrations/20261029144038_sms_additional_notification_recipients.sql'));
 assert.equal(await one('select sending_enabled as value from public.sms_settings'),false);
 await db.exec('set role anon');
 for(const table of ['sms_settings','sms_jobs','sms_batches','sms_daily_usage'])await denied('select * from public.'+table);
 await denied('select public.sms_claim($1,null)',['wrong-token']);
 await as(normal);await denied('select public.sms_initialize($1)',[hash]);assert.equal(await one('select count(*)::int as value from public.sms_jobs'),0);await denied('select worker_hash from public.sms_settings');
 await as(admin);await db.query('select public.sms_initialize($1)',[hash]);await denied('select public.sms_toggle(true,true)');
 let batch=await prepare();await db.query('select public.sms_approve($1)',[batch]);let jobs=await claim(batch);assert.equal(jobs.length,1);assert.equal((await claim(batch)).length,0);await finish(jobs[0].id,'unknown');assert.equal((await claim(batch)).length,0);await denied('select public.sms_toggle(true,true)');
 batch=await prepare();await db.query('select public.sms_approve($1)',[batch]);jobs=await claim(batch);await finish(jobs[0].id,'accepted');await denied('select public.sms_toggle(true,true)');await finish(jobs[0].id,'delivered');await db.exec('select public.sms_toggle(true,true)');
 console.log('PASS: default off, anonymous/regular-user denied, worker proof required, claim once, ambiguous outcome not retried, successful own test required');
 const payload={submission_id:randomUUID(),name:'[가상] 알림',nationality:'TEST',date_of_birth:'2000-01-01',contact:'+821000000003',contact_type:'phone',preferred_class:'thursday',notice_version:'season9-2026-10-14-v1',privacy_consent:true,fee_confirmed:true,referral_sources:[],full_attendance:true};
 await db.exec('reset role');await db.exec('set role anon');await db.query('select public.submit_season9_application($1)',[JSON.stringify(payload)]);await db.query('select public.submit_season9_application($1)',[JSON.stringify(payload)]);
 await as(admin);assert.equal(await one("select count(*)::int as value from public.sms_jobs where kind='notification'"),1);
 jobs=await claim();assert.equal(jobs.length,1);assert.equal(jobs[0].body.includes(payload.name),true);assert.ok(jobs[0].body.includes('이벤트: '));assert.ok(jobs[0].body.includes('/admin/events/season9/applicants'));assert.equal(jobs[0].body.includes(payload.contact),false);await finish(jobs[0].id,'accepted');assert.equal((await claim()).length,0);
 // Both real intake tables use the same trigger, with sanitized text and no contact details.
 await db.exec('reset role');
 const party=(await db.query("select id,title from public.recruitment_events where slug='halloween-2026'")).rows[0];
 const partyName='가상{이름}\n확인';
 await db.query("insert into public.event_registration_responses(event_id,submission_id,name,contact,participation_history,privacy_notice_version,privacy_consent,privacy_notice_snapshot) values($1,$2,$3,$4,'new','TEST',true,'TEST')",[party.id,randomUUID(),partyName,'01000000004']);
 await as(admin);const partyJobs=await claim();assert.equal(partyJobs.length,1);assert.ok(partyJobs[0].body.includes(party.title));assert.ok(partyJobs[0].body.includes('신청자: 가상이름 확인'));assert.ok(partyJobs[0].body.includes('/admin/events/halloween-2026/applicants'));assert.equal(partyJobs[0].body.includes('01000000004'),false);assert.ok(Buffer.byteLength(partyJobs[0].body,'utf8')<=2000);await finish(partyJobs[0].id,'accepted');
 const app=(await db.query('select id,event_id from public.event_applications')).rows[0];
 batch=await prepare('manual',{event:app.event_id,item:{source:'season9',id:app.id,revision:0}});
 await db.exec('reset role');await db.exec('update public.event_applications set revision=1');await as(admin);await denied('select public.sms_approve($1)',[batch]);
 const old=await prepare();await db.exec('reset role');await db.query("update public.sms_batches set created_at=now()-interval '11 minutes' where id=$1",[old]);await as(admin);await denied('select public.sms_approve($1)',[old]);
 batch=await prepare('manual');await db.query('select public.sms_approve($1)',[batch]);await db.exec('reset role');await db.exec('update public.sms_daily_usage set attempts=200');assert.equal((await claim(batch)).length,0);
 await as(admin);await db.exec('select public.sms_toggle(false,false)');assert.equal((await claim(batch)).length,0);
 // Private additional recipient: both outbox records commit together, separately deduplicated.
 await db.exec('reset role');
 await db.exec("insert into sms_private.notification_recipients(phone) values('01000000005')");
 await as(normal);await denied('select * from sms_private.notification_recipients');
 await denied("insert into sms_private.notification_recipients(phone) values('01000000006')");
 await as(admin);await denied('select * from sms_private.notification_recipients');
 await db.exec('select public.sms_toggle(true,true)');
 await db.exec('reset role');
 await db.exec('update public.sms_daily_usage set attempts=0');
 const signup=randomUUID();
 await db.query("insert into public.event_registration_responses(event_id,submission_id,name,contact,participation_history,privacy_notice_version,privacy_consent,privacy_notice_snapshot) values($1,$2,'Synthetic extra recipient','01000000006','new','TEST',true,'TEST')",[party.id,signup]);
 const extra=(await db.query("select * from public.sms_jobs where kind='notification' and application_id=(select id from public.event_registration_responses where submission_id=$1)",[signup])).rows;
 assert.equal(extra.length,2);assert.deepEqual(extra.map(j=>j.recipient).sort(),['01000000005',null].sort());
 await db.query("insert into public.sms_jobs(event_id,application_source,application_id,kind,recipient,body) select event_id,application_source,application_id,kind,recipient,body from public.sms_jobs where id=$1 on conflict do nothing",[extra[0].id]);
 assert.equal((await db.query("select count(*)::int n from public.sms_jobs where application_id=$1",[extra[0].application_id])).rows[0].n,2);
 const claimed=[];for(let n=0;n<2;n++){const [j]=await claim();claimed.push(j.recipient);await finish(j.id,'accepted');}
 assert.deepEqual(claimed.sort(),['01000000005',null].sort());
 console.log('PASS: additional notification recipient privacy, two independent jobs, per-recipient deduplication and claims');
 console.log('PASS: atomic notification outbox, retry deduplication, event/applicant name in alerts without contact details, recipient revisions, preview expiry, daily cap, disabled sending blocked');
}catch(error){console.error(error.message);process.exitCode=1;}finally{await db.close();}
