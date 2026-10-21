-- Optional nationality. Apply before deploying the new registration action.
-- Preserves intake state, existing responses, administrator overrides and RLS.
begin;
alter table public.event_registration_responses add column nationality text check(length(nationality)<=100);
create or replace view public.event_application_list with(security_invoker=true) as
 with responses as (
 select id,event_id,name,contact,contact_type,preferred_class,status,created_at,null::text participation_history,null::text history_detail,'season9'::text source,extract(year from date_of_birth)::integer birth_year,nationality,null::text source_note from public.event_applications
 union all select id,event_id,name,contact,'phone',null,status,created_at,participation_history,history_detail,'registration',birth_year,nationality,null from public.event_registration_responses
 union all select id,event_id,name,contact,contact_type,null,'received',created_at,null,null,'manual',null,null,source_note from public.event_manual_applications
 ) select b.id,b.event_id,b.name,b.contact,b.contact_type,b.preferred_class,coalesce(m.status,b.status) status,b.created_at,b.participation_history,b.history_detail,b.source,
 case when m.application_id is not null then m.birth_year else b.birth_year end birth_year,
 case when m.application_id is not null then m.nationality else b.nationality end nationality,
 coalesce(m.payment_status,'unknown') payment_status,coalesce(m.internal_note,'') internal_note,coalesce(m.revision,0) revision,b.source_note
 from responses b left join public.event_application_management m on m.source=b.source and m.application_id=b.id and m.event_id=b.event_id;
create function public.submit_event_registration_with_nationality(p_slug text,p_submission uuid,p_name text,p_contact text,p_history text,p_detail text,p_consent boolean,p_version text,p_test boolean,p_marketing boolean,p_utm_source text,p_utm_medium text,p_utm_campaign text,p_birth_year integer,p_nationality text)returns text
 language plpgsql security definer set search_path='' as $$
declare e public.recruitment_events;old_response public.event_registration_responses;had_response boolean;result text;n text:=nullif(btrim(p_nationality),'');
begin
 if p_test is null then return 'invalid';end if;
 if length(n)>100 then return 'nationality';end if;
 select * into e from public.recruitment_events where slug=p_slug for update;
 if not found then return 'closed';end if;
 if e.is_archived or (not p_test and e.slug<>'halloween-2026')then return 'closed';end if;
 select * into old_response from public.event_registration_responses where event_id=e.id and submission_id=p_submission;
 had_response:=found;
 if had_response and old_response.nationality is distinct from n then return 'invalid';end if;
 -- Existing RPC enforces admin test access, notice version, capacity, duplicate,
 -- time/rate limits, birth-year eligibility and consent before accepting a save.
 result:=public.submit_event_registration_with_birth_year(p_slug,p_submission,p_name,p_contact,p_history,p_detail,p_consent,p_version,p_test,p_marketing,p_utm_source,p_utm_medium,p_utm_campaign,p_birth_year);
 if result<>'saved'then return result;end if;
 if not had_response then
  update public.event_registration_responses set nationality=n where event_id=e.id and submission_id=p_submission;
 end if;
 return 'saved';
end $$;
revoke all on function public.submit_event_registration_with_nationality(text,uuid,text,text,text,text,boolean,text,boolean,boolean,text,text,text,integer,text)from public,anon,authenticated;
grant execute on function public.submit_event_registration_with_nationality(text,uuid,text,text,text,text,boolean,text,boolean,boolean,text,text,text,integer,text)to anon,authenticated;
do $$begin
 if not exists(select 1 from public.recruitment_events where slug='halloween-2026' and not is_test and privacy_notice_version='halloween-2026-10-18-birth-year-required-v2')then raise exception 'Unexpected Halloween notice version; review before applying';end if;
end $$;
update public.recruitment_events set privacy_notice=privacy_notice||E'\n선택 수집 항목: 국적. 행사 참여자 구성 파악을 위해 수집하며, 미입력해도 신청할 수 있습니다. 위의 행사 운영 목적과 보유기간이 동일하게 적용됩니다.\nOptional information: nationality, to understand the participant mix. You can apply without providing it. The same event-operation purpose and retention period stated above apply.',
 privacy_notice_version='halloween-2026-10-21-nationality-v1'
where slug='halloween-2026' and not is_test;
notify pgrst,'reload schema';
commit;
