-- NOT executed automatically. Disposable test DB only, after 010,013,014,015.
-- Requires a test administrator. All fixtures and changes roll back.
begin;
do $$ declare a uuid; e uuid; slug text:='refund-test-'||gen_random_uuid(); begin
 select user_id into a from public.admin_users limit 1;
 if a is null then raise exception 'Test administrator required'; end if;
 insert into public.recruitment_events(slug,title) values(slug,'[가상] 환불 테스트') returning id into e;
 perform set_config('refund_test.slug',slug,true);
 perform set_config('refund_test.event',e::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
end $$;
set local role authenticated;
do $$ declare r jsonb; app uuid; ref uuid; rev integer; audit_count integer;
 slug text:=current_setting('refund_test.slug'); e uuid:=current_setting('refund_test.event')::uuid;
begin
 r:=public.manage_event_application(slug,'manual',null,0,'[가상] 환불','01000005555','phone',null,'','received','paid','','가상 접수');
 if r->>'code' is distinct from 'saved' then raise exception 'Applicant create failed: %',r; end if;
 app:=(r->>'id')::uuid;
 perform set_config('refund_test.app',app::text,true);
 if public.create_event_refund_request(slug,'manual',app,'미확인 금액',clock_timestamp())->>'code' is distinct from 'payment_amount_unknown' then raise exception 'Unknown amount accepted'; end if;
 if public.record_event_payment(slug,'manual',app,1,0)->>'code' is distinct from 'invalid' then raise exception 'Zero receipt accepted'; end if;
 r:=public.record_event_payment(slug,'manual',app,1,100);
 if r->>'code' is distinct from 'saved' then raise exception 'Actual receipt failed'; end if;
 if not exists(select 1 from public.event_application_list where id=app and source='manual' and paid_amount_krw=100 and paid_amount_recorded_by=auth.uid() and paid_amount_recorded_at is not null and revision=2) then raise exception 'Receipt readback failed'; end if;
 if public.record_event_payment(slug,'manual',app,1,100)->>'code' is distinct from 'conflict' then raise exception 'Stale receipt write allowed'; end if;
 if public.record_event_payment(slug,'manual',app,2,100)->>'code' is distinct from 'saved' then raise exception 'Same amount retry failed'; end if;
 if (select count(*) from public.event_application_audit where application_id=app and action='payment_amount_recorded')<>1 then raise exception 'Duplicate receipt audit'; end if;
 r:=public.create_event_refund_request(slug,'manual',app,'가상 거절 요청',clock_timestamp());
 if r->>'code' is distinct from 'saved' then raise exception 'Request failed'; end if;
 select id into ref from public.event_application_refunds where event_id=e and application_id=app;
 r:=public.update_event_refund(slug,ref,'reject');
 if r->>'code' is distinct from 'saved' or not exists(select 1 from public.event_application_refunds where id=ref and status='rejected' and decision_by=auth.uid() and decision_at is not null) then raise exception 'Reject enum/metadata failed'; end if;
 r:=public.create_event_refund_request(slug,'manual',app,'가상 재요청',clock_timestamp());
 if r->>'code' is distinct from 'saved' then raise exception 'Retry after rejection failed'; end if;
 select id into ref from public.event_application_refunds where event_id=e and application_id=app and status='requested';
 if public.create_event_refund_request(slug,'manual',app,'중복',clock_timestamp())->>'code' is distinct from 'duplicate' then raise exception 'Duplicate request allowed'; end if;
 if public.update_event_refund(slug,ref,'process',100,true)->>'code' is distinct from 'invalid_transition' then raise exception 'Unapproved completion allowed'; end if;
 r:=public.update_event_refund(slug,ref,'approve');
 if r->>'code' is distinct from 'saved' or not exists(select 1 from public.event_application_refunds where id=ref and status='approved') then raise exception 'Approve enum failed'; end if;
 if not exists(select 1 from public.event_application_list where id=app and source='manual' and payment_status='paid' and revision=2) then raise exception 'Request/decision changed payment'; end if;
 -- Ordinary upsert into refunded is blocked; even applicant profile writes roll back.
 begin
  perform public.manage_event_application(slug,'manual',app,2,'[가상] 위조','01000005555','phone',null,'','received','refunded','','가상 접수');
  raise exception 'Manual refunded entry allowed';
 exception when check_violation then null; end;
 if not exists(select 1 from public.event_application_list where id=app and name='[가상] 환불' and payment_status='paid') then raise exception 'Failed write not rolled back'; end if;
 if public.update_event_refund(slug,ref,'process',100,false)->>'code' is distinct from 'invalid' then raise exception 'Missing external confirmation accepted'; end if;
 foreach rev in array array[0,99,101] loop
  r:=public.update_event_refund(slug,ref,'process',rev,true);
  if r->>'code' is distinct from (case when rev=0 then 'invalid' else 'amount_mismatch' end) then raise exception 'Invalid full amount accepted: %',r; end if;
 end loop;
 if public.record_event_payment(slug,'manual',app,2,200)->>'code' is distinct from 'payment_locked' then raise exception 'Receipt changed during refund'; end if;
 r:=public.update_event_refund(slug,ref,'process',100,true);
 if r->>'code' is distinct from 'saved' then raise exception 'Process failed: %',r; end if;
 if not exists(select 1 from public.event_application_refunds where id=ref and status='processed' and processed_amount_krw=100 and processed_by=auth.uid() and processed_at is not null) then raise exception 'Process metadata missing'; end if;
 if not exists(select 1 from public.event_application_list where id=app and source='manual' and payment_status='refunded' and revision=3 and paid_amount_krw=100 and payment_confirmed_by is null and payment_confirmed_at is null) then raise exception 'Payment sync failed'; end if;
 if public.update_event_refund(slug,ref,'process',100,true)->>'code' is distinct from 'invalid_transition' then raise exception 'Double process allowed'; end if;
 if public.create_event_refund_request(slug,'manual',app,'완료 후 요청',clock_timestamp())->>'code' not in ('not_paid','duplicate') then raise exception 'New request after completion allowed'; end if;
 -- The existing INSERT ON CONFLICT save path must still allow non-payment edits.
 r:=public.manage_event_application(slug,'manual',app,3,'[가상] 일반 수정','01000005555','phone',null,'','waitlisted','refunded','메모','가상 접수');
 if r->>'code' is distinct from 'saved' then raise exception 'Refunded profile edit failed: %',r; end if;
 begin
  perform public.manage_event_application(slug,'manual',app,4,'[가상] 상태 해제','01000005555','phone',null,'','received','paid','','가상 접수');
  raise exception 'Manual refunded exit allowed';
 exception when check_violation then null; end;
 if public.manage_event_application(slug,'manual',app,3,'[가상] 오래된 수정','01000005555','phone',null,'','received','refunded','','가상 접수')->>'code' is distinct from 'conflict' then raise exception 'Revision guard lost'; end if;
 select count(*) into audit_count from public.event_application_audit where application_id=app and action like 'refund_%';
 if audit_count<>5 then raise exception 'Request/reject/request/approve/process audit mismatch: %',audit_count; end if;
 if exists(select 1 from public.event_application_audit where application_id=app and action like 'refund_%' and (refund_id is null or actor<>auth.uid())) then raise exception 'Audit link/actor missing'; end if;
end $$;
reset role;
-- Legacy refunded rows remain without fabricated refund records.
do $$ declare a uuid; app uuid:=gen_random_uuid(); begin
 select user_id into a from public.admin_users limit 1;
 -- Simulate a historical row only inside this rolled-back fixture.
 alter table public.event_application_management disable trigger guard_applicant_refund_payment;
 insert into public.event_manual_applications(id,event_id,name,contact,contact_type,source_note)
 values(app,current_setting('refund_test.event')::uuid,'[가상] 기존 환불','01000005556','phone','가상 접수');
 insert into public.event_application_management(source,application_id,event_id,status,payment_status,updated_by)
 values('manual',app,current_setting('refund_test.event')::uuid,'received','refunded',a);
 alter table public.event_application_management enable trigger guard_applicant_refund_payment;
 if exists(select 1 from public.event_application_refunds where application_id=app) then raise exception 'Legacy refund fabricated'; end if;
 perform set_config('refund_test.legacy',app::text,true);
end $$;
set local role authenticated;
do $$ declare r jsonb; begin
 r:=public.manage_event_application(current_setting('refund_test.slug'),'manual',current_setting('refund_test.legacy')::uuid,1,'[가상] 기존 수정','01000005556','phone',null,'','received','refunded','','가상 접수');
 if r->>'code' is distinct from 'saved' then raise exception 'Legacy profile edit failed: %',r; end if;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 if exists(select 1 from public.event_application_refunds) then raise exception 'Nonadmin read exposure'; end if;
 if public.create_event_refund_request(current_setting('refund_test.slug'),'manual',current_setting('refund_test.app')::uuid,'권한 테스트',clock_timestamp())->>'code' is distinct from 'forbidden' then raise exception 'Nonadmin request allowed'; end if;
 if public.update_event_refund(current_setting('refund_test.slug'),gen_random_uuid(),'approve')->>'code' is distinct from 'forbidden' then raise exception 'Nonadmin update allowed'; end if;
end $$;
reset role;
do $$ begin
 if has_function_privilege('anon','public.create_event_refund_request(text,text,uuid,text,timestamptz)','EXECUTE') or has_function_privilege('anon','public.update_event_refund(text,uuid,text,integer,boolean)','EXECUTE') then raise exception 'Anonymous execution allowed'; end if;
 if has_table_privilege('authenticated','public.event_application_refunds','INSERT') or has_table_privilege('authenticated','public.event_application_refunds','UPDATE') then raise exception 'Direct refund writes exposed'; end if;
end $$;
rollback;
