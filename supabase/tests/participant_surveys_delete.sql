-- Rollback-only check for supabase/029_participant_surveys_delete.sql.
-- Run only in a disposable Supabase test project after applying migrations 028 and 029.
begin;

insert into auth.users(id) values
  ('00000000-0000-4000-a000-000000000991'),
  ('00000000-0000-4000-a000-000000000992');
insert into public.admin_users(user_id) values ('00000000-0000-4000-a000-000000000991');
insert into public.participant_surveys(id, cohort_name, public_token, status, opens_at, closes_at)
values (
  '00000000-0000-4000-a000-000000000993',
  '[가상] 삭제 테스트 기수',
  'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  'closed',
  clock_timestamp() - interval '2 days',
  clock_timestamp() - interval '1 day'
);
insert into public.participant_survey_responses(survey_id, respondent_group, satisfaction, liked_aspects)
values ('00000000-0000-4000-a000-000000000993', 'korean', 4, array['language_growth']);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-a000-000000000992', true);
set local role authenticated;
do $$ begin
  if public.delete_participant_survey('00000000-0000-4000-a000-000000000993') <> 'forbidden' then
    raise exception 'Non-admin survey deletion was not rejected';
  end if;
  if (select count(*) from public.participant_surveys where id = '00000000-0000-4000-a000-000000000993') <> 0 then
    raise exception 'Non-admin can read survey row';
  end if;
end $$;
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-a000-000000000991', true);
set local role authenticated;
do $$ begin
  if public.delete_participant_survey('00000000-0000-4000-a000-000000000993') <> 'deleted' then
    raise exception 'Admin could not delete survey and responses';
  end if;
  if exists (select 1 from public.participant_surveys where id = '00000000-0000-4000-a000-000000000993') then
    raise exception 'Survey row remains after deletion';
  end if;
  if exists (select 1 from public.participant_survey_responses where survey_id = '00000000-0000-4000-a000-000000000993') then
    raise exception 'Anonymous response rows remain after deletion';
  end if;
end $$;
reset role;

rollback;
select 'PASS: admins delete a survey and its responses; non-admin deletion is rejected' as verification;
