-- Transactional fixture test. Execute after 025, with admin_users populated; always roll back.
begin;
do $$declare v_admin uuid;begin select user_id into v_admin from public.admin_users limit 1;if v_admin is null then raise exception 'Admin fixture required';end if;perform set_config('request.jwt.claims',jsonb_build_object('sub',v_admin,'role','authenticated')::text,true);end $$;
insert into public.recruitment_events(slug,title,status,applications_open,starts_at,ends_at,is_test)values('session-rollback-fixture','[가상] 회차 검증','draft',false,clock_timestamp()-interval '3 days',clock_timestamp()-interval '2 days',false);
create function public.session_test_audit_failure() returns trigger language plpgsql as $$begin if current_setting('session_test.fail_audit',true)='on'then raise exception 'synthetic audit failure';end if;return new;end $$;
create trigger session_test_fail before insert on public.event_session_audit for each row execute function public.session_test_audit_failure();
set local role authenticated;
do $$declare e public.recruitment_events;t public.event_participation;s1 uuid;s2 uuid;r jsonb;v_code text;rev integer;person uuid;baseline text;begin
 select * into e from public.recruitment_events where slug='event-ade6a5a7-83c2-477b-94f0-a22444a785c3' and is_test;if not found then raise exception 'Named test event missing';end if;
 select * into t from public.event_participation where event_id=e.id and source='manual' and application_id='63d9d7d9-1154-45fd-afc0-78899facdf5a';
 if not found or t.confirmation<>'confirmed'then raise exception 'Linked synthetic confirmed applicant required';end if;person:=t.person_id;baseline:=t.legacy_attendance;
 r:=public.manage_event_session(e.slug,null,0,'2001-01-01','[가상] 회차1');if r->>'code'<>'saved'then raise exception 'session1: %',r;end if;s1:=(r->>'id')::uuid;
 r:=public.manage_event_session(e.slug,null,0,'2001-01-02','[가상] 회차2');if r->>'code'<>'saved'then raise exception 'session2: %',r;end if;s2:=(r->>'id')::uuid;
 r:=public.manage_event_session(e.slug,null,0,'2001-01-01','중복');if r->>'code'<>'duplicate'then raise exception 'date duplicate';end if;
 v_code:=public.record_session_attendance(e.slug,s1,t.source,t.application_id,0,t.revision,'attended');if v_code<>'saved'then raise exception 'session write: %',v_code;end if;
 if public.record_session_attendance(e.slug,s1,t.source,t.application_id,0,t.revision,'absent')<>'conflict'then raise exception 'stale guard';end if;
 select revision into rev from public.event_participation where source=t.source and application_id=t.application_id;
 if public.record_session_attendance(e.slug,s2,t.source,t.application_id,0,rev,'attended')<>'saved'then raise exception 'second date';end if;
 if not exists(select 1 from public.event_person_session_totals where id=person and test_session_count>=2 and session_count=0)then raise exception 'session counts/test exclusion';end if;
 if not exists(select 1 from public.event_participation where source=t.source and application_id=t.application_id and legacy_attendance=baseline and attendance='attended' and note=t.note)then raise exception 'legacy/note preservation';end if;
 r:=public.manage_event_session(e.slug,s1,1,'2001-01-03','일정 변경');if r->>'code'<>'locked'then raise exception 'recorded date edit';end if;
 select revision into rev from public.event_participation where source=t.source and application_id=t.application_id;
 if public.record_event_participation(e.slug,t.source,t.application_id,rev,'confirmed','absent','')<>'sessions'then raise exception 'aggregate overwrite';end if;
 if public.record_session_attendance('halloween-2026',s1,t.source,t.application_id,1,rev,'attended')<>'missing'then raise exception 'cross event';end if;
 if public.record_session_attendance(e.slug,s1,t.source,t.application_id,1,rev,'unrecorded')<>'saved'then raise exception 'clear one date';end if;
 if not exists(select 1 from public.event_session_attendance where session_id=s2 and attendance='attended')then raise exception 'cross date overwrite';end if;
