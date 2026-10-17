-- Apply after 018. Private operational profiles, separate from login accounts.
begin;
create table public.people (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(btrim(name)) between 1 and 100),
 generation text not null default '' check(length(generation)<=40),
 role text not null default '' check(length(role)<=100),
 education text not null default '' check(length(education)<=300),
 phone text not null default '' check(length(phone)<=50),
 email text not null default '' check(length(email)<=254),
 instagram text not null default '' check(length(instagram)<=500 and (instagram='' or instagram ~ '^https://(www\.)?instagram\.com/')),
 photo_url text not null default '' check(length(photo_url)<=2000 and (photo_url='' or photo_url ~ '^https://')),
 bio text not null default '' check(length(bio)<=5000),
 tmi text not null default '' check(length(tmi)<=5000),
 status text not null default 'active' check(status in ('active','inactive')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index people_status_name on public.people(status,name);
create table public.people_events (
 person_id uuid not null references public.people(id) on delete cascade,
 event_id uuid not null references public.recruitment_events(id) on delete cascade,
 primary key(person_id,event_id)
);
create index people_events_event on public.people_events(event_id);
create table public.people_resources (
 person_id uuid not null references public.people(id) on delete cascade,
 resource_id uuid not null references public.resources(id) on delete cascade,
 primary key(person_id,resource_id)
);
create index people_resources_resource on public.people_resources(resource_id);
alter table public.people enable row level security;
alter table public.people force row level security;
alter table public.people_events enable row level security;
alter table public.people_events force row level security;
alter table public.people_resources enable row level security;
alter table public.people_resources force row level security;
revoke all on public.people,public.people_events,public.people_resources from public,anon,authenticated;
grant select on public.people,public.people_events,public.people_resources to authenticated;
create policy people_admin_read on public.people for select to authenticated using(exists(select 1 from public.admin_users where user_id=(select auth.uid())));
create policy people_events_admin_read on public.people_events for select to authenticated using(exists(select 1 from public.admin_users where user_id=(select auth.uid())));
create policy people_resources_admin_read on public.people_resources for select to authenticated using(exists(select 1 from public.admin_users where user_id=(select auth.uid())));
-- All mutations go through one transaction with a row lock and stale-write check.
create function public.manage_person(p_kind text,p_id uuid,p_updated_at timestamptz,p_input jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare current_row public.people; result_id uuid;
begin
 if not exists(select 1 from public.admin_users where user_id=auth.uid()) then raise exception 'Forbidden'; end if;
 if p_kind not in ('save','active','inactive','delete') or p_kind is null then raise exception 'Invalid operation'; end if;
 if p_id is not null then
  select * into current_row from public.people where id=p_id for update;
  if not found or current_row.updated_at is distinct from p_updated_at then raise exception 'Stale profile'; end if;
 elsif p_kind<>'save' then raise exception 'Missing profile';
 end if;
 if p_kind='delete' then delete from public.people where id=p_id; return p_id; end if;
 if p_kind in ('active','inactive') then
  update public.people set status=p_kind,updated_at=clock_timestamp() where id=p_id; return p_id;
 end if;
 if jsonb_array_length(p_input->'event_ids')>200 or jsonb_array_length(p_input->'resource_ids')>200 then raise exception 'Too many links'; end if;
 result_id:=coalesce(p_id,gen_random_uuid());
 insert into public.people(id,name,generation,role,education,phone,email,instagram,photo_url,bio,tmi)
 values(result_id,btrim(p_input->>'name'),p_input->>'generation',p_input->>'role',p_input->>'education',p_input->>'phone',p_input->>'email',p_input->>'instagram',p_input->>'photo_url',p_input->>'bio',p_input->>'tmi')
 on conflict(id) do update set name=excluded.name,generation=excluded.generation,role=excluded.role,education=excluded.education,phone=excluded.phone,email=excluded.email,instagram=excluded.instagram,photo_url=excluded.photo_url,bio=excluded.bio,tmi=excluded.tmi,updated_at=clock_timestamp();
 delete from public.people_events where person_id=result_id;
 insert into public.people_events select result_id,value::uuid from jsonb_array_elements_text(p_input->'event_ids');
 delete from public.people_resources where person_id=result_id;
 insert into public.people_resources select result_id,value::uuid from jsonb_array_elements_text(p_input->'resource_ids');
 return result_id;
end $$;
revoke all on function public.manage_person(text,uuid,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.manage_person(text,uuid,timestamptz,jsonb) to authenticated;
commit;
