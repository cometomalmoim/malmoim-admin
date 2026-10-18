-- Optional public birth year; preserve intake state, existing responses and admin overrides.
begin;
alter table public.event_registration_responses add column birth_year integer check(birth_year between 1900 and 2200);
create or replace view public.event_application_list with(security_invoker=true) as
 with responses as (
 select id,event_id,name,contact,contact_type,preferred_class,status,created_at,null::text participation_history,null::text history_detail,'season9'::text source,extract(year from date_of_birth)::integer birth_year,nationality,null::text source_note from public.event_applications
 union all select id,event_id,name,contact,'phone',null,status,created_at,participation_history,history_detail,'registration',birth_year,null,null from public.event_registration_responses
 union all select id,event_id,name,contact,contact_type,null,'received',created_at,null,null,'manual',null,null,source_note from public.event_manual_applications
 ) select b.id,b.event_id,b.name,b.contact,b.contact_type,b.preferred_class,coalesce(m.status,b.status) status,b.created_at,b.participation_history,b.history_detail,b.source,
 case when m.application_id is not null then m.birth_year else b.birth_year end birth_year,
 case when m.application_id is not null then m.nationality else b.nationality end nationality,
 coalesce(m.payment_status,'unknown') payment_status,coalesce(m.internal_note,'') internal_note,coalesce(m.revision,0) revision,b.source_note
 from responses b left join public.event_application_management m on m.source=b.source and m.application_id=b.id and m.event_id=b.event_id;
create function public.submit_event_registration_with_birth_year(p_slug text,p_submission uuid,p_name text,p_contact text,p_history text,p_detail text,p_consent boolean,p_version text,p_test boolean,p_marketing boolean,p_utm_source text,p_utm_medium text,p_utm_campaign text,p_birth_year integer)returns text
 language plpgsql security definer set search_path='' as $$
declare e public.recruitment_events;old_response public.event_registration_responses;had_response boolean;result text;
begin
 if p_test is null then return 'invalid';end if;
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
-- Only future Halloween consent snapshots use the new version; retain the existing notice.
do $$begin
 if not exists(select 1 from public.recruitment_events where slug='halloween-2026' and not is_test and nullif(btrim(privacy_notice),'')is not null)then raise exception 'Halloween notice is not configured';end if;
end $$;
update public.recruitment_events set privacy_notice=privacy_notice||E'\n선택 수집 항목: 출생연도(YYYY). 미입력해도 신청할 수 있으며 위의 행사 운영 목적과 보유기간이 동일하게 적용됩니다.\nOptional information: birth year (YYYY). You may apply without providing it. The same event-operation purpose and retention period stated above apply.',
 privacy_notice_version='halloween-2026-10-18-birth-year-v1'
where slug='halloween-2026' and not is_test and privacy_notice is not null;
commit;
