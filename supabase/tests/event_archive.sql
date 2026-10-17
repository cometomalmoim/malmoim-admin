-- Run in the same transaction as 030 (omit its COMMIT). All fixtures roll back.
do $$declare a uuid;begin
 select user_id into a from public.admin_users limit 1;
 if a is null then raise exception 'Admin fixture missing';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
end $$;
set local role authenticated;
do $$declare e public.recruitment_events; n bigint; r text; blocked boolean;begin
 select * into e from public.recruitment_events where slug='event-ade6a5a7-83c2-477b-94f0-a22444a785c3';
 if e.id is null or not e.is_test or e.is_archived or e.applications_open then raise exception 'Unsafe test fixture';end if;
 select count(*) into n from public.event_application_admin_list where event_id=e.id;
 r:=public.archive_recruitment_event(e.slug,e.archive_revision,true);
 if r<>'saved' then raise exception 'Archive failed: %',r;end if;
 if not exists(select 1 from public.recruitment_events where id=e.id and is_archived and not applications_open and archive_revision=e.archive_revision+1)then raise exception 'Archive state';end if;
 if public.event_registration_info(e.slug,true)->>'open'<>'false' then raise exception 'Test intake still open';end if;
 if public.event_registration_info(e.slug,false)->>'open'<>'false' then raise exception 'Public intake still open';end if;
 if public.archive_recruitment_event(e.slug,e.archive_revision,false)<>'conflict' then raise exception 'Stale revision accepted';end if;
 blocked:=false;
 begin
  perform public.manage_event_application(e.slug,'manual',null,null,'[가상] 보관 검증','+821000009998','phone',null,null,'received','unknown','','롤백 전용');
 exception when others then
  if sqlerrm like '%Archived event cannot receive new applications%'then blocked:=true;else raise;end if;
 end;
 if not blocked then raise exception 'Archived insert accepted';end if;
 if (select count(*) from public.event_application_admin_list where event_id=e.id)<>n then raise exception 'Applications changed';end if;
 if (select count(*) from public.event_archive_audit where event_id=e.id and archived)<>1 then raise exception 'Audit missing';end if;
 r:=public.archive_recruitment_event(e.slug,e.archive_revision+1,false);
 if r<>'saved' or not exists(select 1 from public.recruitment_events where id=e.id and not is_archived and not applications_open and archive_revision=e.archive_revision+2)then raise exception 'Restore state';end if;
 if public.archive_recruitment_event(e.slug,e.archive_revision+2,false)<>'unchanged' then raise exception 'Repeated restore';end if;
end $$;
reset role;
-- Force an audit failure and prove the update rolls back with it.
create function public.test_event_archive_audit_failure()returns trigger language plpgsql as $$begin raise exception 'synthetic archive audit failure';end $$;
create trigger test_archive_failure before insert on public.event_archive_audit for each row execute function public.test_event_archive_audit_failure();
set local role authenticated;
do $$declare e public.recruitment_events; blocked boolean:=false;begin
 select * into e from public.recruitment_events where slug='event-ade6a5a7-83c2-477b-94f0-a22444a785c3';
 begin perform public.archive_recruitment_event(e.slug,e.archive_revision,true);
 exception when others then if sqlerrm='synthetic archive audit failure'then blocked:=true;else raise;end if;end;
 if not blocked or not exists(select 1 from public.recruitment_events where id=e.id and is_archived=e.is_archived and archive_revision=e.archive_revision and applications_open=e.applications_open)then raise exception 'Audit rollback failed';end if;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$begin
 if public.archive_recruitment_event('event-ade6a5a7-83c2-477b-94f0-a22444a785c3',0,true)<>'forbidden'then raise exception 'Nonadmin allowed';end if;
 if exists(select 1 from public.event_archive_audit)then raise exception 'Nonadmin sees audit';end if;
end $$;
reset role;
do $$begin
 if has_function_privilege('anon','public.archive_recruitment_event(text,integer,boolean)','EXECUTE')then raise exception 'Anonymous archive permission';end if;
 if has_function_privilege('authenticated','public.event_registration_info_before_archive(text,boolean)','EXECUTE')then raise exception 'Legacy bypass permission';end if;
 if has_column_privilege('authenticated','public.recruitment_events','is_archived','UPDATE')then raise exception 'Direct archive write';end if;
end $$;
rollback;
select 'PASS: archive, restore, intake guards, application preservation, revision, audit, nonadmin, privileges and rollback; all fixtures rolled back' as result;
