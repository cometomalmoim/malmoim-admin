-- NOT executed automatically. Disposable test DB only, after 010, 013 and 014 (final refund protection rules).
-- Requires at least one existing test administrator. All fixture writes roll back.
begin;
do $$ declare a uuid; e uuid; app uuid:=gen_random_uuid(); slug text:='payment-test-'||gen_random_uuid(); begin
 select user_id into a from public.admin_users limit 1;
 if a is null then raise exception 'Test administrator required'; end if;
 insert into public.recruitment_events(slug,title) values(slug,'[가상] 납부 테스트') returning id into e;
 -- Simulate pre-migration paid data without invented confirmation metadata.
 insert into public.event_manual_applications(id,event_id,name,contact,contact_type,source_note)
 values(app,e,'[가상] 기존 납부','+821000001234','phone','가상 접수');
 insert into public.event_application_management(source,application_id,event_id,status,payment_status,updated_by)
 values('manual',app,e,'received','paid',a);
 perform set_config('payment_test.slug',slug,true);
 perform set_config('payment_test.app',app::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
end $$;
set local role authenticated;
do $$ declare r jsonb; row_before public.event_application_list; row_after public.event_application_list;
 slug text:=current_setting('payment_test.slug'); app uuid:=current_setting('payment_test.app')::uuid;
 rev integer:=1; next_status text; refund uuid; begin
 -- Legacy paid -> paid must preserve NULL metadata.
 r:=public.manage_event_application(slug,'manual',app,rev,'[가상] 수정','01000001234','phone',null,'','received','paid','','가상 접수');
 if r->>'code' is distinct from 'saved' then raise exception 'Legacy edit failed: %',r; end if;
 rev:=rev+1;
 select * into row_after from public.event_application_list where id=app and source='manual';
 if row_after.payment_confirmed_by is not null or row_after.payment_confirmed_at is not null then raise exception 'Legacy confirmation fabricated'; end if;
 foreach next_status in array array['unknown','unpaid','pending_confirmation'] loop
  r:=public.manage_event_application(slug,'manual',app,rev,'[가상] 상태 수정','01000001234','phone',null,'','received',next_status,'','가상 접수');
  if r->>'code' is distinct from 'saved' then raise exception 'Status update failed: %',r; end if;
  rev:=rev+1;
  select * into row_after from public.event_application_list where id=app and source='manual';
  if row_after.payment_status is distinct from next_status or row_after.payment_confirmed_by is not null or row_after.payment_confirmed_at is not null then raise exception 'Clear rule failed'; end if;
  r:=public.manage_event_application(slug,'manual',app,rev,'[가상] 확인','01000001234','phone',null,'','received','paid','','가상 접수');
  if r->>'code' is distinct from 'saved' then raise exception 'Confirmation failed: %',r; end if;
  rev:=rev+1;
  select * into row_before from public.event_application_list where id=app and source='manual';
  if row_before.payment_confirmed_by is distinct from auth.uid() or row_before.payment_confirmed_at is null then raise exception 'Server confirmation missing'; end if;
  r:=public.manage_event_application(slug,'manual',app,rev,'[가상] 일반 수정','01000001234','phone',1998,'가상국적','waitlisted','paid','메모','가상 접수');
  if r->>'code' is distinct from 'saved' then raise exception 'General edit failed'; end if;
  rev:=rev+1;
  select * into row_after from public.event_application_list where id=app and source='manual';
  if row_after.payment_confirmed_by is distinct from row_before.payment_confirmed_by or row_after.payment_confirmed_at is distinct from row_before.payment_confirmed_at then raise exception 'Confirmation overwritten'; end if;
 end loop;
 r:=public.manage_event_application(slug,'manual',app,rev-1,'[가상] 충돌','01000001234','phone',null,'','received','unpaid','','가상 접수');
 if r->>'code' is distinct from 'conflict' then raise exception 'Revision guard failed'; end if;
 if (select count(*) from public.event_application_audit where application_id=app)<>10 then raise exception 'Audit count mismatch'; end if;
 -- Ordinary applicant upsert cannot enter refunded; rejected writes must roll back fully.
 begin
  perform public.manage_event_application(slug,'manual',app,rev,'[가상] 차단할 수정','01000001234','phone',null,'','received','refunded','','가상 접수');
  raise exception 'Ordinary refunded entry allowed';
 exception when check_violation then null; end;
 select * into row_after from public.event_application_list where id=app and source='manual';
 if row_after.payment_status is distinct from 'paid' or row_after.revision<>rev
  or row_after.name is distinct from '[가상] 일반 수정'
  or row_after.payment_confirmed_by is distinct from row_before.payment_confirmed_by
  or row_after.payment_confirmed_at is distinct from row_before.payment_confirmed_at
 then raise exception 'Blocked entry changed applicant'; end if;
 if (select count(*) from public.event_application_audit where application_id=app)<>10 then raise exception 'Blocked entry changed audit'; end if;
 -- Only the dedicated refund flow may complete a refund and synchronize payment.
 r:=public.create_event_refund_request(slug,'manual',app,'[가상] 환불 사유',clock_timestamp());
 if r->>'code' is distinct from 'saved' then raise exception 'Refund request failed: %',r; end if;
 select id into refund from public.event_application_refunds where application_id=app and source='manual' and status='requested';
 if refund is null then raise exception 'Refund request missing'; end if;
 r:=public.update_event_refund(slug,refund,'approve');
 if r->>'code' is distinct from 'saved' then raise exception 'Refund approval failed: %',r; end if;
 if not exists(select 1 from public.event_application_list where id=app and source='manual' and payment_status='paid' and revision=rev) then raise exception 'Request/approval changed payment'; end if;
 r:=public.update_event_refund(slug,refund,'process',100,true);
 if r->>'code' is distinct from 'saved' then raise exception 'Dedicated refund completion failed: %',r; end if;
 rev:=rev+1;
 if not exists(select 1 from public.event_application_refunds where id=refund and status='processed' and processed_amount_krw=100 and processed_by=auth.uid() and processed_at is not null) then raise exception 'Refund metadata missing'; end if;
 if not exists(select 1 from public.event_application_list where id=app and source='manual' and payment_status='refunded' and revision=rev and payment_confirmed_by is null and payment_confirmed_at is null) then raise exception 'Refund payment sync failed'; end if;
 -- Every ordinary transition out of refunded is blocked, preserving revision/audit.
 foreach next_status in array array['unknown','unpaid','pending_confirmation','paid'] loop
  begin
   perform public.manage_event_application(slug,'manual',app,rev,'[가상] 차단할 해제','01000001234','phone',null,'','received',next_status,'','가상 접수');
   raise exception 'Ordinary refunded exit allowed: %',next_status;
  exception when check_violation then null; end;
 end loop;
 if not exists(select 1 from public.event_application_list where id=app and source='manual' and payment_status='refunded' and revision=rev and name='[가상] 일반 수정') then raise exception 'Blocked exit changed applicant'; end if;
 if (select count(*) from public.event_application_audit where application_id=app)<>13 then raise exception 'Refund/blocked exit audit mismatch'; end if;
 -- Normal profile edits remain possible with refunded unchanged.
 r:=public.manage_event_application(slug,'manual',app,rev,'[가상] 환불 후 일반 수정','01000001234','phone',1998,'가상국적','waitlisted','refunded','메모','가상 접수');
 if r->>'code' is distinct from 'saved' then raise exception 'Refunded profile edit failed: %',r; end if;
 if not exists(select 1 from public.event_application_list where id=app and source='manual' and payment_status='refunded' and revision=rev+1 and name='[가상] 환불 후 일반 수정') then raise exception 'Refunded profile readback failed'; end if;
 if (select count(*) from public.event_application_audit where application_id=app)<>14 then raise exception 'Profile audit mismatch'; end if;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 if exists(select 1 from public.event_application_list) then raise exception 'Nonadmin data exposure'; end if;
 if public.manage_event_application(current_setting('payment_test.slug'),'manual',null,0,'[가상] 권한','01000001235','phone',null,'','received','paid','','가상 접수')->>'code' is distinct from 'forbidden' then raise exception 'Nonadmin write allowed'; end if;
end $$;
reset role;
do $$ begin
 if has_function_privilege('anon','public.manage_event_application(text,text,uuid,integer,text,text,text,integer,text,text,text,text,text)','EXECUTE') then raise exception 'Anonymous execution allowed'; end if;
end $$;
rollback;
