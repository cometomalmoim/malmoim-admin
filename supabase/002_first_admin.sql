-- Run AFTER 001_admin_users.sql in Supabase SQL Editor.
-- Replace YOUR_AUTH_USER_UUID_HERE with the UUID from Authentication > Users.
-- Use the auth.users ID, not an email, project ID, or API key.
insert into public.admin_users (user_id)
values ('YOUR_AUTH_USER_UUID_HERE'::uuid)
on conflict (user_id) do nothing;
