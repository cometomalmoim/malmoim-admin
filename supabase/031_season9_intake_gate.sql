-- Run after existing event/admin migrations through 030. Does NOT open either event.
-- No table read/write grants or admin permissions are expanded.
begin;
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

commit;
