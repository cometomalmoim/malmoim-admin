-- Review and run after 003. This installs intake and opens season9 when committed.
begin;
create or replace function public.submit_season9_application(payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  ev public.recruitment_events%rowtype;
  normalized_contact text;
  requested_id uuid;
  birth date;
begin
  if payload is null or pg_catalog.pg_column_size(payload) > 20000 then raise exception 'invalid_application'; end if;
  select * into ev from public.recruitment_events where slug='season9' for update;
  if not found or ev.status <> 'published' or not ev.applications_open or pg_catalog.clock_timestamp() >= ev.closes_at then raise exception 'recruitment_closed'; end if;
  if payload->>'notice_version' <> 'season9-2026-10-14-v1' or payload->>'privacy_consent' is distinct from 'true' or payload->>'fee_confirmed' is distinct from 'true' then raise exception 'consent_required'; end if;
  if payload->>'contact_type' not in ('phone','instagram') or payload->>'preferred_class' not in ('thursday','saturday') then raise exception 'invalid_application'; end if;
  if coalesce(char_length(payload->>'name'),0) not between 1 and 100 or coalesce(char_length(payload->>'contact'),0) not between 1 and 200 then raise exception 'invalid_application'; end if;
  normalized_contact := case when payload->>'contact_type'='phone' then pg_catalog.regexp_replace(payload->>'contact','[^0-9+]','','g') else pg_catalog.lower(pg_catalog.ltrim(payload->>'contact','@')) end;
  if payload->>'contact_type'='phone' and normalized_contact !~ '^\+?[0-9]{8,15}$' or payload->>'contact_type'='instagram' and normalized_contact !~ '^[a-z0-9_.]{1,30}$' then raise exception 'invalid_application'; end if;
  begin requested_id := (payload->>'submission_id')::uuid; birth := (payload->>'date_of_birth')::date; exception when others then raise exception 'invalid_application'; end;
  if requested_id is null or birth is null or birth > current_date then raise exception 'invalid_application'; end if;
  -- Event row lock serializes duplicate checks and caps across every RPC caller.
  -- Same identifier or contact returns the same generic receipt, never existing applicant details.
  if exists(select 1 from public.event_applications where event_id=ev.id and (submission_id=requested_id or (contact_type=payload->>'contact_type' and contact=normalized_contact))) then return jsonb_build_object('accepted',true); end if;
  if (select count(*) from public.event_applications where event_id=ev.id and created_at > pg_catalog.clock_timestamp()-interval '1 minute') >= 20 then raise exception 'rate_limited'; end if;
  if (select count(*) from public.event_applications where event_id=ev.id and created_at > pg_catalog.clock_timestamp()-interval '1 day') >= 500 then raise exception 'rate_limited'; end if;
  insert into public.event_applications(event_id,submission_id,name,contact,contact_type,preferred_class,nationality,gender,date_of_birth,occupation,korean_level,english_level,motivation,introduction,full_attendance,referral_sources,payment_method,privacy_notice_version,privacy_consent,photo_consent,future_updates_consent,fee_policy_confirmed,utm_source,utm_medium,utm_campaign,utm_term,utm_content)
  values(ev.id,requested_id,left(payload->>'name',100),normalized_contact,payload->>'contact_type',payload->>'preferred_class',left(payload->>'nationality',100),left(payload->>'gender',50),birth,left(payload->>'occupation',200),left(payload->>'korean_level',100),left(payload->>'english_level',100),left(payload->>'motivation',2000),left(payload->>'introduction',2000),(payload->>'full_attendance')::boolean,array(select jsonb_array_elements_text(coalesce(payload->'referral_sources','[]'::jsonb))),left(payload->>'payment_method',100),'season9-2026-10-14-v1',true,coalesce((payload->>'photo_consent')::boolean,false),coalesce((payload->>'future_updates_consent')::boolean,false),true,left(payload->>'utm_source',150),left(payload->>'utm_medium',150),left(payload->>'utm_campaign',150),left(payload->>'utm_term',150),left(payload->>'utm_content',150));
  return jsonb_build_object('accepted',true);
end $$;
revoke all on function public.submit_season9_application(jsonb) from public;
grant execute on function public.submit_season9_application(jsonb) to anon, authenticated;
-- Table SELECT/INSERT/UPDATE/DELETE grants and RLS remain unchanged.
update public.recruitment_events set status='published', applications_open=true where slug='season9';
commit;