end $$;
do $$declare r jsonb;app uuid;person uuid;s uuid;future uuid;t public.event_participation;before_rev integer;begin
 r:=public.manage_event_application('session-rollback-fixture','manual',null,0,'[가상] 날짜별 검증','01000007654','phone',null,'','received','unknown','','가상 테스트');app:=(r->>'id')::uuid;
 r:=public.link_event_person('session-rollback-fixture','manual',app,null,0,true);if r->>'code'<>'saved'then raise exception 'fixture link';end if;person:=(r->>'person')::uuid;
 r:=public.manage_event_session('session-rollback-fixture',null,0,(clock_timestamp()at time zone 'Asia/Seoul')::date-1,'과거');s:=(r->>'id')::uuid;
 if public.record_session_attendance('session-rollback-fixture',s,'manual',app,0,1,'attended')<>'confirmation'then raise exception 'unconfirmed';end if;
 if public.record_event_participation('session-rollback-fixture','manual',app,1,'confirmed','unrecorded','보존할 메모')<>'saved'then raise exception 'confirm';end if;
 r:=public.manage_event_session('session-rollback-fixture',null,0,(clock_timestamp()at time zone 'Asia/Seoul')::date+1,'미래');future:=(r->>'id')::uuid;
 if public.record_session_attendance('session-rollback-fixture',future,'manual',app,0,2,'attended')<>'future'then raise exception 'future date';end if;
 if public.record_session_attendance('session-rollback-fixture',s,'manual',app,0,2,'attended')<>'saved'then raise exception 'past date';end if;
 if not exists(select 1 from public.event_person_overview where id=person and attendance_count=1 and session_count=1 and last_attended_date=(clock_timestamp()at time zone 'Asia/Seoul')::date-1)then raise exception 'actual overview';end if;
 select revision into before_rev from public.event_participation where source='manual'and application_id=app;
 perform set_config('session_test.fail_audit','on',true);
 begin
  perform public.record_session_attendance('session-rollback-fixture',s,'manual',app,1,before_rev,'absent');
  raise exception 'expected audit failure was not raised';
 exception when others then if sqlerrm<>'synthetic audit failure'then raise;end if;end;
 perform set_config('session_test.fail_audit','off',true);
 if not exists(select 1 from public.event_session_attendance where session_id=s and application_id=app and attendance='attended'and revision=1)or not exists(select 1 from public.event_participation where application_id=app and revision=before_rev and attendance='attended'and note='보존할 메모')then raise exception 'audit rollback state';end if;
 if public.record_session_attendance('session-rollback-fixture',s,'manual',app,1,before_rev,'unrecorded')<>'saved'then raise exception 'clear';end if;
 if not exists(select 1 from public.event_person_overview where id=person and session_count=0 and attendance_count=0 and last_attended_date is null)then raise exception 'clear totals';end if;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$begin
 if exists(select 1 from public.event_sessions)or exists(select 1 from public.event_session_attendance)or exists(select 1 from public.event_person_overview)then raise exception 'nonadmin read';end if;
 if public.record_session_attendance('halloween-2026',gen_random_uuid(),'manual',gen_random_uuid(),0,1,'attended')<>'forbidden'then raise exception 'nonadmin write';end if;
end $$;
reset role;
do $$begin
 if has_table_privilege('authenticated','public.event_session_attendance','INSERT')or has_function_privilege('anon','public.record_session_attendance(text,uuid,text,uuid,integer,integer,text)','EXECUTE')then raise exception 'write grants';end if;
end $$;
rollback;
select 'PASS: dates, duplicate, revision, event/date isolation, test exclusion, totals, legacy/note preservation, date lock, aggregate guard, admin/anonymous access, future/unconfirmed guards, actual totals, clear totals, audit failure rollback; rolled back' as verification;
