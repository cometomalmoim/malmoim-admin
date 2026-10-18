-- Adds administrator-only edit and delete privileges to the existing suggestions table.
-- Requires supabase/006_suggestions.sql to have been applied.
begin;

grant update (title, content) on public.suggestions to authenticated;
grant delete on public.suggestions to authenticated;

create policy suggestions_admin_delete on public.suggestions
for delete to authenticated
using (exists (select 1 from public.admin_users where user_id = (select auth.uid())));

commit;
