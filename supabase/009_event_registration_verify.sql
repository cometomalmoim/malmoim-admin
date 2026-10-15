-- Synthetic data only; retains one explicitly labelled response on the existing test event.
begin;
do $$ declare admin_id uuid; begin
 select user_id into admin_id from public.admin_users limit 1;
 if admin_id is null then raise exception 'Administrator required'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'role','authenticated')::text,true);
end $$;
set local role authenticated;
do $$ declare v_slug text:='event-ade6a5a7-83c2-477b-94f0-a22444a785c3'; result text; begin
 result:=public.submit_event_registration(v_slug,'11111111-1111-4111-8111-111111111111','[가상] 신청 연결 검증','01000000000','returning','가상 활동',true,'synthetic-test-v1',true,false);
 if result<>'saved' then raise exception 'Save failed: %',result;end if;
 result:=public.submit_event_registration(v_slug,'11111111-1111-4111-8111-111111111111','[가상] 신청 연결 검증','+821000000000','returning','가상 활동',true,'synthetic-test-v1',true,false);
 if result<>'saved' then raise exception 'Idempotency failed';end if;
 result:=public.submit_event_registration(v_slug,'22222222-2222-4222-8222-222222222222','[가상] 중복','+821000000000','new','',true,'synthetic-test-v1',true,false);
 if result<>'duplicate' then raise exception 'Duplicate guard failed';end if;
 result:=public.submit_event_registration(v_slug,'22222222-2222-4222-8222-222222222222','[가상] 미동의','+821000000001','new','',false,'synthetic-test-v1',true,false);
 if result<>'consent' then raise exception 'Consent guard failed';end if;
 result:=public.submit_event_registration('halloween-2026','22222222-2222-4222-8222-222222222222','[가상] 차단','+821000000001','new','',true,'synthetic-test-v1',true,false);
 if result<>'closed' then raise exception 'Test-event isolation failed';end if;
 if (select count(*) from public.event_application_list where event_id=(select id from public.recruitment_events where recruitment_events.slug=v_slug))<>1 then raise exception 'Unified list count failed'; end if;
 if not exists(select 1 from public.event_registration_responses where submission_id='11111111-1111-4111-8111-111111111111' and not marketing_consent and marketing_notice_snapshot is null)then raise exception 'Optional marketing failed';end if;
end $$;
reset role;
commit;
begin;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 if exists(select 1 from public.event_application_list) then raise exception 'Nonadmin data exposed';end if;
 if (public.event_registration_info('event-ade6a5a7-83c2-477b-94f0-a22444a785c3',true)->>'open')::boolean then raise exception 'Nonadmin test access';end if;
end $$;
reset role;
set local role anon;
do $$ begin
 if has_table_privilege('anon','public.event_registration_responses','SELECT') or has_table_privilege('anon','public.event_application_list','SELECT') then raise exception 'Anonymous read grant';end if;
 if (public.event_registration_info('halloween-2026',false)->>'open')::boolean then raise exception 'Public intake unexpectedly open';end if;
end $$;
reset role;
rollback;
select 'PASS: save, retry, duplicate, consent, event isolation, list count, optional marketing, nonadmin RLS, anonymous isolation, public closed' as verification;
