-- Run only in a disposable Supabase test project after 006_suggestions.sql.
-- All fixtures roll back. Never run against production.
begin;
insert into auth.users(id) values
  ('00000000-0000-4000-a000-000000000921'),
  ('00000000-0000-4000-a000-000000000922');
insert into public.admin_users(user_id) values ('00000000-0000-4000-a000-000000000921');

set local role anon;
do $$ begin
  if has_table_privilege(current_user, 'public.suggestions', 'SELECT') then raise exception 'FAIL: anon SELECT privilege'; end if;
  if has_table_privilege(current_user, 'public.suggestions', 'INSERT') then raise exception 'FAIL: anon INSERT privilege'; end if;
end $$;
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-a000-000000000922', true);
set local role authenticated;
do $$ begin
  if exists(select 1 from public.suggestions) then raise exception 'FAIL: non-admin can read suggestions'; end if;
  begin
    insert into public.suggestions(title, content, is_anonymous, public_name)
    values ('test member', 'not allowed', true, null);
    raise exception 'FAIL: non-admin insert unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-a000-000000000921', true);
set local role authenticated;
do $$ begin
  insert into public.suggestions(title, content, is_anonymous, public_name)
  values ('anonymous fixture', 'test-only body', true, null);
  if not exists(select 1 from public.suggestions where title = 'anonymous fixture' and is_anonymous and public_name is null) then
    raise exception 'FAIL: administrator anonymous create';
  end if;
  begin
    update public.suggestions set is_anonymous = false, public_name = 'fixture name' where title = 'anonymous fixture';
    raise exception 'FAIL: anonymous visibility columns unexpectedly mutable';
  exception when insufficient_privilege or raise_exception then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
  begin
    update public.suggestions set status = 'completed' where title = 'anonymous fixture';
    raise exception 'FAIL: completed without resolution unexpectedly succeeded';
  exception when check_violation or raise_exception then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
  update public.suggestions set staff_feedback = 'Reviewed' where title = 'anonymous fixture';
  if (select status from public.suggestions where title = 'anonymous fixture') <> 'received' then
    raise exception 'FAIL: feedback changed status';
  end if;
  update public.suggestions set resolution = 'Action taken' where title = 'anonymous fixture';
  if (select status from public.suggestions where title = 'anonymous fixture') <> 'received' then
    raise exception 'FAIL: resolution changed status';
  end if;
  update public.suggestions set status = 'completed' where title = 'anonymous fixture';
end $$;
reset role;
rollback;
