// Synthetic, isolated PostgreSQL; no production connection or provider calls.
import {readFile} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const {PGlite}=await import(process.env.PGLITE_MODULE??'@electric-sql/pglite');
const db=new PGlite();const admin=randomUUID(),other=randomUUID(),event=randomUUID(),app=randomUUID(),worker='synthetic-only',hash=createHash('sha256').update(worker).digest('hex');
const file=p=>readFile(new URL('../supabase/'+p,import.meta.url),'utf8');
const q=(s,a=[])=>db.query(s,a);const denied=async(s,a=[])=>assert.rejects(q(s,a));
const as=async(user)=>{await db.exec('reset role');await q("select set_config('request.jwt.claim.sub',$1,false)",[user]);await db.exec('set role authenticated');};
try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as 'select nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';grant usage on schema auth to anon,authenticated;create table public.admin_users(user_id uuid primary key);grant select on public.admin_users to authenticated;
 create table public.recruitment_events(id uuid primary key,slug text,title text,ends_at timestamptz,is_test boolean default false,is_archived boolean default false);
 create table public.event_applications(id uuid);create table public.event_registration_responses(id uuid);
 create table public.event_application_admin_list(id uuid,source text,event_id uuid,revision integer,is_archived boolean,name text,contact text,contact_type text,status text,payment_status text);`);
 await q('insert into auth.users values($1),($2)',[admin,other]);await q('insert into admin_users values($1)',[admin]);await q("insert into recruitment_events(id,slug,title) values($1,'halloween-2026','Synthetic event')",[event]);
 await q("insert into event_application_admin_list values($1,'registration',$2,0,false,'Synthetic applicant','+82 10-0000-0001','phone','received','unpaid')",[app,event]);
 await db.exec(await file('036_messaging.sql'));await db.exec(await file('051_event_sms.sql'));
 assert.equal((await q('select sending_enabled from sms_settings')).rows[0].sending_enabled,false);
 assert.equal((await q('select count(*)::int n from sms_jobs')).rows[0].n,0);
 await db.exec('set role anon');await denied('select * from event_sms_templates');await denied('select * from sms_job_history');
 await as(other);assert.equal((await q('select * from event_sms_templates')).rows.length,0);await denied("select save_event_sms_details($1,0,'{}')",[event]);
 await as(admin);await q('select sms_initialize($1)',[hash]);
 const template=(await q("select id from event_sms_current where category='confirmation' and language='ko'")).rows[0].id;
 const prepare=(batch,tid=template,resend=false)=>q('select prepare_applicant_sms($1,$2,\'registration\',$3,0,$4,\'synthetic body\',45,\'SMS\',$5,\'ko\',\'25000 KRW\')',[batch,event,app,tid,resend]);
 await denied('select sms_toggle(true,false)');await denied('select prepare_applicant_sms($1,$2,\'registration\',$3,0,$4,\'test\',45,\'SMS\',false,\'ko\',\'\')',[randomUUID(),event,app,template]);
 await db.exec('reset role');await q("update event_application_admin_list set status='accepted',payment_status='paid'");await as(admin);
 const b=randomUUID();await prepare(b);await prepare(b);await denied('update sms_jobs set body=\'tamper\'');await denied('delete from event_sms_templates');await denied('update sms_job_history set state=\'delivered\'');await denied('select sms_approve($1)',[b]);
 await denied('select prepare_applicant_sms($1,$2,\'registration\',$3,0,$4,\'test\',45,\'SMS\',true,\'ko\',\'\')',[randomUUID(),event,app,template]);
 await q('select cancel_applicant_sms_preview($1)',[b]);const b2=randomUUID();await prepare(b2);
 // Only fixture owner enables sending to exercise queue guards; no provider is connected.
 await db.exec('reset role');await db.exec('update sms_settings set sending_enabled=true');await as(admin);await q('select sms_approve($1)',[b2]);
 const jobs=(await q('select * from sms_claim($1,$2)',[worker,b2])).rows;assert.equal(jobs.length,1);assert.equal(jobs[0].message_type,'SMS');assert.equal((await q('select * from sms_claim($1,$2)',[worker,b2])).rows.length,0);
 await q("select sms_finish($1,$2,'accepted','Gsynthetic12345')",[worker,jobs[0].id]);await denied('select prepare_applicant_sms($1,$2,\'registration\',$3,0,$4,\'test\',45,\'SMS\',true,\'ko\',\'\')',[randomUUID(),event,app,template]);
 await q("select sms_finish($1,$2,'delivered',null)",[worker,jobs[0].id]);
 const states=(await q('select state from sms_job_history where job_id=$1 order by id',[jobs[0].id])).rows.map(r=>r.state);assert.deepEqual(states,['draft','queued','dispatching','accepted','delivered']);
 await denied('select prepare_applicant_sms($1,$2,\'registration\',$3,0,$4,\'test\',45,\'SMS\',false,\'ko\',\'\')',[randomUUID(),event,app,template]);
 const b3=randomUUID();await prepare(b3,template,true);
 await db.exec('reset role');await db.exec("update event_application_admin_list set payment_status='unpaid'");await as(admin);await denied('select sms_approve($1)',[b3]);
 const t=(await q('select * from event_sms_templates where id=$1',[template])).rows[0];
 const input={category:t.category,language:t.language,title:t.title,body:'new {이름}',active:false,is_default:false};
 await q('select save_event_sms_template($1,$2,1,$3)',[event,t.template_key,JSON.stringify(input)]);assert.equal((await q('select * from event_sms_templates where template_key=$1',[t.template_key])).rows.length,2);assert.equal((await q('select body from event_sms_templates where id=$1',[template])).rows[0].body,t.body);
 await denied('select save_event_sms_template($1,$2,1,$3)',[event,t.template_key,JSON.stringify(input)]);
 console.log('PASS: admin RLS, immutable versions/audit, defaults off, no sends, payment gate at prepare/approval, idempotency, pending/unknown/duplicate guard, state chronology, SMS type, version conflict');
}finally{await db.close();}
