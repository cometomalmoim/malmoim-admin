-- ISOLATED LOCAL SUPABASE ONLY. Never run on production/shared staging.
-- Requires the review draft in a disposable database, executed as postgres.
-- Creates synthetic Auth UUIDs inside this transaction; always rolls back.
begin;
insert into auth.users(id) values
 ('10000000-0000-4000-8000-000000000001'),
 ('10000000-0000-4000-8000-000000000002');
insert into public.member_profiles(user_id,name,korean_proficiency,english_proficiency) values
 ('10000000-0000-4000-8000-000000000001','LOCAL TEST A','none','native'),
 ('10000000-0000-4000-8000-000000000002','LOCAL TEST B','native','none');
insert into public.member_languages(user_id,language_code,proficiency) values
 ('10000000-0000-4000-8000-000000000001','ja','basic'),
 ('10000000-0000-4000-8000-000000000002','zh','fluent');
set constraints all immediate;
do $$
begin
  begin
    insert into public.member_languages values ('10000000-0000-4000-8000-000000000001','ko','native');
    raise exception 'TEST FAILED: ko allowed';
  exception when check_violation then null; end;
  begin
    insert into public.member_languages values ('10000000-0000-4000-8000-000000000001','fr','none');
    raise exception 'TEST FAILED: foreign none allowed';
  exception when check_violation then null; end;
  begin
    insert into public.member_languages values ('10000000-0000-4000-8000-000000000001','ja','fluent');
    raise exception 'TEST FAILED: duplicate allowed';
  exception when unique_violation then null; end;
  -- Zero additional languages is valid. Restore one for the own-row RLS checks.
  delete from public.member_languages where user_id='10000000-0000-4000-8000-000000000001';
  insert into public.member_languages values ('10000000-0000-4000-8000-000000000001','ja','basic');
  begin
    insert into public.member_languages(user_id,language_code,proficiency)
    select '10000000-0000-4000-8000-000000000001',code,'basic'
    from unnest(array['fr','de','es']) code;
    raise exception 'TEST FAILED: four additional languages allowed';
  exception when check_violation then null; end;
  begin
    insert into public.member_languages values ('10000000-0000-4000-8000-000000000001','en','native');
    raise exception 'TEST FAILED: fixed English accepted as additional language';
  exception when check_violation then null; end;
  begin
    update public.member_profiles set english_proficiency='unknown'
      where user_id='10000000-0000-4000-8000-000000000001';
    raise exception 'TEST FAILED: unknown English proficiency accepted';
  exception when check_violation then null; end;
  begin
    update public.member_profiles set english_proficiency=null
      where user_id='10000000-0000-4000-8000-000000000001';
    raise exception 'TEST FAILED: missing English answer accepted';
  exception when not_null_violation then null; end;
  begin
    update public.member_profiles set korean_proficiency='unknown'
      where user_id='10000000-0000-4000-8000-000000000001';
    raise exception 'TEST FAILED: unknown Korean proficiency accepted';
  exception when check_violation then null; end;
  begin
    update public.member_profiles set user_id='10000000-0000-4000-8000-000000000003'
      where user_id='10000000-0000-4000-8000-000000000001';
    raise exception 'TEST FAILED: owner change allowed';
  exception when check_violation then null; end;
  begin
    update public.member_profiles set created_at=created_at - interval '1 day'
      where user_id='10000000-0000-4000-8000-000000000001';
    raise exception 'TEST FAILED: timestamp change allowed';
  exception when check_violation then null; end;
  begin
    insert into public.member_profiles(user_id,korean_proficiency,english_proficiency)
      values ('10000000-0000-4000-8000-000000000099','basic','none');
    raise exception 'TEST FAILED: missing Auth FK accepted';
  exception when foreign_key_violation then null; end;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
do $$
begin
  if (select count(*) from public.member_profiles) <> 1 or
     (select count(*) from public.member_languages) <> 1 then
    raise exception 'TEST FAILED: own-row SELECT policy';
  end if;
  if exists(select 1 from public.member_profiles where user_id='10000000-0000-4000-8000-000000000002') then
    raise exception 'TEST FAILED: another member visible';
  end if;
  begin
    update public.member_profiles set name='unauthorized';
    raise exception 'TEST FAILED: direct UPDATE allowed';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.member_languages;
    raise exception 'TEST FAILED: direct DELETE allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.member_languages values ('10000000-0000-4000-8000-000000000001','fr','fluent');
    raise exception 'TEST FAILED: direct INSERT allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform public.save_member_profile('{}','[]','unapproved');
    raise exception 'TEST FAILED: registration gate open';
  exception when insufficient_privilege then null; end;
end $$;
set local role anon;
do $$
begin
  begin
    perform 1 from public.member_profiles;
    raise exception 'TEST FAILED: anon can read profiles';
  exception when insufficient_privilege then null; end;
  begin
    perform public.save_member_profile('{}','[]','unapproved');
    raise exception 'TEST FAILED: anon can execute writer';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
