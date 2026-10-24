-- Apply before app deployment; old intake endpoints stay temporarily compatible.
begin;
alter table public.event_registration_responses add column gender text check(gender in ('male','female','other'));
create or replace view public.event_application_language_list with(security_invoker=true) as
select a.*,s.korean_level,s.english_level,
case when regexp_replace(lower(coalesce(a.nationality,'')),'[^a-z가-힣]','','g') in ('','미입력','미확인','미상','국적미상','unknown','none') then 'unknown'
 when regexp_replace(lower(a.nationality),'[^a-z가-힣]','','g') in ('대한민국','한국','한국인','대한민국한국','한국대한민국','korea','southkorea','republicofkorea','korearepublicof','korean','southkorean','kr','kor','대한민국southkorea','한국southkorea') then 'korean'
 else 'foreign' end as nationality_group,case when a.source='season9' then s.gender when a.source='registration' then r.gender else null end as gender
from public.event_application_admin_list a
left join public.event_applications s on a.source='season9' and a.event_id=s.event_id and a.id=s.id
left join public.event_registration_responses r on a.source='registration' and a.event_id=r.event_id and a.id=r.id;
create function public.submit_event_registration_with_profile(p_slug text,p_submission uuid,p_name text,p_contact text,p_history text,p_detail text,p_consent boolean,p_version text,p_test boolean,p_marketing boolean,p_utm_source text,p_utm_medium text,p_utm_campaign text,p_birth_year integer,p_nationality text,p_gender text)returns text
 language plpgsql security definer set search_path='' as $$
declare e public.recruitment_events;old_response public.event_registration_responses;had_response boolean;result text;n text:=nullif(btrim(p_nationality),'');
begin
 if p_test is null then return 'invalid';end if;
 if length(n)>100 or (not p_test and p_slug='halloween-2026' and n is null) then return 'nationality';end if;
 if (p_gender is not null and p_gender not in ('male','female','other')) or (not p_test and p_slug='halloween-2026' and p_gender is null) then return 'gender';end if;
 select * into e from public.recruitment_events where slug=p_slug for update;
 if not found then return 'closed';end if;
 if e.is_archived or (not p_test and e.slug<>'halloween-2026')then return 'closed';end if;
 select * into old_response from public.event_registration_responses where event_id=e.id and submission_id=p_submission;
 had_response:=found;
 if had_response and (old_response.nationality is distinct from n or old_response.gender is distinct from p_gender) then return 'invalid';end if;
 -- Existing RPC enforces admin test access, notice version, capacity, duplicate,
 -- time/rate limits, birth-year eligibility and consent before accepting a save.
 result:=public.submit_event_registration_with_birth_year(p_slug,p_submission,p_name,p_contact,p_history,p_detail,p_consent,p_version,p_test,p_marketing,p_utm_source,p_utm_medium,p_utm_campaign,p_birth_year);
 if result<>'saved'then return result;end if;
 if not had_response then
  update public.event_registration_responses set nationality=n,gender=p_gender where event_id=e.id and submission_id=p_submission;
 end if;
 return 'saved';
end $$;
revoke all on function public.submit_event_registration_with_profile(text,uuid,text,text,text,text,boolean,text,boolean,boolean,text,text,text,integer,text,text)from public,anon,authenticated;
grant execute on function public.submit_event_registration_with_profile(text,uuid,text,text,text,text,boolean,text,boolean,boolean,text,text,text,integer,text,text)to anon,authenticated;
do $$begin
 if not exists(select 1 from public.recruitment_events where slug='halloween-2026' and not is_test and privacy_notice_version='halloween-2026-10-21-nationality-v1')then raise exception 'Unexpected Halloween notice version';end if;
end $$;
update public.recruitment_events set privacy_notice=replace(replace(privacy_notice,
'선택 수집 항목: 국적. 행사 참여자 구성 파악을 위해 수집하며, 미입력해도 신청할 수 있습니다.',
'필수 수집 항목: 국적·성별. 행사 참여자 구성 파악을 위해 수집하며, 미입력 시 신청할 수 없습니다.'),
'Optional information: nationality, to understand the participant mix. You can apply without providing it.',
'Required information: nationality and gender, to understand the participant mix. Both fields are required to apply.'),
privacy_notice_version='halloween-2026-10-21-profile-required-v2'
where slug='halloween-2026' and not is_test;
notify pgrst,'reload schema';
commit;
