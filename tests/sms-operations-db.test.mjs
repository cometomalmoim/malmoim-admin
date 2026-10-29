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
 await db.exec(await file('036_messaging.sql'));await db.exec(await file('051_event_sms.sql'));await db.exec(await file('migrations/20261029090350_sms_send_operations.sql'));

 const batch1=randomUUID(),batch2=randomUUID(),legacy=randomUUID(),foreign=randomUUID(),operation=randomUUID();
 await q("insert into sms_batches(id,created_by,event_id,unit_price,message_type,kind) values($1,$2,$3,45,'LMS','manual'),($4,$2,$3,45,'LMS','manual'),($5,$2,$3,45,'LMS','manual'),($6,$7,$3,45,'LMS','manual')",[batch1,admin,event,batch2,legacy,foreign,other]);
 for(const b of [batch1,batch2,legacy,foreign])await q("insert into sms_jobs(batch_id,event_id,recipient,body,state,applicant_name,kind) values($1,$2,$3,'same content','draft','TEST','manual')",[b,event,'010'+b.slice(0,8).replace(/[a-f]/g,'1')]);
 await db.exec('set role anon');await denied('select * from sms_operation_list');await denied('select register_sms_send_operation($1,$2)',[operation,[batch1,batch2]]);
 await as(other);assert.equal((await q('select * from sms_operation_list')).rows.length,0);await denied('select register_sms_send_operation($1,$2)',[operation,[foreign]]);
 await as(admin);await denied('select register_sms_send_operation($1,$2)',[operation,[batch1,foreign]]);await denied('select register_sms_send_operation($1,$2)',[operation,[batch1,batch1]]);
 await q('select register_sms_send_operation($1,$2)',[operation,[batch1,batch2]]);await q('select register_sms_send_operation($1,$2)',[operation,[batch1,batch2]]);
 let summary=(await q('select * from sms_operation_list where operation_id=$1',[operation])).rows[0];assert.equal(summary.total,2);assert.equal(summary.has_activity,false);
 await denied('update sms_batches set operation_id=$1 where id=$2',[randomUUID(),legacy]);
 await denied('select register_sms_send_operation($1,$2)',[randomUUID(),[batch1]]);
 await db.exec('reset role');await q("update sms_jobs set state='delivered' where batch_id=$1",[batch1]);await q("update sms_jobs set state='failed' where batch_id=$1",[batch2]);await as(admin);
 summary=(await q('select * from sms_operation_list where operation_id=$1',[operation])).rows[0];assert.equal(summary.delivered,1);assert.equal(summary.failed,1);assert.equal(summary.has_activity,true);assert.ok(summary.sent_at);
 // Same original operation can be retried, but completed jobs cannot be regrouped.
 await q('select register_sms_send_operation($1,$2)',[operation,[batch1,batch2]]);await denied('select register_sms_send_operation($1,$2)',[randomUUID(),[batch1,batch2]]);
 assert.equal((await q('select total from sms_operation_list where operation_id=$1',[legacy])).rows[0].total,1);
 assert.equal((await q('select count(*)::int n from sms_jobs')).rows[0].n,4);assert.equal((await q('select sending_enabled from sms_settings')).rows[0].sending_enabled,false);
 console.log('PASS: true operation grouping, full counts, legacy isolation, owner/role guards, idempotency, no send');
}finally{await db.close();}
