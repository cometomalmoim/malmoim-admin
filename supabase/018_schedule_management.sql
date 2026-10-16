-- Apply after 017. Does not publish events or enable applications.
begin;
create table public.admin_profiles (
 user_id uuid primary key references public.admin_users(user_id) on delete cascade,
 display_name text not null check(length(btrim(display_name)) between 1 and 100)
);
insert into public.admin_profiles select user_id, '운영진 '||left(user_id::text,8) from public.admin_users;
create function public.schedule_admin_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into public.admin_profiles values(new.user_id,'운영진 '||left(new.user_id::text,8)); return new; end $$;
create trigger schedule_admin_profile after insert on public.admin_users for each row execute function public.schedule_admin_profile();
create table public.schedule_tags (
 id uuid primary key default gen_random_uuid(), name text not null check(length(btrim(name)) between 1 and 30),
 color text not null check(color ~ '^#[0-9A-Fa-f]{6}$'), system_key text unique,
 sort_order integer not null default 0, version integer not null default 1,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index schedule_tag_name on public.schedule_tags(lower(btrim(name)));
insert into public.schedule_tags(name,color,system_key,sort_order) values ('회의','#22C55E','meeting',0),('행사','#EAB308','event',1),('정기 모임','#38BDF8','regular_meeting',2);
create table public.schedules (
 id uuid primary key default gen_random_uuid(), title text not null check(length(btrim(title)) between 1 and 150),
 start_date date not null,end_date date not null, check(end_date>=start_date),
 tag_id uuid not null references public.schedule_tags(id) on delete restrict,
 assignee_id uuid references public.admin_profiles(user_id) on delete set null,
 notes text not null default '' check(length(notes)<=5000),
 source_kind text not null default 'manual' check(source_kind in ('manual','event','recruitment')),
 event_id uuid references public.recruitment_events(id) on delete cascade,
 check((source_kind='manual' and event_id is null) or (source_kind<>'manual' and event_id is not null)),
 hidden_at timestamptz, version integer not null default 1,
 created_by uuid references auth.users(id) on delete set null, updated_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(event_id,source_kind)
);
create index schedules_dates on public.schedules(start_date,end_date);
create index schedules_tag on public.schedules(tag_id);
create index schedules_assignee on public.schedules(assignee_id);
alter table public.admin_profiles enable row level security;
alter table public.admin_profiles force row level security;
alter table public.schedule_tags enable row level security;
alter table public.schedule_tags force row level security;
alter table public.schedules enable row level security;
alter table public.schedules force row level security;
revoke all on public.admin_profiles,public.schedule_tags,public.schedules from public,anon,authenticated;
grant select on public.admin_profiles,public.schedule_tags,public.schedules to authenticated;
grant update(display_name) on public.admin_profiles to authenticated;
create policy schedule_profiles_read on public.admin_profiles for select to authenticated using(exists(select 1 from public.admin_users where user_id=(select auth.uid())));
create policy schedule_profiles_edit on public.admin_profiles for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy schedule_tags_read on public.schedule_tags for select to authenticated using(exists(select 1 from public.admin_users where user_id=(select auth.uid())));
create policy schedules_read on public.schedules for select to authenticated using(exists(select 1 from public.admin_users where user_id=(select auth.uid())));
-- Mutations are RPC-only: callers cannot forge source, author, or version fields.
create function public.save_schedule(p_id uuid,p_version integer,p_input jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare r public.schedules; result_id uuid;
begin
 if not exists(select 1 from public.admin_users where user_id=auth.uid()) then raise exception 'Forbidden'; end if;
 perform pg_catalog.pg_advisory_xact_lock(1818001);
 if p_id is null then
  insert into public.schedules(title,start_date,end_date,tag_id,assignee_id,notes,created_by,updated_by)
  values(btrim(p_input->>'title'),(p_input->>'start_date')::date,(p_input->>'end_date')::date,(p_input->>'tag_id')::uuid,nullif(p_input->>'assignee_id','')::uuid,coalesce(p_input->>'notes',''),auth.uid(),auth.uid()) returning id into result_id;
 else
  select * into r from public.schedules where id=p_id for update;
  if not found or r.version<>p_version then raise exception 'Stale schedule'; end if;
  if r.source_kind<>'manual' and (r.title is distinct from p_input->>'title' or r.start_date is distinct from (p_input->>'start_date')::date or r.end_date is distinct from (p_input->>'end_date')::date) then raise exception 'Edit source event'; end if;
  update public.schedules set title=btrim(p_input->>'title'),start_date=(p_input->>'start_date')::date,end_date=(p_input->>'end_date')::date,tag_id=(p_input->>'tag_id')::uuid,assignee_id=nullif(p_input->>'assignee_id','')::uuid,notes=coalesce(p_input->>'notes',''),version=version+1,updated_by=auth.uid(),updated_at=now() where id=p_id;
  result_id:=p_id;
 end if;
 return result_id;
end $$;
create function public.delete_schedule(p_id uuid,p_version integer) returns void language plpgsql security definer set search_path='' as $$
declare r public.schedules;
begin
 if not exists(select 1 from public.admin_users where user_id=auth.uid()) then raise exception 'Forbidden'; end if;
 perform pg_catalog.pg_advisory_xact_lock(1818001);
 select * into r from public.schedules where id=p_id for update;
 if not found or r.version<>p_version then raise exception 'Stale schedule'; end if;
 if r.source_kind='manual' then delete from public.schedules where id=p_id;
 else update public.schedules set hidden_at=now(),version=version+1,updated_by=auth.uid(),updated_at=now() where id=p_id; end if;
end $$;
create function public.manage_schedule_tag(p_id uuid,p_version integer,p_name text,p_color text,p_delete boolean,p_replacement uuid) returns void language plpgsql security definer set search_path='' as $$
declare r public.schedule_tags;
begin
 if not exists(select 1 from public.admin_users where user_id=auth.uid()) then raise exception 'Forbidden'; end if;
 -- Serialize tag changes with sync, preventing delete/insert races.
 perform pg_catalog.pg_advisory_xact_lock(1818001);
 if p_id is null then
  if p_delete then raise exception 'Missing tag'; end if;
  insert into public.schedule_tags(name,color) values(btrim(p_name),p_color); return;
 end if;
 select * into r from public.schedule_tags where id=p_id for update;
 if not found or r.version<>p_version then raise exception 'Stale tag'; end if;
 if not p_delete then update public.schedule_tags set name=btrim(p_name),color=p_color,version=version+1,updated_at=now() where id=p_id; return; end if;
 if exists(select 1 from public.schedules where tag_id=p_id) or r.system_key is not null then
  if p_replacement is null or p_replacement=p_id or not exists(select 1 from public.schedule_tags where id=p_replacement) then raise exception 'Replacement required'; end if;
  if r.system_key is not null and exists(select 1 from public.schedule_tags where id=p_replacement and system_key is not null) then raise exception 'Choose custom replacement tag'; end if;
  update public.schedules set tag_id=p_replacement,version=version+1,updated_at=now(),updated_by=auth.uid() where tag_id=p_id;
 end if;
 delete from public.schedule_tags where id=p_id;
 if r.system_key is not null then update public.schedule_tags set system_key=r.system_key,version=version+1,updated_at=now() where id=p_replacement; end if;
end $$;
create function public.sync_event_schedule() returns trigger language plpgsql security definer set search_path='' as $$
declare tag uuid; kind text; start_time timestamptz; end_time timestamptz;
begin
 perform pg_catalog.pg_advisory_xact_lock(1818001);
 select id into tag from public.schedule_tags where system_key='event';
 foreach kind in array array['event','recruitment'] loop
  if kind='event' then start_time:=new.starts_at; end_time:=new.ends_at; else start_time:=new.opens_at; end_time:=new.closes_at; end if;
  if new.is_test or start_time is null or end_time is null then delete from public.schedules where event_id=new.id and source_kind=kind;
  else
   insert into public.schedules(title,start_date,end_date,tag_id,source_kind,event_id)
   values(left(case when kind='recruitment' then '[모집] ' else '' end||new.title,150),(start_time at time zone 'Asia/Seoul')::date,((end_time-interval '1 microsecond') at time zone 'Asia/Seoul')::date,tag,kind,new.id)
   on conflict(event_id,source_kind) do update set title=excluded.title,start_date=excluded.start_date,end_date=excluded.end_date,version=public.schedules.version+1,updated_at=now();
  end if;
 end loop;
 return new;
end $$;
create trigger sync_event_schedule after insert or update of title,starts_at,ends_at,opens_at,closes_at,is_test on public.recruitment_events for each row execute function public.sync_event_schedule();
-- Backfill through the same trigger, preserving event fields and publication state.
update public.recruitment_events set title=title;
revoke all on function public.schedule_admin_profile(),public.sync_event_schedule(),public.save_schedule(uuid,integer,jsonb),public.delete_schedule(uuid,integer),public.manage_schedule_tag(uuid,integer,text,text,boolean,uuid) from public,anon,authenticated;
grant execute on function public.save_schedule(uuid,integer,jsonb),public.delete_schedule(uuid,integer),public.manage_schedule_tag(uuid,integer,text,text,boolean,uuid) to authenticated;
-- Private broadcast signals contain no event/person data. Clients refresh through RLS.
create function public.schedule_changed() returns trigger language plpgsql security definer set search_path='' as $$
begin perform realtime.send('{"refresh":true}'::jsonb,'changed','admin-schedule',true); return null; end $$;
create trigger schedules_changed after insert or update or delete on public.schedules for each statement execute function public.schedule_changed();
create trigger schedule_tags_changed after insert or update or delete on public.schedule_tags for each statement execute function public.schedule_changed();
create policy schedule_broadcast_read on realtime.messages for select to authenticated using(realtime.topic()='admin-schedule' and exists(select 1 from public.admin_users where user_id=(select auth.uid())));
revoke all on function public.schedule_changed() from public,anon,authenticated;
commit;
