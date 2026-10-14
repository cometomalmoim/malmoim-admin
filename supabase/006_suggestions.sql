-- Review first. Adds only the internal staff suggestions table, indexes, trigger, grants and RLS policies.
-- Requires the existing public.admin_users table. Does not alter or remove existing objects.
begin;

create table public.suggestions (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 150),
  content text not null check (char_length(btrim(content)) between 1 and 10000),
  is_anonymous boolean not null,
  public_name text,
  status text not null default 'received' check (status in ('received', 'reviewing', 'completed')),
  staff_feedback text not null default '' check (char_length(staff_feedback) <= 10000),
  resolution text not null default '' check (char_length(resolution) <= 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_modified_by text,
  last_modified_at timestamptz,
  constraint suggestions_anonymous_has_no_name check (
    (is_anonymous and public_name is null)
    or (not is_anonymous and public_name is not null and char_length(btrim(public_name)) between 1 and 100)
  ),
  constraint suggestions_completed_requires_resolution check (
    status <> 'completed' or char_length(btrim(resolution)) > 0
  )
);

create index suggestions_created_idx on public.suggestions (created_at desc, id desc);
create index suggestions_status_created_idx on public.suggestions (status, created_at desc, id desc);

create function public.suggestions_protect_identity_and_track_staff()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if old.is_anonymous is distinct from new.is_anonymous
      or old.public_name is distinct from new.public_name then
      raise exception 'suggestion_author_visibility_immutable';
    end if;
    new.id := old.id;
    new.created_at := old.created_at;
    new.last_modified_by := coalesce((select auth.jwt() ->> 'email'), '운영진');
    new.last_modified_at := pg_catalog.now();
  else
    -- Do not associate an anonymous suggestion with the administrator who entered it.
    new.last_modified_by := null;
    new.last_modified_at := null;
    new.updated_at := pg_catalog.now();
  end if;
  if tg_op = 'UPDATE' then
    new.updated_at := pg_catalog.now();
  end if;
  return new;
end;
$$;

create trigger suggestions_protect_identity_and_track_staff
before insert or update on public.suggestions
for each row execute function public.suggestions_protect_identity_and_track_staff();
revoke all on function public.suggestions_protect_identity_and_track_staff() from public, anon, authenticated;

alter table public.suggestions enable row level security;
alter table public.suggestions force row level security;
revoke all on public.suggestions from public, anon, authenticated;
grant select on public.suggestions to authenticated;
grant insert (title, content, is_anonymous, public_name) on public.suggestions to authenticated;
grant update (staff_feedback, resolution, status) on public.suggestions to authenticated;

create policy suggestions_admin_select on public.suggestions
for select to authenticated
using (exists (select 1 from public.admin_users where user_id = (select auth.uid())));

create policy suggestions_admin_insert on public.suggestions
for insert to authenticated
with check (exists (select 1 from public.admin_users where user_id = (select auth.uid())));

create policy suggestions_admin_update on public.suggestions
for update to authenticated
using (exists (select 1 from public.admin_users where user_id = (select auth.uid())))
with check (exists (select 1 from public.admin_users where user_id = (select auth.uid())));

-- There is deliberately no anon grant, DELETE grant, or public submission route.
commit;
