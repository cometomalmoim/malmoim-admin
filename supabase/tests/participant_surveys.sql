-- Synthetic, rollback-only checks for supabase/028_participant_surveys.sql.
-- Run only in a disposable Supabase test project after applying the migration.
begin;
insert into auth.users(id) values
  ('00000000-0000-4000-a000-000000000981'),
  ('00000000-0000-4000-a000-000000000982');
insert into public.admin_users(user_id) values ('00000000-0000-4000-a000-000000000981');
insert into public.participant_surveys(id,cohort_name,public_token,status,opens_at,closes_at)
values('00000000-0000-4000-a000-000000000983','[가상] 테스트 기수','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','open',clock_timestamp()-interval '1 day',clock_timestamp()+interval '7 days');

set local role anon;
do $$ begin
  if has_table_privilege(current_user,'public.participant_survey_responses','SELECT') then raise exception 'Anonymous response SELECT grant'; end if;
  if has_table_privilege(current_user,'public.participant_survey_responses','INSERT') then raise exception 'Anonymous direct response INSERT grant'; end if;
  if public.participant_survey_public_state('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')->>'state'<>'open' then raise exception 'Open survey state lookup failed'; end if;
  if public.submit_participant_survey('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','korean',5,array['none','language_growth'],'','','')<>'invalid' then raise exception 'Exclusive none validation failed'; end if;
  if public.submit_participant_survey('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','korean',5,array['language_growth'],'','','')<>'saved' then raise exception 'Anonymous response submission failed'; end if;
  if public.submit_participant_survey('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','korean',6,array['language_growth'],'','','')<>'invalid' then raise exception 'Satisfaction range validation failed'; end if;
end $$;
reset role;

select set_config('request.jwt.claim.sub','00000000-0000-4000-a000-000000000982',true);
set local role authenticated;
do $$ begin
  if exists(select 1 from public.participant_survey_responses) then raise exception 'Non-admin response read'; end if;
end $$;
reset role;

select set_config('request.jwt.claim.sub','00000000-0000-4000-a000-000000000981',true);
set local role authenticated;
do $$ begin
  if (select count(*) from public.participant_survey_responses where survey_id='00000000-0000-4000-a000-000000000983')<>1 then raise exception 'Admin response read failed'; end if;
  if (public.admin_participant_survey_stats('00000000-0000-4000-a000-000000000983')->>'total')::integer<>1 then raise exception 'Admin statistics failed'; end if;
end $$;
reset role;

update public.participant_surveys set status='closed' where id='00000000-0000-4000-a000-000000000983';
set local role anon;
do $$ begin
  if public.participant_survey_public_state('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')->>'state'<>'closed' then raise exception 'Closed survey state lookup failed'; end if;
  if public.submit_participant_survey('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','korean',5,array['language_growth'],'','','')<>'closed' then raise exception 'Closed survey accepted a response'; end if;
end $$;
reset role;
rollback;
select 'PASS: anon submit only, validation, admin-only results, statistics, close enforcement' as verification;
