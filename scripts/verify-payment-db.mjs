import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
const root=process.cwd();
const report={engine:'PGlite isolated in-memory PostgreSQL with synthetic auth.users/auth.uid/roles; not Supabase Auth/PostgREST',commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),checks:[],concurrency:'NOT VERIFIED: single connection engine'};
const admin='11111111-1111-4111-8111-111111111111';
const outsider='33333333-3333-4333-8333-333333333333';
const out=await fs.mkdtemp(path.join(os.tmpdir(),'malmoim-pglite-validation-'));
function record(name,ok,detail){const item={name,ok,detail};report.checks.push(item);console.log(JSON.stringify(item));}
async function schema(db,final=true){
 await db.exec(`create role anon nologin; create role authenticated nologin;create schema auth;create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;
 grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`);
 const files=['001_admin_users.sql','003_recruitment_applications.sql','006_event_management.sql','007_event_draft_period_theme.sql','008_event_test_flag.sql','009_event_registration.sql','010_applicant_management.sql','011_participation_history.sql','012_event_fee_settings.sql','013_applicant_payment_management.sql','014_applicant_refund_management.sql',...(final?['015_actual_payment_full_refund.sql']:[])];
 let participationDefinition;
 const definition=async()=>JSON.stringify((await db.query("select (select pg_get_viewdef('public.event_person_totals'::regclass,true)) view_sql,(select json_agg(pg_get_functiondef(p.oid) order by p.proname) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('link_event_person','record_event_participation')) function_sql")).rows);
 for(const file of files){
  await db.exec(await fs.readFile(path.join(root,'supabase',file),'utf8'));record('apply '+file,true);
  if(file==='011_participation_history.sql')participationDefinition=await definition();
 }
 record('participation definitions unchanged',participationDefinition===await definition());
 await db.query('insert into auth.users(id) values($1),($2)',[admin,outsider]);await db.query('insert into admin_users(user_id) values($1)',[admin]);
}
const db=await PGlite.create();
async function user(id=admin){await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id,role:'authenticated'})]);}
async function create(slug){const r=await db.query("select public.manage_event_application($1,'manual',null,0,'[가상] 검증','01000006666','phone',null,'','received','paid','','가상 접수') r",[slug]);return r.rows[0].r;}
async function pay(slug,app,rev,amount){return (await db.query("select public.record_event_payment($1,'manual',$2,$3,$4) r",[slug,app,rev,amount])).rows[0].r;}
async function request(slug,app){return (await db.query("select public.create_event_refund_request($1,'manual',$2,'가상 사유',clock_timestamp()) r",[slug,app])).rows[0].r;}
async function update(slug,ref,action,amount=null,confirmed=false){return (await db.query('select public.update_event_refund($1,$2,$3,$4,$5) r',[slug,ref,action,amount,confirmed])).rows[0].r;}
try{
 record('PostgreSQL engine',true,(await db.query('select version() v')).rows[0].v);
 await schema(db);
 record('participation objects preserved',Boolean((await db.query("select to_regclass('event_people') p,to_regclass('event_person_totals') t,to_regprocedure('public.record_event_participation(text,text,uuid,integer,text,text,text)') f")).rows[0].f));
 await db.exec("insert into recruitment_events(slug,title,is_test,starts_at,ends_at) values('event-ade6a5a7-83c2-477b-94f0-a22444a785c3','[가상] 참여 테스트 전용',true,clock_timestamp()-interval '2 hours',clock_timestamp()-interval '1 hour')");
 for(const name of ['applicant_payment_management.sql','applicant_refund_management.sql','participation_history.sql']){
  const before=(await db.query('select (select count(*) from event_manual_applications) a,(select count(*) from event_application_refunds) r,(select count(*) from event_application_audit) h,(select count(*) from event_people) people,(select count(*) from event_participation) participation,(select count(*) from event_participation_audit) participation_audit')).rows;
  try{
   await db.exec(await fs.readFile(path.join(root,'supabase/tests',name),'utf8'));
   const after=(await db.query('select (select count(*) from event_manual_applications) a,(select count(*) from event_application_refunds) r,(select count(*) from event_application_audit) h,(select count(*) from event_people) people,(select count(*) from event_participation) participation,(select count(*) from event_participation_audit) participation_audit')).rows;
   record('SQL regression '+name,JSON.stringify(before)===JSON.stringify(after),'Regression and fixture rollback');
  }catch(e){await db.exec('rollback;reset role;');record('SQL regression '+name,false,{message:e.message,code:e.code,where:e.where});}
 }
 await user();
 await db.exec("insert into recruitment_events(slug,title,fee_amount_krw,payment_method,payment_bank_name,payment_account_number,payment_account_holder,payment_notice) values('wasm-fee','[가상] 검증',37500,'가상','가상은행','TEST-ONLY','가상','초안'); update recruitment_events set fee_amount_krw=42000,payment_notice='수정' where slug='wasm-fee'");
 const fee=(await db.query("select fee_amount_krw,payment_notice from recruitment_events where slug='wasm-fee'")).rows[0];record('fee save/readback',fee.fee_amount_krw===42000&&fee.payment_notice==='수정');
 const app=(await create('wasm-fee')).id;if(!app)throw Error('Missing fixture applicant');
 record('unknown paid amount blocks request',(await request('wasm-fee',app)).code==='payment_amount_unknown');
 record('zero actual receipt blocked',(await pay('wasm-fee',app,1,0)).code==='invalid');
 record('actual amount save',(await pay('wasm-fee',app,1,100)).code==='saved');
 const receipt=(await db.query('select paid_amount_krw,paid_amount_recorded_by,paid_amount_recorded_at,revision from event_application_list where id=$1',[app])).rows[0];record('actual receipt metadata',receipt.paid_amount_krw===100&&receipt.paid_amount_recorded_by===admin&&receipt.paid_amount_recorded_at!==null&&receipt.revision===2);
 record('stale payment revision blocked',(await pay('wasm-fee',app,1,200)).code==='conflict');
 let directDenied=false;try{await db.query('update event_application_management set paid_amount_krw=999 where application_id=$1',[app]);}catch(e){directDenied=e.code==='42501';}record('direct receipt write denied',directDenied);
 let stateBlocked=false;try{await db.query("select public.manage_event_application($1,'manual',$2,2,'[가상] 차단','01000006666','phone',null,'','received','unpaid','','가상 접수')",['wasm-fee',app]);}catch(e){stateBlocked=e.code==='23514';}
 const unchanged=(await db.query('select payment_status,paid_amount_krw,revision,name from event_application_list where id=$1',[app])).rows[0];
 record('recorded receipt status guard and statement rollback',stateBlocked&&unchanged.payment_status==='paid'&&unchanged.paid_amount_krw===100&&unchanged.revision===2&&unchanged.name==='[가상] 검증');

 await request('wasm-fee',app);const ref=(await db.query('select id from event_application_refunds where application_id=$1',[app])).rows[0].id;
 record('duplicate request blocked',(await request('wasm-fee',app)).code==='duplicate');
 record('receipt locked after refund request',(await pay('wasm-fee',app,2,200)).code==='payment_locked');
 record('unapproved completion blocked',(await update('wasm-fee',ref,'process',100,true)).code==='invalid_transition');
 await update('wasm-fee',ref,'approve');
 for(const amount of [0,99,101])record('refund amount '+amount+' blocked',(await update('wasm-fee',ref,'process',amount,true)).code===(amount===0?'invalid':'amount_mismatch'));
 record('transfer confirmation required',(await update('wasm-fee',ref,'process',100,false)).code==='invalid');
 record('full refund completion',(await update('wasm-fee',ref,'process',100,true)).code==='saved');
 record('duplicate completion blocked',(await update('wasm-fee',ref,'process',100,true)).code==='invalid_transition');
 const state=(await db.query('select r.status,m.payment_status,m.paid_amount_krw,m.revision from event_application_refunds r join event_application_management m on m.application_id=r.application_id and m.source=r.source where r.id=$1',[ref])).rows[0];record('refund/payment consistency',state.status==='processed'&&state.payment_status==='refunded'&&state.paid_amount_krw===100&&state.revision===3,state);
 // Explicit fault injection in this disposable engine only.
 await db.exec("insert into recruitment_events(slug,title) values('wasm-rollback','[가상] 롤백')");const app2=(await create('wasm-rollback')).id;await pay('wasm-rollback',app2,1,100);await request('wasm-rollback',app2);
 const ref2=(await db.query('select id from event_application_refunds where application_id=$1',[app2])).rows[0].id;await update('wasm-rollback',ref2,'approve');
 await db.exec(`reset role;create function public.fail_audit_test() returns trigger language plpgsql as $$begin if new.action='refund_processed' then raise exception 'synthetic audit failure';end if;return new;end$$;create trigger fail_audit_test before insert on event_application_audit for each row execute function public.fail_audit_test();`);await user();
 let failed=false;try{await update('wasm-rollback',ref2,'process',100,true);}catch(e){failed=e.message==='synthetic audit failure';}
 const rolled=(await db.query('select r.status,m.payment_status,m.revision from event_application_refunds r join event_application_management m on m.application_id=r.application_id and m.source=r.source where r.id=$1',[ref2])).rows[0];record('audit failure rolls back refund/payment/revision',failed&&rolled.status==='approved'&&rolled.payment_status==='paid'&&rolled.revision===2,rolled);
 await db.exec('reset role;drop trigger fail_audit_test on event_application_audit;drop function fail_audit_test()');
 await user();await db.exec("insert into recruitment_events(slug,title) values('wasm-correction','[가상] 납부액 정정')");
 const correctedApp=(await create('wasm-correction')).id;await pay('wasm-correction',correctedApp,1,100);await pay('wasm-correction',correctedApp,2,100);
 const same=(await db.query('select revision from event_application_list where id=$1',[correctedApp])).rows[0];
 const amountAudits=(await db.query("select count(*)::int n from event_application_audit where application_id=$1 and action='payment_amount_recorded'",[correctedApp])).rows[0];
 record('same receipt retry is idempotent',same.revision===2&&amountAudits.n===1);
 await pay('wasm-correction',correctedApp,2,200);
 const correction=(await db.query("select old_paid_amount_krw,new_paid_amount_krw,actor from event_application_audit where application_id=$1 and new_paid_amount_krw=200",[correctedApp])).rows[0];
 record('receipt correction retains audit',correction?.old_paid_amount_krw===100&&correction.new_paid_amount_krw===200&&correction.actor===admin);

 await user();await db.exec("insert into recruitment_events(slug,title,fee_amount_krw) values('sms-fixture','[가상] 문자 대상',100)");
 const cases=[['accepted','unpaid'],['accepted','unknown'],['accepted','pending_confirmation'],['accepted','paid'],['waitlisted','unpaid'],['accepted','unpaid']];
 const candidateIds=[];
 for(let index=0;index<cases.length;index++){
  const [status,payment]=cases[index];
  const candidate=(await db.query("select public.manage_event_application('sms-fixture','manual',null,0,'[가상] 문자 대상',$1,'phone',null,'',$2,$3,'','가상 접수') r",[`0100000999${index}`,status,payment])).rows[0].r;
  if(candidate.code!=='saved')throw Error('SMS fixture failed');candidateIds.push(candidate.id);
 }
 // Simulate a historical inconsistent refund row only in this disposable engine.
 await db.exec('reset role;');
 await db.query("insert into event_application_refunds(event_id,source,application_id,reason,requested_at,created_by) select id,'manual',$1,'[가상] 기존 요청',clock_timestamp(),$2 from recruitment_events where slug='sms-fixture'",[candidateIds[5],admin]);
 await user();
 const smsDocument=await fs.readFile(path.join(root,'docs/payment-refund-verification.md'),'utf8');
 const smsQuery=smsDocument.match(/```sql\n([\s\S]*?)\n```/)?.[1];if(!smsQuery)throw Error('SMS query example missing');
 const smsRows=(await db.query(smsQuery,['sms-fixture'])).rows;
 record('documented SMS query excludes unknown/pending/paid/waitlisted/refund',smsRows.length===1&&smsRows[0].application_id===candidateIds[0]);
 await db.query("update recruitment_events set fee_amount_krw=0 where slug='sms-fixture'");
 record('documented SMS query excludes free event',(await db.query(smsQuery,['sms-fixture'])).rows.length===0);
 await user(outsider);record('nonadmin read denied',(await db.query('select * from event_application_refunds')).rows.length===0);
 record('nonadmin payment RPC denied',(await pay('wasm-fee',app,3,100)).code==='forbidden');
 record('nonadmin refund RPC denied',(await request('wasm-fee',app)).code==='forbidden');
 await db.exec('reset role;set role anon;');let denied=false;try{await update('wasm-fee',ref,'process',100,true);}catch(e){denied=e.code==='42501';}record('anonymous RPC denied',denied);
 await db.exec('reset role;');
 // Failed migration rollback, separate in-memory DB.
 const rollback=await PGlite.create();try{
  await schema(rollback,false);const source=await fs.readFile(path.join(root,'supabase/015_actual_payment_full_refund.sql'),'utf8');
  try{await rollback.exec(source.replace(/commit;\s*$/i,'select 1/0;commit;'));}catch{await rollback.exec('rollback;');}
  const test=(await rollback.query("select exists(select 1 from information_schema.columns where table_name='event_application_management' and column_name='paid_amount_krw') col,to_regprocedure('public.record_event_payment(text,text,uuid,integer,integer)') fn")).rows[0];record('015 failure rolls back schema',!test.col&&test.fn===null,test);
 }finally{await rollback.close();}
}catch(e){record('unexpected execution failure',false,{message:e.message,code:e.code,where:e.where});}
finally{await db.close();await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log('REPORT '+path.join(out,'report.json'));
 if(report.checks.some(check=>!check.ok))process.exitCode=1;}
