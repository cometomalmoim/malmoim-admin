-- Run this entire file in Supabase SQL Editor first.
-- No administrator is automatically registered.
begin;
create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;
alter table public.admin_users force row level security;
revoke all on table public.admin_users from public, anon, authenticated;
grant select on table public.admin_users to authenticated;
create policy "Users can read only their own administrator registration"
on public.admin_users for select to authenticated
using ((select auth.uid()) = user_id);
-- No INSERT / UPDATE / DELETE policies or privileges for app users.
commit;