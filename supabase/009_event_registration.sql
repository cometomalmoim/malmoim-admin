-- Additive migration. Public intake remains disabled. Existing season9 records unchanged.
begin;
alter table public.recruitment_events add column registration_enabled boolean not null default false,
 add column privacy_notice text, add column privacy_notice_version text, add column marketing_notice text;
create table public.event_registration_responses (
 id uuid primary key default gen_random_uuid(), event_id uuid not null references public.recruitment_events(id),
 submission_id uuid not null, name text not null check(length(name) between 1 and 100),
 contact text not null check(contact ~ '^\+?[0-9]{8,15}$'),
 participation_history text not null check(participation_history in ('new','returning')),
 history_detail text not null default '' check(length(history_detail)<=300),
 privacy_notice_version text not null, privacy_consent boolean not null check(privacy_consent),
 privacy_notice_snapshot text not null, marketing_consent boolean not null default false, marketing_notice_snapshot text, retention_review_at timestamptz not null default (now()+interval '3 months'), status text not null default 'received' check(status='received'),
 created_at timestamptz not null default now(), unique(event_id,submission_id),unique(event_id,contact)
);
alter table public.event_registration_responses enable row level security;
alter table public.event_registration_responses force row level security;
revoke all on public.event_registration_responses from public,anon,authenticated;
grant select on public.event_registration_responses to authenticated;
create policy "Administrators read event registrations" on public.event_registration_responses for select to authenticated
 using(exists(select 1 from public.admin_users where user_id=(select auth.uid())));
create view public.event_application_list with(security_invoker=true) as
 select id,event_id,name,contact,contact_type,preferred_class,status,created_at,null::text as participation_history,null::text as history_detail from public.event_applications
 union all
 select id,event_id,name,contact,'phone'::text,null::text,status,created_at,participation_history,history_detail from public.event_registration_responses;
revoke all on public.event_application_list from public,anon;
grant select on public.event_application_list to authenticated;
create function public.event_registration_info(p_slug text,p_test boolean default false) returns jsonb
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
 or e.opens_at is null or e.closes_at is null or clock_timestamp()<e.opens_at or clock_timestamp()>=e.closes_at
 or nullif(btrim(e.privacy_notice),'') is null or nullif(btrim(e.privacy_notice_version),'') is null then
 return jsonb_build_object('open',false); end if;
 return jsonb_build_object('open',true,'notice',e.privacy_notice,'version',e.privacy_notice_version,'marketingNotice',e.marketing_notice);
end $$;
create function public.submit_event_registration(p_slug text,p_submission uuid,p_name text,p_contact text,p_history text,p_detail text,p_consent boolean,p_version text,p_test boolean default false,p_marketing boolean default false) returns text
 language plpgsql security definer set search_path='' as $$
declare e public.recruitment_events; info jsonb; existing public.event_registration_responses;
begin
 -- Serialize submissions and state/deadline changes for this event.
 select * into e from public.recruitment_events where slug=p_slug for update;
 if not found then return 'closed'; end if;
 info:=public.event_registration_info(p_slug,p_test);
 if not (info->>'open')::boolean then return 'closed'; end if;
 if p_consent is distinct from true or p_version is distinct from info->>'version' or (p_marketing and nullif(btrim(info->>'marketingNotice'),'') is null) then return 'consent'; end if;
 if p_contact ~ '^010[0-9]{8}$' then p_contact:='+82'||substr(p_contact,2); end if;
 if p_contact ~ '^0082' then p_contact:='+'||substr(p_contact,3); end if;
 if p_submission is null or p_name is null or length(btrim(p_name)) not between 1 and 100 or p_contact is null or p_contact !~ '^\+?[0-9]{8,15}$'
 or p_history is null or p_history not in ('new','returning') or p_detail is null or length(p_detail)>300
 or (p_history='new' and p_detail<>'') then return 'invalid'; end if;
 select * into existing from public.event_registration_responses where event_id=e.id and submission_id=p_submission;
 if found then
   if existing.name=btrim(p_name) and existing.contact=p_contact and existing.participation_history=p_history and existing.history_detail=p_detail and existing.marketing_consent=p_marketing then return 'saved'; end if;
   return 'invalid';
 end if;
 if exists(select 1 from public.event_registration_responses where event_id=e.id and contact=p_contact) then return 'duplicate'; end if;
 if (select count(*) from public.event_registration_responses where event_id=e.id and created_at>clock_timestamp()-interval '1 minute')>=60 then return 'busy'; end if;
 if e.capacity is not null and (select count(*) from public.event_registration_responses where event_id=e.id)>=e.capacity then return 'full'; end if;
 insert into public.event_registration_responses(event_id,submission_id,name,contact,participation_history,history_detail,privacy_notice_version,privacy_consent,privacy_notice_snapshot,marketing_consent,marketing_notice_snapshot)
 values(e.id,p_submission,btrim(p_name),p_contact,p_history,p_detail,p_version,true,info->>'notice',p_marketing,case when p_marketing then info->>'marketingNotice' else null end);
 return 'saved';
end $$;
revoke all on function public.event_registration_info(text,boolean) from public;
revoke all on function public.submit_event_registration(text,uuid,text,text,text,text,boolean,text,boolean,boolean) from public;
grant execute on function public.event_registration_info(text,boolean),public.submit_event_registration(text,uuid,text,text,text,text,boolean,text,boolean,boolean) to anon,authenticated;
commit;
