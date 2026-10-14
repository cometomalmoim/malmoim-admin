-- 검토용. SQL Editor에서 승인 후 실행. 기존 데이터/버킷을 덮어쓰지 않습니다.
begin;
create table public.resources (
 id uuid primary key default gen_random_uuid(),
 title text not null check(char_length(title) between 1 and 150),
 kind text not null check(kind in ('english','korean','common')),
 event_id uuid references public.recruitment_events(id) on delete restrict,
 season integer check(season > 0), session_number integer check(session_number > 0), cumulative_week integer check(cumulative_week > 0),
 topic text not null default '' check(char_length(topic)<=200),
 description text not null default '' check(char_length(description)<=5000),
 external_url text not null default '' check(external_url='' or external_url ~ '^https?://'),
 author_id uuid not null references auth.users(id), author_email text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.resource_files (
 id uuid primary key default gen_random_uuid(), resource_id uuid not null references public.resources(id) on delete restrict,
 original_name text not null check(char_length(original_name) between 1 and 200),
 size_bytes integer not null check(size_bytes between 1 and 3145728),
 state text not null default 'pending' check(state in ('pending','ready')),
 created_at timestamptz not null default now()
);
create index resources_event_date on public.resources(event_id,created_at desc,id);
create index resource_files_parent on public.resource_files(resource_id);
create function public.resources_identity() returns trigger language plpgsql set search_path='' as $$
begin
 if TG_OP='INSERT' then
  new.author_id := auth.uid(); new.author_email := coalesce(auth.jwt()->>'email','');
 else
  new.author_id := old.author_id; new.author_email := old.author_email; new.created_at := old.created_at; new.id := old.id;
 end if;
 new.updated_at := now(); return new;
end $$;
create trigger resources_identity before insert or update on public.resources for each row execute function public.resources_identity();
create function public.resource_file_limit() returns trigger language plpgsql set search_path='' as $$
begin
 perform 1 from public.resources where id=new.resource_id for update;
 if (select count(*) from public.resource_files where resource_id=new.resource_id)>=5 then raise exception 'resource_file_limit'; end if;
 return new;
end $$;
create trigger resource_file_limit before insert on public.resource_files for each row execute function public.resource_file_limit();
alter table public.resources enable row level security;
alter table public.resources force row level security;
alter table public.resource_files enable row level security;
alter table public.resource_files force row level security;
revoke all on public.resources, public.resource_files from public,anon,authenticated;
grant select,insert,update,delete on public.resources,public.resource_files to authenticated;
create policy resources_admin on public.resources for all to authenticated using(exists(select 1 from public.admin_users where user_id=auth.uid())) with check(exists(select 1 from public.admin_users where user_id=auth.uid()));
create policy resource_files_admin on public.resource_files for all to authenticated using(exists(select 1 from public.admin_users where user_id=auth.uid())) with check(exists(select 1 from public.admin_users where user_id=auth.uid()));
-- 같은 이름의 기존 버킷이 있으면 전체 적용을 중단합니다.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('admin-resources','admin-resources',false,3145728,array['application/pdf']);
create policy resource_storage_read on storage.objects for select to authenticated using(bucket_id='admin-resources' and exists(select 1 from public.admin_users where user_id=auth.uid()));
create policy resource_storage_upload on storage.objects for insert to authenticated with check(bucket_id='admin-resources' and exists(select 1 from public.admin_users where user_id=auth.uid()) and exists(select 1 from public.resource_files f where name=f.resource_id::text||'/'||f.id::text||'.pdf' and f.state='pending'));
create policy resource_storage_delete on storage.objects for delete to authenticated using(bucket_id='admin-resources' and exists(select 1 from public.admin_users where user_id=auth.uid()));
commit;
