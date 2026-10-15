-- All test records and changes roll back. No actual applicant is modified.
begin;
do $$ declare admin_id uuid;begin select user_id into admin_id from public.admin_users limit 1;perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'role','authenticated')::text,true);end $$;
set local role authenticated;
do $$ declare r jsonb; app_id uuid; v_slug text:='event-ade6a5a7-83c2-477b-94f0-a22444a785c3'; begin
 r:=public.manage_event_application(v_slug,'manual',null,0,'[가상] 관리 SQL','01000009999','phone',1998,'가상국적','received','unknown','가상 메모','가상 접수');
 if r->>'code'<>'saved' then raise exception 'Create failed: %',r;end if;app_id:=(r->>'id')::uuid;
 r:=public.manage_event_application(v_slug,'manual',app_id,1,'[가상] 관리 수정','01000009999','phone',1999,'가상국적','waitlisted','paid','수정 메모','가상 접수');
 if r->>'code'<>'saved' then raise exception 'Update failed: %',r;end if;
 if not exists(select 1 from public.event_application_list where id=app_id and source='manual' and status='waitlisted' and payment_status='paid' and birth_year=1999 and nationality='가상국적' and internal_note='수정 메모' and revision=2) then raise exception 'Readback failed';end if;
 if (select count(*) from public.event_application_audit where application_id=app_id)<>2 then raise exception 'Audit failed';end if;
 r:=public.manage_event_application(v_slug,'manual',app_id,1,'[가상] 충돌','01000009999','phone',1999,'가상국적','declined','unpaid','','가상 접수');
 if r->>'code'<>'conflict' then raise exception 'Stale revision failed';end if;
 r:=public.manage_event_application('halloween-2026','manual',app_id,2,'[가상] 격리','01000009999','phone',1999,'가상국적','received','unknown','','가상 접수');
 if r->>'code'<>'missing' then raise exception 'Event isolation failed';end if;
 r:=public.manage_event_application(v_slug,'manual',null,0,'[가상] 중복','+82 10 0000 9999','phone',null,'','received','unknown','','가상 접수');
 if r->>'code'<>'duplicate' then raise exception 'Duplicate failed';end if;
 if public.submit_event_registration(v_slug,'55555555-5555-4555-8555-555555555555','[가상] 온라인 중복','+821000009999','new','',true,'synthetic-test-v1',true,false)<>'duplicate' then raise exception 'Online manual duplicate guard failed';end if;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 if exists(select 1 from public.event_application_management) or exists(select 1 from public.event_manual_applications) or exists(select 1 from public.event_application_audit) or exists(select 1 from public.event_application_list) then raise exception 'Nonadmin read exposure';end if;
 if public.manage_event_application('halloween-2026','manual',null,0,'[가상] 권한','01000009998','phone',null,'','received','unknown','','가상 접수')->>'code'<>'forbidden' then raise exception 'Nonadmin write allowed';end if;
end $$;
reset role;
do $$ begin
 if has_function_privilege('anon','public.manage_event_application(text,text,uuid,integer,text,text,text,integer,text,text,text,text,text)','EXECUTE') then raise exception 'Anonymous write grant';end if;
end $$;
rollback;
select 'PASS: create/update/readback/audit/conflict/event isolation/duplicate/online duplicate/nonadmin read/nonadmin write/anonymous denial; rolled back' as verification;
