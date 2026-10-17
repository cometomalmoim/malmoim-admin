-- Add date-based attendance without inventing dates for legacy records.
begin;
alter table public.event_participation add column legacy_attendance text not null default 'unrecorded' check(legacy_attendance in ('unrecorded','attended','absent','no_show'));
update public.event_participation set legacy_attendance=attendance;
create table public.event_sessions(
 id uuid primary key default gen_random_uuid(),event_id uuid not null references public.recruitment_events(id),
 session_date date not null,title text not null check(length(trim(title)) between 1 and 80),revision integer not null default 1,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),updated_by uuid not null,
 unique(event_id,session_date),unique(id,event_id)
);
create table public.event_session_attendance(
 session_id uuid not null,event_id uuid not null,source text not null,application_id uuid not null,
 attendance text not null check(attendance in ('unrecorded','attended','absent','no_show')),revision integer not null default 1,
 updated_at timestamptz not null default now(),updated_by uuid not null,
 primary key(session_id,source,application_id),foreign key(session_id,event_id) references public.event_sessions(id,event_id),
 foreign key(source,application_id) references public.event_participation(source,application_id)
);
create index event_session_attendance_application on public.event_session_attendance(source,application_id);
create table public.event_session_audit(id uuid primary key default gen_random_uuid(),event_id uuid not null,session_id uuid not null,source text,application_id uuid,actor uuid not null,previous jsonb,current_value jsonb,created_at timestamptz not null default now());
alter table public.event_sessions enable row level security;alter table public.event_sessions force row level security;
alter table public.event_session_attendance enable row level security;alter table public.event_session_attendance force row level security;
alter table public.event_session_audit enable row level security;alter table public.event_session_audit force row level security;
revoke all on public.event_sessions,public.event_session_attendance,public.event_session_audit from public,anon,authenticated;
grant select on public.event_sessions,public.event_session_attendance,public.event_session_audit to authenticated;
create policy "Admins read sessions" on public.event_sessions for select to authenticated using(exists(select 1 from public.admin_users where user_id=(select auth.uid())));
create policy "Admins read session attendance" on public.event_session_attendance for select to authenticated using(exists(select 1 from public.admin_users where user_id=(select auth.uid())));
create policy "Admins read session audit" on public.event_session_audit for select to authenticated using(exists(select 1 from public.admin_users where user_id=(select auth.uid())));
create function public.manage_event_session(p_slug text,p_id uuid,p_revision integer,p_date date,p_title text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare e public.recruitment_events;s public.event_sessions;v_id uuid;begin
 if not exists(select 1 from public.admin_users where user_id=auth.uid())then return jsonb_build_object('code','forbidden');end if;
 if p_date is null or p_date<'2000-01-01'::date or p_date>'2100-12-31'::date or p_title is null or length(trim(p_title)) not between 1 and 80 then return jsonb_build_object('code','invalid');end if;
 select * into e from public.recruitment_events where slug=p_slug for update;if not found then return jsonb_build_object('code','missing');end if;
 if p_id is not null then
  select * into s from public.event_sessions where id=p_id and event_id=e.id;
  if not found then return jsonb_build_object('code','missing');end if;
  if p_revision is distinct from s.revision then return jsonb_build_object('code','conflict');end if;
  if p_date<>s.session_date and exists(select 1 from public.event_session_attendance where session_id=s.id and attendance<>'unrecorded')then return jsonb_build_object('code','locked');end if;
 elsif p_revision is distinct from 0 then return jsonb_build_object('code','conflict');end if;
 if exists(select 1 from public.event_sessions where event_id=e.id and session_date=p_date and id is distinct from p_id)then return jsonb_build_object('code','duplicate');end if;
 if p_id is null then insert into public.event_sessions(event_id,session_date,title,updated_by)values(e.id,p_date,trim(p_title),auth.uid())returning id into v_id;
 else update public.event_sessions set session_date=p_date,title=trim(p_title),revision=revision+1,updated_at=clock_timestamp(),updated_by=auth.uid()where id=p_id returning id into v_id;end if;
 insert into public.event_session_audit(event_id,session_id,actor,previous,current_value)values(e.id,v_id,auth.uid(),case when p_id is null then null else to_jsonb(s)end,jsonb_build_object('date',p_date,'title',trim(p_title)));
 return jsonb_build_object('code','saved','id',v_id);
end $$;
create function public.record_session_attendance(p_slug text,p_session uuid,p_source text,p_application uuid,p_revision integer,p_participation_revision integer,p_attendance text) returns text
language plpgsql security definer set search_path='' as $$
declare e public.recruitment_events;s public.event_sessions;t public.event_participation;a public.event_session_attendance;v_attendance text;begin
 if not exists(select 1 from public.admin_users where user_id=auth.uid())then return 'forbidden';end if;
 if p_attendance is null or p_attendance not in ('unrecorded','attended','absent','no_show')then return 'invalid';end if;
 select * into e from public.recruitment_events where slug=p_slug for update;if not found then return 'missing';end if;
 select * into s from public.event_sessions where id=p_session and event_id=e.id;if not found then return 'missing';end if;
 if p_attendance<>'unrecorded' and not e.is_test and s.session_date>(clock_timestamp() at time zone 'Asia/Seoul')::date then return 'future';end if;
 if not exists(select 1 from public.event_application_admin_list where event_id=e.id and source=p_source and id=p_application and not is_archived)then return 'missing';end if;
 select * into t from public.event_participation where event_id=e.id and source=p_source and application_id=p_application;
 if not found then return 'missing';end if;
 if t.revision is distinct from p_participation_revision then return 'conflict';end if;
 if p_attendance<>'unrecorded' and t.confirmation<>'confirmed'then return 'confirmation';end if;
 select * into a from public.event_session_attendance where session_id=s.id and source=p_source and application_id=p_application;
 if p_revision is distinct from coalesce(a.revision,0)then return 'conflict';end if;
 insert into public.event_session_attendance(session_id,event_id,source,application_id,attendance,updated_by)values(s.id,e.id,p_source,p_application,p_attendance,auth.uid())
 on conflict(session_id,source,application_id)do update set attendance=excluded.attendance,revision=public.event_session_attendance.revision+1,updated_at=clock_timestamp(),updated_by=auth.uid();
 -- Preserve undated legacy evidence; one event remains one event in existing totals/certificates.
 select case when bool_or(v='attended')then 'attended' when bool_or(v='no_show')then 'no_show' when bool_or(v='absent')then 'absent' else 'unrecorded'end into v_attendance
 from(select t.legacy_attendance as v union all select attendance from public.event_session_attendance where event_id=e.id and source=p_source and application_id=p_application)x;
 update public.event_participation set attendance=v_attendance,revision=revision+1,updated_at=clock_timestamp(),updated_by=auth.uid()where source=p_source and application_id=p_application;
 insert into public.event_session_audit(event_id,session_id,source,application_id,actor,previous,current_value)values(e.id,s.id,p_source,p_application,auth.uid(),case when a.session_id is null then null else to_jsonb(a)end,jsonb_build_object('attendance',p_attendance,'event_attendance',v_attendance));
 insert into public.event_participation_audit(event_id,source,application_id,actor,previous,current_value)values(e.id,p_source,p_application,auth.uid(),jsonb_build_object('attendance',t.attendance),jsonb_build_object('attendance',v_attendance,'session',s.id));
 return 'saved';end $$;
-- Existing signature is retained, but aggregate attendance cannot be overwritten after dated records exist.
create or replace function public.record_event_participation(p_slug text,p_source text,p_application uuid,p_revision integer,p_confirmation text,p_attendance text,p_note text) returns text
language plpgsql security definer set search_path='' as $$
declare e public.recruitment_events;t public.event_participation;has_sessions boolean;begin
 if not exists(select 1 from public.admin_users where user_id=auth.uid())then return 'forbidden';end if;
 if p_confirmation is null or p_confirmation not in ('unconfirmed','confirmed','cancelled')or p_attendance is null or p_attendance not in ('unrecorded','attended','absent','no_show')or p_note is null or length(p_note)>2000 then return 'invalid';end if;
 select * into e from public.recruitment_events where slug=p_slug for update;if not found then return 'missing';end if;
 select * into t from public.event_participation where event_id=e.id and source=p_source and application_id=p_application;if not found then return 'missing';end if;
 if p_revision is distinct from t.revision then return 'conflict';end if;
 select exists(select 1 from public.event_sessions where event_id=e.id)into has_sessions;
 if has_sessions and p_attendance<>t.attendance then return 'sessions';end if;
 if p_attendance<>'unrecorded' and p_confirmation<>'confirmed'then return 'confirmation';end if;
 if not has_sessions and p_attendance<>'unrecorded' and not e.is_test and (e.starts_at is null or e.starts_at>clock_timestamp())then return 'future';end if;
 update public.event_participation set confirmation=p_confirmation,attendance=p_attendance,legacy_attendance=case when has_sessions then legacy_attendance else p_attendance end,note=p_note,revision=revision+1,updated_at=clock_timestamp(),updated_by=auth.uid()where source=p_source and application_id=p_application;
 insert into public.event_participation_audit(event_id,source,application_id,actor,previous,current_value)values(e.id,p_source,p_application,auth.uid(),to_jsonb(t),jsonb_build_object('confirmation',p_confirmation,'attendance',p_attendance));
 return 'saved';end $$;
create view public.event_person_session_totals with(security_invoker=true)as
 select p.id,count(a.session_id)filter(where a.attendance='attended' and not e.is_test)as session_count,
 count(a.session_id)filter(where a.attendance='attended' and e.is_test)as test_session_count,
 max(s.session_date)filter(where a.attendance='attended' and not e.is_test)as last_attended_date
 from public.event_people p left join public.event_participation t on t.person_id=p.id left join public.event_session_attendance a on a.source=t.source and a.application_id=t.application_id
 left join public.event_sessions s on s.id=a.session_id left join public.recruitment_events e on e.id=a.event_id group by p.id;
revoke all on public.event_person_session_totals from public,anon;grant select on public.event_person_session_totals to authenticated;
revoke all on function public.manage_event_session(text,uuid,integer,date,text),public.record_session_attendance(text,uuid,text,uuid,integer,integer,text)from public,anon,authenticated;
grant execute on function public.manage_event_session(text,uuid,integer,date,text),public.record_session_attendance(text,uuid,text,uuid,integer,integer,text)to authenticated;
create view public.event_person_session_history with(security_invoker=true)as
 select t.person_id,a.source,a.application_id,a.session_id,a.attendance,s.session_date,s.title as session_title,e.slug as event_slug,e.title as event_title,e.is_test
 from public.event_session_attendance a join public.event_participation t on t.source=a.source and t.application_id=a.application_id
 join public.event_sessions s on s.id=a.session_id join public.recruitment_events e on e.id=a.event_id;
revoke all on public.event_person_session_history from public,anon;grant select on public.event_person_session_history to authenticated;
create view public.event_person_overview with(security_invoker=true)as
 select p.*,s.session_count,s.test_session_count,s.last_attended_date from public.event_person_totals p join public.event_person_session_totals s on s.id=p.id;
revoke all on public.event_person_overview from public,anon;grant select on public.event_person_overview to authenticated;
commit;
