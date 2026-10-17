begin;
do $$
declare a public.event_application_admin_list; items jsonb; n integer;
begin
 select * into strict a from public.event_application_admin_list where id='eb2fafee-57ee-49c2-9cd3-8a028854a4ab' and source='registration' and name='[가상] 당근 UTM 웹 검증';
 if a.is_archived then raise exception 'test fixture must be active';end if;
 perform set_config('request.jwt.claim.sub',(select user_id::text from public.admin_users limit 1),true);
 items:=jsonb_build_array(jsonb_build_object('event_id',a.event_id,'source',a.source,'id',a.id,'revision',a.revision,'archive_revision',a.archive_revision));
 select count(*) into n from public.event_application_archive_audit where application_id=a.id;
 if public.archive_event_applications(items,true)<>'saved' then raise exception 'archive failed';end if;
 if not exists(select 1 from public.event_application_admin_list where id=a.id and source=a.source and is_archived and status=a.status and payment_status=a.payment_status and revision=a.revision) then raise exception 'preservation failed';end if;
 if public.archive_event_applications(items,false)<>'conflict' then raise exception 'stale archive version accepted';end if;
 items:=jsonb_set(items,'{0,archive_revision}',to_jsonb(a.archive_revision+1));
 if public.archive_event_applications(items,false)<>'saved' then raise exception 'restore failed';end if;
 if not exists(select 1 from public.event_application_admin_list where id=a.id and source=a.source and not is_archived) then raise exception 'restore visibility failed';end if;
 if (select count(*) from public.event_application_archive_audit where application_id=a.id)<>n+2 then raise exception 'audit failed';end if;
 if public.archive_event_applications(items||items,true)<>'invalid' then raise exception 'duplicates accepted';end if;
 if public.manage_event_application('event-ade6a5a7-83c2-477b-94f0-a22444a785c3','manual',null,0,'[가상] 중복 검증',regexp_replace(a.contact,'^\+82','0'),'phone',null,null,'received','unknown','','[가상] 중복 차단 검증')->>'code'<>'duplicate' then raise exception 'normalized duplicate accepted';end if;
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
 if public.archive_event_applications(items,true)<>'forbidden' then raise exception 'nonadmin accepted';end if;
 if has_function_privilege('anon','public.archive_event_applications(jsonb,boolean)','execute') or has_table_privilege('authenticated','public.event_application_archives','insert') then raise exception 'privilege failure';end if;
end $$;
rollback;
select 'passed: archive, restore, preservation, conflict, audit, duplicates, nonadmin, privileges; all test writes rolled back' as result;
