-- Run only in a test Supabase project AFTER 003. All fixtures roll back.
-- Do not run against production. No real applicant records are printed.
begin;
insert into auth.users(id) values ('00000000-0000-4000-a000-000000000901'),('00000000-0000-4000-a000-000000000902');
insert into public.admin_users(user_id) values ('00000000-0000-4000-a000-000000000901');
insert into public.recruitment_events(id,slug,title,closes_at) values ('00000000-0000-4000-a000-000000000903','test-access-fixture','가상 테스트 이벤트','2026-10-31T15:00:00Z');
insert into public.event_applications(id,event_id,submission_id,name,contact,contact_type,preferred_class,privacy_notice_version,privacy_consent,fee_policy_confirmed)
values ('00000000-0000-4000-a000-000000000904','00000000-0000-4000-a000-000000000903','00000000-0000-4000-a000-000000000905','가상 신청자','test-account','instagram','thursday','test-only',true,true);
set local role anon;
do $$ begin
  if has_table_privilege(current_user,'public.event_applications','SELECT') then raise exception 'FAIL: anon SELECT'; end if;
  if has_table_privilege(current_user,'public.event_applications','INSERT') then raise exception 'FAIL: anon INSERT'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-4000-a000-000000000902',true);
set local role authenticated;
do $$ begin
  if exists(select 1 from public.event_applications where id='00000000-0000-4000-a000-000000000904') then raise exception 'FAIL: member read'; end if;
  if has_table_privilege(current_user,'public.event_applications','INSERT') or has_table_privilege(current_user,'public.event_applications','UPDATE') or has_table_privilege(current_user,'public.event_applications','DELETE') then raise exception 'FAIL: write privilege'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-4000-a000-000000000901',true);
set local role authenticated;
do $$ begin
  if not exists(select 1 from public.event_applications where id='00000000-0000-4000-a000-000000000904') then raise exception 'FAIL: administrator read'; end if;
end $$;
reset role;
rollback;
