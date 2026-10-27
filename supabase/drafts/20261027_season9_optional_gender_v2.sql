-- REVIEW ONLY: do not apply to production without separate authorization.
-- Uses the existing nullable event_applications.gender column. No data rewrite or intake activation.
-- Deploy this migration BEFORE the matching frontend. v1 remains unchanged for old open tabs.
-- v2 info RPC is a readiness marker: the new UI fails closed until this migration is present.
begin;
create or replace function public.submit_season9_compact_application_v2(payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare ev public.recruitment_events; old public.event_applications; sid uuid; n text; c text; ct text; kind text; grp text; nat text; yr integer; g text;
 notice constant text:='말모임은 신청 확인·참여자 관리를 위해 이름·연락처·희망반, 신규 참여자의 국적·출생연도, 유입 정보와 동의 기록을 수집합니다. 성별은 선택 항목이며 미입력해도 신청할 수 있습니다. 프로그램 종료 후 폐기합니다. 필수 개인정보 동의와 활동 사진 활용 동의를 거부할 수 있으나 신청이 제한됩니다. 참가비는 6회 50,000원이며 활동 시작 후 환불이 불가합니다. 문의: Instagram @cometomalmoim. MALMOIM collects name, contact, group, nationality and birth year for new participants, referral and consent records for application review and participant management. Gender is optional and is not required to apply. Data is deleted after the program ends. Required privacy and photo consent may be refused, but are necessary to apply. Fee: KRW 50,000 for six sessions; no refunds after the program starts. Contact: Instagram @cometomalmoim.';
begin
 if payload is null or jsonb_typeof(payload)<>'object' or pg_column_size(payload)>10000 then raise exception 'invalid_application';end if;
 select * into ev from public.recruitment_events where slug='season9' for update;
 if not found or not coalesce((public.season9_registration_info()->>'open')::boolean,false) then raise exception 'recruitment_closed';end if;
 if payload->>'notice_version' is distinct from 'season9-2026-10-27-optional-gender-v2' or payload->'privacy_consent' is distinct from 'true'::jsonb or payload->'fee_confirmed' is distinct from 'true'::jsonb or payload->'photo_consent' is distinct from 'true'::jsonb then raise exception 'consent_required';end if;
 g:=nullif(btrim(payload->>'gender'),'');
 if g is not null and (length(g)>49 or (g not in ('male','female','prefer_not_to_say') and g!~'^self_describe:[^[:cntrl:]]{1,35}$')) then raise exception 'invalid_application';end if;
 n:=btrim(payload->>'name');ct:=payload->>'contact_type';kind:=payload->>'application_kind';grp:=payload->>'preferred_class';
 if coalesce(length(n),0) not between 1 and 100 or coalesce(ct,'') not in ('phone','instagram') or coalesce(kind,'') not in ('new','returning') or coalesce(grp,'') not in ('thursday','saturday') or coalesce(length(payload->>'contact'),0) not between 1 and 200 then raise exception 'invalid_application';end if;
 c:=case when ct='instagram' then lower(ltrim(btrim(payload->>'contact'),'@')) else public.event_contact_key(payload->>'contact','phone') end;
 if c is null or (ct='instagram' and c!~'^[a-z0-9_.]{1,30}$')then raise exception 'invalid_application';end if;
 if kind='new' then
  nat:=btrim(payload->>'nationality');
  if coalesce(length(nat),0) not between 1 and 100 or coalesce(payload->>'birth_year','')!~'^[0-9]{4}$' then raise exception 'invalid_application';end if;
  yr:=(payload->>'birth_year')::integer;
  if yr<1900 or yr>extract(year from current_date)::integer then raise exception 'invalid_application';end if;
 end if;
 begin sid:=(payload->>'submission_id')::uuid;exception when others then raise exception 'invalid_application';end;
 if sid is null then raise exception 'invalid_application';end if;
 select * into old from public.event_applications where event_id=ev.id and submission_id=sid;
 if found then
  if old.gender is not distinct from g and old.name=n and old.contact_type=ct and old.contact=c and old.preferred_class=grp and old.application_kind=kind and old.nationality is not distinct from nat and old.birth_year is not distinct from yr and old.privacy_notice_version='season9-2026-10-27-optional-gender-v2' then return jsonb_build_object('accepted',true);end if;
  raise exception 'invalid_application';
 end if;
 -- Phone numbers may submit a new application, including after administrative deletion.
 -- Request-ID idempotency and all consent, gate, format and rate checks remain unchanged.
 -- Instagram contact policy is unchanged.
 if ct<>'phone' and exists(select 1 from public.event_application_list a where a.event_id=ev.id and a.contact_type=ct and (case when ct='instagram' then lower(ltrim(btrim(a.contact),'@')) else public.event_contact_key(a.contact,'phone') end)=c) then raise exception 'duplicate_application';end if;
 if (select count(*) from public.event_applications where event_id=ev.id and created_at>clock_timestamp()-interval '1 minute')>=20 or (select count(*) from public.event_applications where event_id=ev.id and created_at>clock_timestamp()-interval '1 day')>=500 then raise exception 'rate_limited';end if;
 insert into public.event_applications(event_id,submission_id,name,contact,contact_type,preferred_class,nationality,birth_year,application_kind,gender,privacy_notice_version,privacy_notice_snapshot,privacy_consent,fee_policy_confirmed,photo_consent,utm_source,utm_medium,utm_campaign,utm_term,utm_content)
 values(ev.id,sid,n,c,ct,grp,nat,yr,kind,g,'season9-2026-10-27-optional-gender-v2',notice,true,true,true,nullif(left(payload->>'utm_source',150),''),nullif(left(payload->>'utm_medium',150),''),nullif(left(payload->>'utm_campaign',150),''),nullif(left(payload->>'utm_term',150),''),nullif(left(payload->>'utm_content',150),''));
 return jsonb_build_object('accepted',true);
end $$;

revoke all on function public.submit_season9_compact_application_v2(jsonb) from public;
grant execute on function public.submit_season9_compact_application_v2(jsonb) to anon,authenticated;
create or replace function public.season9_compact_registration_info_v2() returns jsonb
language sql security definer set search_path='' as $$select public.season9_registration_info()$$;
revoke all on function public.season9_compact_registration_info_v2() from public;
grant execute on function public.season9_compact_registration_info_v2() to anon,authenticated;
notify pgrst,'reload schema';
commit;
