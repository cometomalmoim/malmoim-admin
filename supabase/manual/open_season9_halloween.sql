-- SQL Editor: review privacy notices before running. Opens real intake for both events.
-- Existing event schema through 030 is required. No service_role key is used.
begin;
-- Source: 031_season9_intake_gate.sql
-- Run after existing event/admin migrations through 030. Does NOT open either event.
-- No table read/write grants or admin permissions are expanded.
alter table public.event_applications add column if not exists privacy_notice_snapshot text;
create or replace function public.season9_registration_info() returns jsonb
language plpgsql security definer set search_path='' as $$
declare e public.recruitment_events;
begin
 select * into e from public.recruitment_events where slug='season9';
 if not found then return jsonb_build_object('open',false); end if;
 return jsonb_build_object('open',coalesce(e.status='published' and e.applications_open and e.registration_enabled
  and not e.is_test and not e.is_archived and e.opens_at is not null and e.closes_at is not null
  and clock_timestamp()>=e.opens_at and clock_timestamp()<e.closes_at
  and nullif(btrim(e.privacy_notice),'') is not null
  and e.privacy_notice_version='season9-2026-10-14-v1',false));
end $$;
revoke all on function public.season9_registration_info() from public;
grant execute on function public.season9_registration_info() to anon,authenticated;
create or replace function public.submit_season9_application(payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  ev public.recruitment_events%rowtype;
  normalized_contact text;
  requested_id uuid;
  birth date;
begin
  if payload is null or jsonb_typeof(payload)<>'object' or pg_catalog.pg_column_size(payload) > 20000 then raise exception 'invalid_application'; end if;
  select * into ev from public.recruitment_events where slug='season9' for update;
  if not found or not coalesce((public.season9_registration_info()->>'open')::boolean,false) then raise exception 'recruitment_closed'; end if;
  if payload->>'notice_version' is distinct from 'season9-2026-10-14-v1' or payload->>'privacy_consent' is distinct from 'true' or payload->>'fee_confirmed' is distinct from 'true' then raise exception 'consent_required'; end if;
  if coalesce(payload->>'contact_type','') not in ('phone','instagram') or coalesce(payload->>'preferred_class','') not in ('thursday','saturday') then raise exception 'invalid_application'; end if;
  if coalesce(char_length(btrim(payload->>'nationality')),0) not between 1 and 100 or coalesce(char_length(btrim(payload->>'name')),0) not between 1 and 100 or coalesce(char_length(payload->>'contact'),0) not between 1 and 200 then raise exception 'invalid_application'; end if;
  normalized_contact := case when payload->>'contact_type'='phone' then pg_catalog.regexp_replace(payload->>'contact','[^0-9+]','','g') else pg_catalog.lower(pg_catalog.ltrim(payload->>'contact','@')) end;
  if payload->>'contact_type'='phone' and normalized_contact !~ '^\+?[0-9]{8,15}$' or payload->>'contact_type'='instagram' and normalized_contact !~ '^[a-z0-9_.]{1,30}$' then raise exception 'invalid_application'; end if;
  begin requested_id := (payload->>'submission_id')::uuid; birth := (payload->>'date_of_birth')::date; exception when others then raise exception 'invalid_application'; end;
  if requested_id is null or birth is null or birth > current_date then raise exception 'invalid_application'; end if;
  -- Event row lock serializes duplicate checks and caps across every RPC caller.
  -- Same identifier or contact returns the same generic receipt, never existing applicant details.
  if exists(select 1 from public.event_applications where event_id=ev.id and submission_id=requested_id) then
    if exists(select 1 from public.event_applications where event_id=ev.id and submission_id=requested_id and contact=normalized_contact and name=payload->>'name' and date_of_birth=birth and preferred_class=payload->>'preferred_class') then return jsonb_build_object('accepted',true); end if;
    raise exception 'invalid_application';
  end if;
  if exists(select 1 from public.event_applications where event_id=ev.id and contact_type=payload->>'contact_type' and contact=normalized_contact) then raise exception 'duplicate_application'; end if;
  if jsonb_typeof(coalesce(payload->'referral_sources','[]'::jsonb))<>'array' then raise exception 'invalid_application'; end if;
  if jsonb_array_length(coalesce(payload->'referral_sources','[]'::jsonb))>10 then raise exception 'invalid_application'; end if;
  if (select count(*) from public.event_applications where event_id=ev.id and created_at > pg_catalog.clock_timestamp()-interval '1 minute') >= 20 then raise exception 'rate_limited'; end if;
  if (select count(*) from public.event_applications where event_id=ev.id and created_at > pg_catalog.clock_timestamp()-interval '1 day') >= 500 then raise exception 'rate_limited'; end if;
  insert into public.event_applications(event_id,submission_id,name,contact,contact_type,preferred_class,nationality,gender,date_of_birth,occupation,korean_level,english_level,motivation,introduction,full_attendance,referral_sources,payment_method,privacy_notice_version,privacy_consent,photo_consent,future_updates_consent,fee_policy_confirmed,privacy_notice_snapshot,utm_source,utm_medium,utm_campaign,utm_term,utm_content)
  values(ev.id,requested_id,left(payload->>'name',100),normalized_contact,payload->>'contact_type',payload->>'preferred_class',left(payload->>'nationality',100),left(payload->>'gender',50),birth,left(payload->>'occupation',200),left(payload->>'korean_level',100),left(payload->>'english_level',100),left(payload->>'motivation',2000),left(payload->>'introduction',2000),(payload->>'full_attendance')::boolean,array(select jsonb_array_elements_text(coalesce(payload->'referral_sources','[]'::jsonb))),left(payload->>'payment_method',100),'season9-2026-10-14-v1',true,coalesce((payload->>'photo_consent')::boolean,false),coalesce((payload->>'future_updates_consent')::boolean,false),true,ev.privacy_notice,left(payload->>'utm_source',150),left(payload->>'utm_medium',150),left(payload->>'utm_campaign',150),left(payload->>'utm_term',150),left(payload->>'utm_content',150));
  return jsonb_build_object('accepted',true);
end $$;
revoke all on function public.submit_season9_application(jsonb) from public;
grant execute on function public.submit_season9_application(jsonb) to anon, authenticated;

-- Source: 032_season9_open.sql
-- Review after 031. This file intentionally enables real season9 intake.
-- Previously confirmed: 6 sessions, KRW 50,000, privacy deletion after program completion.
do $$ begin
 if to_regprocedure('public.season9_registration_info()') is null then raise exception 'Apply 031 first'; end if;
 if not exists(select 1 from public.recruitment_events where slug='season9' and not is_test and not is_archived) then raise exception 'Actual season9 event is missing or archived'; end if;
end $$;
update public.recruitment_events set
 status='published',applications_open=true,registration_enabled=true,
 opens_at=coalesce(opens_at,clock_timestamp()),closes_at='2026-11-01 00:00:00+09',
 privacy_notice_version='season9-2026-10-14-v1',
 privacy_notice='운영 주체: 말모임. 문의: cometomalmoim@gmail.com
수집 항목: 이름, 국적, 성별, 생년월일, 연락처, 소속, 언어 수준, 신청 답변, 희망 반, 참석 여부, 납부 방식, 유입 정보와 동의 기록.
목적: 신청 확인·참여자 관리. 보유기간: 프로그램 종료 후 폐기.
필수 개인정보 수집·이용에 동의하지 않을 수 있으나, 동의하지 않으면 신청할 수 없습니다. 사진 활용 및 다음 기수 안내 동의는 선택 사항입니다.
Operator: MALMOIM. Contact: cometomalmoim@gmail.com. Collected: identity and contact details, language levels, application answers, group preference, attendance, payment preference, referral information and consent records. Purpose: application review and participant management. Retention: deleted after the program ends. Required privacy consent is necessary to apply; photo use and future updates are optional.'
where slug='season9' and not is_test and not is_archived;
do $$ begin
 if not coalesce((public.season9_registration_info()->>'open')::boolean,false) then raise exception 'Readiness check failed; no changes committed'; end if;
end $$;
-- Source: 033_halloween_optional_deadline.sql
-- Review after existing event registration migrations. Does not enable intake.
-- Halloween only: allow no closing timestamp, controlled by applications_open/registration_enabled.
alter table public.recruitment_events drop constraint event_draft_period_required;
alter table public.recruitment_events add constraint event_draft_period_required check (
 (status='draft' and not applications_open) or
 (opens_at is not null and closes_at is not null and opens_at<closes_at) or
 (slug='halloween-2026' and opens_at is not null and closes_at is null)
);
create or replace function public.event_registration_info(p_slug text,p_test boolean default false) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare e public.recruitment_events; is_admin boolean;
begin
 select exists(select 1 from public.admin_users where user_id=auth.uid()) into is_admin;
 select * into e from public.recruitment_events where slug=p_slug;
 if not found then return jsonb_build_object('open',false); end if;
 if p_test then
   if not is_admin or not e.is_test then return jsonb_build_object('open',false); end if;
   return jsonb_build_object('open',true,'notice','가상 데이터만 입력하는 관리자 테스트입니다. 실제 개인정보를 입력하지 마세요.','version','synthetic-test-v1','marketingNotice','가상 데이터 테스트용 선택 동의입니다.');
 end if;
 if e.slug <> 'halloween-2026' or e.is_test or not e.registration_enabled or not e.applications_open or e.status <> 'published'
 or e.is_archived or e.opens_at is null or clock_timestamp()<e.opens_at or (e.closes_at is not null and clock_timestamp()>=e.closes_at)
 or nullif(btrim(e.privacy_notice),'') is null or nullif(btrim(e.privacy_notice_version),'') is null then
 return jsonb_build_object('open',false); end if;
 return jsonb_build_object('open',true,'notice',e.privacy_notice,'version',e.privacy_notice_version,'marketingNotice',e.marketing_notice);
end $$;

-- Source: 034_halloween_open.sql
-- Review notice below, then run after 033. This enables real Halloween intake.
-- No deadline. Close manually with 035 when needed. No existing event/response is deleted.
do $$ begin
 if not exists(select 1 from public.recruitment_events where slug='halloween-2026' and not is_test and not is_archived) then raise exception 'Actual Halloween event is missing or archived'; end if;
end $$;
update public.recruitment_events set status='published',applications_open=true,registration_enabled=true,
 opens_at=coalesce(opens_at,clock_timestamp()),closes_at=null,
 privacy_notice_version='halloween-2026-10-18-v1',marketing_notice=null,
 privacy_notice='운영 주체: 말모임. 문의: cometomalmoim@gmail.com
수집 항목: 이름, 전화번호, 말모임 참가 여부 및 참가한 기수·활동명(선택), 유입 정보와 동의 기록.
목적: 신청 확인 및 행사 운영·참가 안내. 보유기간: 행사 종료 후 폐기.
개인정보 수집·이용 동의를 거부할 수 있으나, 동의하지 않으면 신청할 수 없습니다. 참가비는 추후 안내하며, 신청 접수는 참가 확정이나 결제 완료를 의미하지 않습니다.
Operator: MALMOIM. Contact: cometomalmoim@gmail.com. Collected: name, phone number, past MALMOIM participation, optional season/activity, referral information and consent records. Purpose: reviewing applications, organizing the event and contacting participants. Retention: deleted after the event ends. You may refuse consent, but it is required to apply. The entry fee will be announced later. Submitting does not confirm participation or complete payment.'
where slug='halloween-2026' and not is_test and not is_archived;
do $$ begin
 if not coalesce((public.event_registration_info('halloween-2026',false)->>'open')::boolean,false) then raise exception 'Readiness check failed; no changes committed'; end if;
end $$;
commit;
select public.season9_registration_info()->'open' as season9_open, public.event_registration_info('halloween-2026',false)->'open' as halloween_open;
