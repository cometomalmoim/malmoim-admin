-- Adds administrator-only deletion of a cohort survey and its anonymous responses.
-- Requires supabase/028_participant_surveys.sql. Existing objects are preserved.
begin;

grant delete on public.participant_surveys, public.participant_survey_responses to authenticated;

create policy participant_surveys_admin_delete on public.participant_surveys
for delete to authenticated
using (exists (select 1 from public.admin_users where user_id = (select auth.uid())));

create policy participant_survey_responses_admin_delete on public.participant_survey_responses
for delete to authenticated
using (exists (select 1 from public.admin_users where user_id = (select auth.uid())));

-- SECURITY INVOKER keeps deletes subject to the caller's grants and RLS policies.
-- Delete response rows first because the existing foreign key uses ON DELETE RESTRICT.
create function public.delete_participant_survey(p_survey_id uuid)
returns text
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.admin_users where user_id = (select auth.uid())) then
    return 'forbidden';
  end if;

  delete from public.participant_survey_responses where survey_id = p_survey_id;
  delete from public.participant_surveys where id = p_survey_id;
  if not found then return 'not_found'; end if;

  return 'deleted';
end;
$$;

revoke all on function public.delete_participant_survey(uuid) from public, anon, authenticated;
grant execute on function public.delete_participant_survey(uuid) to authenticated;

commit;
