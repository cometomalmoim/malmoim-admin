-- Administrator-only operations. No public intake or payment integration changes.
begin;
create table public.event_manual_applications(
 id uuid primary key default gen_random_uuid(),event_id uuid not null references public.recruitment_events(id),
 name text not null,contact text not null,contact_type text not null check(contact_type in ('phone','instagram')),
 source_note text not null check(length(source_note) between 1 and 1000),created_at timestamptz not null default now()
);
create table public.event_application_management(
 source text not null check(source in ('season9','registration','manual')),application_id uuid not null,
 event_id uuid not null references public.recruitment_events(id),birth_year integer check(birth_year between 1900 and 2200),
 nationality text check(length(nationality)<=100),internal_note text not null default '' check(length(internal_note)<=3000),
 status text not null check(status in ('received','reviewing','accepted','waitlisted','declined','withdrawn')),
 payment_status text not null default 'unknown' check(payment_status in ('unknown','unpaid','paid','refunded')),
 revision integer not null default 1,updated_at timestamptz not null default now(),updated_by uuid not null,
 primary key(source,application_id)
);
create table public.event_application_audit(
 id uuid primary key default gen_random_uuid(),event_id uuid not null references public.recruitment_events(id),
 source text not null,application_id uuid not null,actor uuid not null,action text not null,
 old_status text,new_status text,old_payment text,new_payment text,created_at timestamptz not null default now()
);
alter table public.event_manual_applications enable row level security;
alter table public.event_manual_applications force row level security;
alter table public.event_application_management enable row level security;
alter table public.event_application_management force row level security;
alter table public.event_application_audit enable row level security;
alter table public.event_application_audit force row level security;
revoke all on public.event_manual_applications,public.event_application_management,public.event_application_audit from public,anon,authenticated;
grant select on public.event_manual_applications,public.event_application_management,public.event_application_audit to authenticated;
create policy "Administrators read manual applications" on public.event_manual_applications for select to authenticated using(exists(select 1 from public.admin_users where user_id=(select auth.uid())));
create policy "Administrators read application management" on public.event_application_management for select to authenticated using(exists(select 1 from public.admin_users where user_id=(select auth.uid())));
create policy "Administrators read application audits" on public.event_application_audit for select to authenticated using(exists(select 1 from public.admin_users where user_id=(select auth.uid())));
create or replace view public.event_application_list with(security_invoker=true) as
 with responses as (
 select id,event_id,name,contact,contact_type,preferred_class,status,created_at,null::text participation_history,null::text history_detail,'season9'::text source,extract(year from date_of_birth)::integer birth_year,nationality,null::text source_note from public.event_applications
 union all select id,event_id,name,contact,'phone',null,status,created_at,participation_history,history_detail,'registration',null,null,null from public.event_registration_responses
 union all select id,event_id,name,contact,contact_type,null,'received',created_at,null,null,'manual',null,null,source_note from public.event_manual_applications
 ) select b.id,b.event_id,b.name,b.contact,b.contact_type,b.preferred_class,coalesce(m.status,b.status) status,b.created_at,b.participation_history,b.history_detail,b.source,
 case when m.application_id is not null then m.birth_year else b.birth_year end birth_year,
 case when m.application_id is not null then m.nationality else b.nationality end nationality,
 coalesce(m.payment_status,'unknown') payment_status,coalesce(m.internal_note,'') internal_note,coalesce(m.revision,0) revision,b.source_note
 from responses b left join public.event_application_management m on m.source=b.source and m.application_id=b.id and m.event_id=b.event_id;
create function public.event_contact_key(p_contact text,p_type text) returns text language plpgsql immutable set search_path='' as $$
declare c text;begin
 if p_type='instagram' then return lower(btrim(p_contact));end if;
 c:=regexp_replace(p_contact,'[ ()-]','','g');
 if c ~ '^010[0-9]{8}$' then c:='+82'||substr(c,2);end if;
 if c ~ '^0082' then c:='+'||substr(c,3);end if;
 if c !~ '^\+?[0-9]{8,15}$' then return null;end if;
 return '+'||replace(c,'+','');end $$;
