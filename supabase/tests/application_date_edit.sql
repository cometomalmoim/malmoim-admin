-- Existing synthetic applicant only. All mutations roll back.
begin;
do $$
declare a public.event_application_list; r jsonb; n integer;
begin
 select * into strict a from public.event_application_list where id='eb2fafee-57ee-49c2-9cd3-8a028854a4ab' and source='registration' and name='[가상] 당근 UTM 웹 검증';
 perform set_config('request.jwt.claim.sub',(select user_id::text from public.admin_users limit 1),true);
 r:=public.correct_event_application_date('event-ade6a5a7-83c2-477b-94f0-a22444a785c3',a.source,a.id,a.revision,a.created_at-interval '1 day');
 if r->>'code'<>'saved' then raise exception 'save failed %',r;end if;
 if not exists(select 1 from public.event_application_list where id=a.id and source=a.source and created_at=a.created_at-interval '1 day' and revision=a.revision+1 and payment_status=a.payment_status and status=a.status) then raise exception 'date/revision/preservation failed';end if;
 select count(*) into n from public.event_application_date_audit where application_id=a.id and old_date=a.created_at and new_date=a.created_at-interval '1 day';
 if n<>1 then raise exception 'audit failed';end if;
 r:=public.correct_event_application_date('event-ade6a5a7-83c2-477b-94f0-a22444a785c3',a.source,a.id,a.revision,a.created_at);
 if r->>'code'<>'conflict' then raise exception 'revision failed';end if;
 r:=public.correct_event_application_date('event-ade6a5a7-83c2-477b-94f0-a22444a785c3',a.source,a.id,a.revision+1,clock_timestamp()+interval '1 day');
 if r->>'code'<>'invalid' then raise exception 'future failed';end if;
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
 r:=public.correct_event_application_date('event-ade6a5a7-83c2-477b-94f0-a22444a785c3',a.source,a.id,a.revision+1,a.created_at);
 if r->>'code'<>'forbidden' then raise exception 'auth failed';end if;
 if has_function_privilege('anon','public.correct_event_application_date(text,text,uuid,integer,timestamp with time zone)','execute') then raise exception 'anon permission failed';end if;
end $$;
rollback;
select 'passed: date, revision, status preservation, audit, conflict, future, nonadmin, anonymous' as result;
