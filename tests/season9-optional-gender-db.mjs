// Disposable embedded PostgreSQL; never connects to Supabase.
import {readFile} from 'node:fs/promises';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
const {PGlite}=await import(process.env.PGLITE_MODULE ?? '../work/sql/node_modules/@electric-sql/pglite/dist/index.js');
const db=new PGlite();await db.exec(`create role anon;create role authenticated;create schema auth;create function auth.uid() returns uuid language sql stable as $$select null::uuid$$;create table public.admin_users(user_id uuid primary key);grant usage on schema auth to anon,authenticated;grant select on public.admin_users to authenticated;`);
for(const file of ['003_recruitment_applications.sql','006_event_management.sql','007_event_draft_period_theme.sql','008_event_test_flag.sql','009_event_registration.sql','010_applicant_management.sql','030_event_archive.sql','031_season9_intake_gate.sql','041_season9_required_fields.sql'])await db.exec(await readFile(`supabase/${file}`,'utf8'));
await db.exec(`alter table public.event_registration_responses add column birth_year integer,add column nationality text;update public.recruitment_events set status='published',applications_open=true,registration_enabled=true,opens_at=now()-interval '1 day',closes_at=now()+interval '1 day',privacy_notice='사진 활용 및 다음 기수 안내 동의는 선택 사항입니다.',privacy_notice_version='season9-2026-10-14-v1' where slug='season9';`);
await db.exec(await readFile('supabase/050_season9_required_photo_consent.sql','utf8'));await db.exec(await readFile('supabase/052_season9_compact_application.sql','utf8'));

await db.exec(await readFile('supabase/053_season9_phone_reapplication.sql','utf8'));
await db.exec(await readFile('supabase/drafts/20261027_season9_optional_gender_v2.sql','utf8'));
const base={submission_id:randomUUID(),application_kind:'new',name:'[TEST] gender',nationality:'TEST',birth_year:2001,contact:'01000000001',contact_type:'phone',preferred_class:'thursday',notice_version:'season9-2026-10-27-optional-gender-v2',privacy_consent:true,fee_confirmed:true,photo_consent:true,utm_source:'instagram'};
const submit=async p=>(await db.query('select public.submit_season9_compact_application_v2($1::jsonb) as result',[JSON.stringify(p)])).rows[0].result;
await db.exec('set role anon');
assert.equal((await db.query('select public.season9_compact_registration_info_v2() as info')).rows[0].info.open,true);
for(const gender of [null,'male','female','prefer_not_to_say','self_describe:나의 표현']){
 const p={...base,submission_id:randomUUID(),gender};assert.equal((await submit(p)).accepted,true);assert.equal((await submit(p)).accepted,true);
 await assert.rejects(submit({...p,gender:gender==='male'?'female':'male'}),/invalid_application/);
}
const returning={...base,submission_id:randomUUID(),application_kind:'returning',nationality:null,birth_year:null};assert.equal((await submit(returning)).accepted,true);
for(const patch of [{gender:'other'},{gender:'self_describe:'},{gender:'self_describe:'+ 'a'.repeat(36)},{gender:'self_describe:hello\nworld'},{photo_consent:false},{privacy_consent:false},{fee_confirmed:false},{birth_year:3000}])await assert.rejects(submit({...base,submission_id:randomUUID(),...patch}));
const instagram={...base,submission_id:randomUUID(),contact_type:'instagram',contact:'@test_gender'};assert.equal((await submit(instagram)).accepted,true);await assert.rejects(submit({...instagram,submission_id:randomUUID()}),/duplicate_application/);
await assert.rejects(db.query('select * from public.event_applications'),/permission denied/);await db.exec('reset role');
const rows=(await db.query('select gender,utm_source,privacy_notice_snapshot from public.event_applications')).rows;assert.equal(rows.length,7);assert.ok(rows.some(r=>r.gender==='self_describe:나의 표현'));assert.ok(rows.every(r=>r.utm_source==='instagram'&&r.privacy_notice_snapshot.includes('성별은 선택')));
// Old open tabs can still use v1 without gender.
await db.exec('set role anon');const v1=await db.query('select public.submit_season9_compact_application($1::jsonb) as result',[JSON.stringify({...base,submission_id:randomUUID(),notice_version:'season9-2026-10-26-compact-v1'})]);assert.equal(v1.rows[0].result.accepted,true);await db.exec('reset role');
await db.exec('set role anon');for(let i=0;i<12;i++)assert.equal((await submit({...base,submission_id:randomUUID()})).accepted,true);await assert.rejects(submit({...base,submission_id:randomUUID()}),/rate_limited/);await db.exec('reset role');
await db.exec("update public.recruitment_events set applications_open=false where slug='season9';set role anon;");await assert.rejects(submit({...base,submission_id:randomUUID()}),/recruitment_closed/);
await db.exec("reset role;update public.recruitment_events set applications_open=false,is_archived=true where slug='season9';set role anon;");await assert.rejects(submit({...base,submission_id:randomUUID()}),/recruitment_closed/);
await db.close();console.log('PASS isolated DB: optional gender, self-description, retries, old v1, new/returning, phone reapplication, Instagram duplicate, consent, admin storage, UTM, anon denial, rate limit, closed and archived gates');
