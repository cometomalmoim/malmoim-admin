-- All fixture changes roll back; no actual Halloween response is created.
begin;
update public.recruitment_events set capacity=1 where slug='event-ade6a5a7-83c2-477b-94f0-a22444a785c3';
do $$ declare admin_id uuid; begin select user_id into admin_id from public.admin_users limit 1; perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'role','authenticated')::text,true); end $$;
set local role authenticated;
do $$ begin
 if public.submit_event_registration('event-ade6a5a7-83c2-477b-94f0-a22444a785c3','33333333-3333-4333-8333-333333333333','[가상] 정원','+821000000003','new','',true,'synthetic-test-v1',true,false)<>'full' then raise exception 'Capacity check failed';end if;
end $$;
reset role;
update public.recruitment_events set registration_enabled=true,applications_open=true,status='published',opens_at=clock_timestamp()-interval '1 hour',closes_at=clock_timestamp()+interval '1 hour',privacy_notice='가상 테스트 안내',privacy_notice_version='test-only' where slug='halloween-2026';
set local role anon;
do $$ begin
 if not (public.event_registration_info('halloween-2026')->>'open')::boolean then raise exception 'Valid window failed';end if;
end $$;
reset role;
update public.recruitment_events set opens_at=clock_timestamp()+interval '10 minutes' where slug='halloween-2026';
set local role anon;
do $$ begin if (public.event_registration_info('halloween-2026')->>'open')::boolean then raise exception 'Before opening failed';end if; end $$;
reset role;
update public.recruitment_events set opens_at=clock_timestamp()-interval '1 day',closes_at=clock_timestamp()-interval '1 minute' where slug='halloween-2026';
set local role anon;
do $$ begin
 if public.submit_event_registration('halloween-2026','44444444-4444-4444-8444-444444444444','[가상] 마감','+821000000004','new','',true,'test-only',false,false)<>'closed' then raise exception 'Deadline submit failed';end if;
end $$;
reset role;
rollback;
select 'PASS: capacity, valid window, before opening, submission after deadline; all fixture changes rolled back' as verification;
