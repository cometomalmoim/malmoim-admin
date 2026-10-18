-- Require birth year for future public Halloween applications; preserve existing records.
begin;
do $$begin
 if not exists(select 1 from public.recruitment_events where slug='halloween-2026' and not is_test and privacy_notice_version='halloween-2026-10-18-birth-year-v1' and privacy_notice like '%Optional information: birth year (YYYY).%')then raise exception 'Unexpected Halloween consent version; review before applying';end if;
end $$;
create or replace function public.submit_event_registration_with_birth_year(p_slug text,p_submission uuid,p_name text,p_contact text,p_history text,p_detail text,p_consent boolean,p_version text,p_test boolean,p_marketing boolean,p_utm_source text,p_utm_medium text,p_utm_campaign text,p_birth_year integer)returns text
 language plpgsql security definer set search_path='' as $$
declare e public.recruitment_events;old_response public.event_registration_responses;had_response boolean;result text;
begin
 if p_test is null then return 'invalid';end if;
 if not p_test and p_slug='halloween-2026' and (p_birth_year is null or p_birth_year<1990 or p_birth_year>2007)then return 'birth_year';end if;
 if p_birth_year is not null and (p_birth_year<1900 or p_birth_year>extract(year from clock_timestamp() at time zone 'Asia/Seoul'))then return 'birth_year';end if;
 select * into e from public.recruitment_events where slug=p_slug for update;
 if not found then return 'closed';end if;
 if e.is_archived or (not p_test and e.slug<>'halloween-2026')then return 'closed';end if;
 select * into old_response from public.event_registration_responses where event_id=e.id and submission_id=p_submission;
 had_response:=found;
 if had_response and old_response.birth_year is distinct from p_birth_year then return 'invalid';end if;
 result:=public.submit_event_registration_attributed(p_slug,p_submission,p_name,p_contact,p_history,p_detail,p_consent,p_version,p_test,p_marketing,p_utm_source,p_utm_medium,p_utm_campaign);
 if result<>'saved'then return result;end if;
 if not had_response then
  update public.event_registration_responses set birth_year=p_birth_year where event_id=e.id and submission_id=p_submission;
 end if;
 return 'saved';
end $$;
revoke all on function public.submit_event_registration_with_birth_year(text,uuid,text,text,text,text,boolean,text,boolean,boolean,text,text,text,integer)from public,anon,authenticated;
grant execute on function public.submit_event_registration_with_birth_year(text,uuid,text,text,text,text,boolean,text,boolean,boolean,text,text,text,integer)to anon,authenticated;

update public.recruitment_events set privacy_notice=replace(replace(privacy_notice,
'선택 수집 항목: 출생연도(YYYY). 미입력해도 신청할 수 있으며 위의 행사 운영 목적과 보유기간이 동일하게 적용됩니다.',
'필수 수집 항목: 출생연도(YYYY). 1990~2007년생 참가 대상 확인을 위해 필수이며 위의 행사 운영 목적과 보유기간이 동일하게 적용됩니다.'),
'Optional information: birth year (YYYY). You may apply without providing it. The same event-operation purpose and retention period stated above apply.',
'Required information: birth year (YYYY), to verify eligibility for applicants born from 1990 through 2007. The same event-operation purpose and retention period stated above apply.'),
privacy_notice_version='halloween-2026-10-18-birth-year-required-v2'
where slug='halloween-2026' and not is_test;
commit;