revoke all on function public.event_contact_key(text,text) from public;
create function public.manage_event_application(p_slug text,p_source text,p_id uuid,p_revision integer,p_name text,p_contact text,p_contact_type text,p_birth_year integer,p_nationality text,p_status text,p_payment text,p_note text,p_source_note text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare e public.recruitment_events; previous public.event_application_list; normalized text; v_application_id uuid:=p_id; begin
 if not exists(select 1 from public.admin_users where user_id=auth.uid()) then return jsonb_build_object('code','forbidden');end if;
 if p_source is null or p_source not in ('manual','registration','season9') then return jsonb_build_object('code','invalid');end if;
 if p_name is null or length(btrim(p_name)) not between 1 and 100 or p_contact is null or length(btrim(p_contact)) not between 1 and 200
 or p_contact_type is null or p_contact_type not in ('phone','instagram') or p_status is null or p_status not in ('received','reviewing','accepted','waitlisted','declined','withdrawn')
 or p_payment is null or p_payment not in ('unknown','unpaid','paid','refunded') or p_note is null or length(p_note)>3000 or length(p_nationality)>100
 or (p_birth_year is not null and (p_birth_year<1900 or p_birth_year>extract(year from current_date))) then return jsonb_build_object('code','invalid');end if;
 normalized:=public.event_contact_key(p_contact,p_contact_type);
 if normalized is null or normalized='' then return jsonb_build_object('code','invalid');end if;
 select * into e from public.recruitment_events where slug=p_slug for update;
 if not found then return jsonb_build_object('code','missing');end if;
 if p_id is not null then
 select * into previous from public.event_application_list where event_id=e.id and id=p_id and source=p_source;
 if not found then return jsonb_build_object('code','missing');end if;
 if p_revision is distinct from previous.revision then return jsonb_build_object('code','conflict');end if;
 if p_source='registration' and p_contact_type<>'phone' then return jsonb_build_object('code','invalid');end if;
 else
 if p_source<>'manual' or p_source_note is null or length(btrim(p_source_note)) not between 1 and 1000 then return jsonb_build_object('code','invalid');end if;
 end if;
 if exists(select 1 from public.event_application_list a where a.event_id=e.id and a.contact_type=p_contact_type and public.event_contact_key(a.contact,a.contact_type)=normalized and (p_id is null or a.id<>p_id or a.source<>p_source)) then return jsonb_build_object('code','duplicate');end if;
 if p_id is null then
 insert into public.event_manual_applications(event_id,name,contact,contact_type,source_note) values(e.id,btrim(p_name),normalized,p_contact_type,btrim(p_source_note)) returning id into v_application_id;
 elsif p_source='manual' then
 if p_source_note is null or length(btrim(p_source_note)) not between 1 and 1000 then return jsonb_build_object('code','invalid');end if;
 update public.event_manual_applications set name=btrim(p_name),contact=normalized,contact_type=p_contact_type,source_note=btrim(p_source_note) where id=p_id and event_id=e.id;
 elsif p_source='registration' then
 update public.event_registration_responses set name=btrim(p_name),contact=normalized where id=p_id and event_id=e.id;
 elsif p_source='season9' then
 update public.event_applications set name=btrim(p_name),contact=normalized,contact_type=p_contact_type where id=p_id and event_id=e.id;
 else return jsonb_build_object('code','invalid');end if;
 insert into public.event_application_management(source,application_id,event_id,birth_year,nationality,internal_note,status,payment_status,revision,updated_by)
 values(p_source,v_application_id,e.id,p_birth_year,nullif(btrim(p_nationality),''),p_note,p_status,p_payment,coalesce(previous.revision,0)+1,auth.uid())
 on conflict(source,application_id) do update set birth_year=excluded.birth_year,nationality=excluded.nationality,internal_note=excluded.internal_note,status=excluded.status,payment_status=excluded.payment_status,revision=excluded.revision,updated_at=clock_timestamp(),updated_by=excluded.updated_by;
 insert into public.event_application_audit(event_id,source,application_id,actor,action,old_status,new_status,old_payment,new_payment)
 values(e.id,p_source,v_application_id,auth.uid(),case when p_id is null then 'manual_create' else 'update' end,previous.status,p_status,previous.payment_status,p_payment);
 return jsonb_build_object('code','saved','id',v_application_id,'revision',coalesce(previous.revision,0)+1);
end $$;
revoke all on function public.manage_event_application(text,text,uuid,integer,text,text,text,integer,text,text,text,text,text) from public,anon;
grant execute on function public.manage_event_application(text,text,uuid,integer,text,text,text,integer,text,text,text,text,text) to authenticated;
create or replace function public.submit_event_registration(p_slug text,p_submission uuid,p_name text,p_contact text,p_history text,p_detail text,p_consent boolean,p_version text,p_test boolean default false,p_marketing boolean default false) returns text
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
 if exists(select 1 from public.event_application_list a where a.event_id=e.id and a.contact_type='phone' and public.event_contact_key(a.contact,'phone')=public.event_contact_key(p_contact,'phone')) then return 'duplicate'; end if;
 if (select count(*) from public.event_registration_responses where event_id=e.id and created_at>clock_timestamp()-interval '1 minute')>=60 then return 'busy'; end if;
 if e.capacity is not null and (select count(*) from public.event_registration_responses where event_id=e.id)>=e.capacity then return 'full'; end if;
 insert into public.event_registration_responses(event_id,submission_id,name,contact,participation_history,history_detail,privacy_notice_version,privacy_consent,privacy_notice_snapshot,marketing_consent,marketing_notice_snapshot)
 values(e.id,p_submission,btrim(p_name),p_contact,p_history,p_detail,p_version,true,info->>'notice',p_marketing,case when p_marketing then info->>'marketingNotice' else null end);
 return 'saved';
end $$;
commit;
