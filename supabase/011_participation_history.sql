-- Separate participation module; payment and selection storage are unchanged.
begin;
create table public.event_people(id uuid primary key default gen_random_uuid(),name text not null,contact text not null,contact_type text not null,created_at timestamptz not null default now());
create table public.event_participation(
 source text not null check(source in ('season9','registration','manual')),application_id uuid not null,event_id uuid not null references public.recruitment_events(id),person_id uuid not null references public.event_people(id),
 confirmation text not null default 'unconfirmed' check(confirmation in ('unconfirmed','confirmed','cancelled')),
 attendance text not null default 'unrecorded' check(attendance in ('unrecorded','attended','absent','no_show')),
 note text not null default '' check(length(note)<=2000),revision integer not null default 1,updated_at timestamptz not null default now(),updated_by uuid not null,
 primary key(source,application_id),unique(person_id,event_id)
);
create table public.event_participation_audit(id uuid primary key default gen_random_uuid(),event_id uuid not null,source text not null,application_id uuid not null,actor uuid not null,previous jsonb,current_value jsonb,created_at timestamptz not null default now());
alter table public.event_people enable row level security;alter table public.event_people force row level security;
alter table public.event_participation enable row level security;alter table public.event_participation force row level security;
alter table public.event_participation_audit enable row level security;alter table public.event_participation_audit force row level security;
revoke all on public.event_people,public.event_participation,public.event_participation_audit from public,anon,authenticated;
grant select on public.event_people,public.event_participation,public.event_participation_audit to authenticated;
create policy "Admins read people" on public.event_people for select to authenticated using(exists(select 1 from public.admin_users where user_id=(select auth.uid())));
create policy "Admins read participation" on public.event_participation for select to authenticated using(exists(select 1 from public.admin_users where user_id=(select auth.uid())));
create policy "Admins read participation audit" on public.event_participation_audit for select to authenticated using(exists(select 1 from public.admin_users where user_id=(select auth.uid())));
create view public.event_person_totals with(security_invoker=true) as
 select p.id,p.name,p.contact,p.contact_type,
 count(t.application_id) filter(where not e.is_test) as application_count,
 count(t.application_id) filter(where not e.is_test and t.confirmation='confirmed') as confirmed_count,
 count(t.application_id) filter(where not e.is_test and t.attendance='attended') as attendance_count,
 count(t.application_id) filter(where e.is_test and t.attendance='attended') as test_attendance_count
 from public.event_people p left join public.event_participation t on t.person_id=p.id left join public.recruitment_events e on e.id=t.event_id group by p.id;
revoke all on public.event_person_totals from public,anon;grant select on public.event_person_totals to authenticated;
create function public.link_event_person(p_slug text,p_source text,p_application uuid,p_person uuid,p_revision integer,p_identity_confirmed boolean) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare a public.event_application_list;e public.recruitment_events;t public.event_participation;v_person uuid:=p_person;begin
 if not exists(select 1 from public.admin_users where user_id=auth.uid())then return jsonb_build_object('code','forbidden');end if;
 if p_identity_confirmed is distinct from true then return jsonb_build_object('code','identity');end if;
 select * into e from public.recruitment_events where slug=p_slug for update;
 if not found then return jsonb_build_object('code','missing');end if;
 select * into a from public.event_application_list where event_id=e.id and source=p_source and id=p_application;
 if not found then return jsonb_build_object('code','missing');end if;
 select * into t from public.event_participation where source=p_source and application_id=p_application;
 if p_revision is distinct from coalesce(t.revision,0)then return jsonb_build_object('code','conflict');end if;
 if t.application_id is not null and p_person=t.person_id then return jsonb_build_object('code','saved','person',p_person);end if;
 if t.application_id is not null and (p_person is null or t.attendance<>'unrecorded')then return jsonb_build_object('code','locked');end if;
 if p_person is not null and not exists(select 1 from public.event_people where id=p_person)then return jsonb_build_object('code','missing');end if;
 if exists(select 1 from public.event_participation where person_id=p_person and event_id=e.id and (application_id<>p_application or source<>p_source))then return jsonb_build_object('code','duplicate');end if;
 if p_person is null then insert into public.event_people(name,contact,contact_type) values(a.name,a.contact,a.contact_type) returning id into v_person;end if;
 insert into public.event_participation(source,application_id,event_id,person_id,updated_by) values(p_source,p_application,e.id,v_person,auth.uid())
 on conflict(source,application_id)do update set person_id=excluded.person_id,confirmation='unconfirmed',attendance='unrecorded',revision=public.event_participation.revision+1,updated_at=clock_timestamp(),updated_by=auth.uid();
 insert into public.event_participation_audit(event_id,source,application_id,actor,previous,current_value)values(e.id,p_source,p_application,auth.uid(),case when t.application_id is null then null else jsonb_build_object('person',t.person_id,'confirmation',t.confirmation,'attendance',t.attendance)end,jsonb_build_object('person',v_person,'confirmation','unconfirmed','attendance','unrecorded'));
 return jsonb_build_object('code','saved','person',v_person);
end $$;
create function public.record_event_participation(p_slug text,p_source text,p_application uuid,p_revision integer,p_confirmation text,p_attendance text,p_note text) returns text
 language plpgsql security definer set search_path='' as $$
declare e public.recruitment_events;t public.event_participation;begin
 if not exists(select 1 from public.admin_users where user_id=auth.uid())then return 'forbidden';end if;
 if p_confirmation is null or p_confirmation not in ('unconfirmed','confirmed','cancelled') or p_attendance is null or p_attendance not in ('unrecorded','attended','absent','no_show') or p_note is null or length(p_note)>2000 then return 'invalid';end if;
 if p_attendance<>'unrecorded' and p_confirmation<>'confirmed'then return 'confirmation';end if;
 select * into e from public.recruitment_events where slug=p_slug for update;
 if not found then return 'missing';end if;
 if p_attendance<>'unrecorded' and not e.is_test and (e.starts_at is null or e.starts_at>clock_timestamp())then return 'future';end if;
 select * into t from public.event_participation where event_id=e.id and source=p_source and application_id=p_application;
 if not found then return 'missing';end if;
 if p_revision is distinct from t.revision then return 'conflict';end if;
 update public.event_participation set confirmation=p_confirmation,attendance=p_attendance,note=p_note,revision=revision+1,updated_at=clock_timestamp(),updated_by=auth.uid()where source=p_source and application_id=p_application;
 insert into public.event_participation_audit(event_id,source,application_id,actor,previous,current_value)values(e.id,p_source,p_application,auth.uid(),jsonb_build_object('person',t.person_id,'confirmation',t.confirmation,'attendance',t.attendance),jsonb_build_object('person',t.person_id,'confirmation',p_confirmation,'attendance',p_attendance));
 return 'saved';end $$;
revoke all on function public.link_event_person(text,text,uuid,uuid,integer,boolean),public.record_event_participation(text,text,uuid,integer,text,text,text) from public,anon;
grant execute on function public.link_event_person(text,text,uuid,uuid,integer,boolean),public.record_event_participation(text,text,uuid,integer,text,text,text) to authenticated;
commit;
