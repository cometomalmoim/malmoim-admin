-- Append after 037 without its COMMIT. Test-only writes and schema roll back.
do $$declare actor uuid;begin select user_id into actor from public.admin_users limit 1;if actor is null then raise exception 'Missing admin';end if;perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);end $$;
set local role authenticated;
do $$declare v_slug text:='event-ade6a5a7-83c2-477b-94f0-a22444a785c3';s uuid:=gen_random_uuid();missing uuid:=gen_random_uuid();application uuid;result text;begin
 if not exists(select 1 from public.recruitment_events where recruitment_events.slug=v_slug and is_test and not is_archived)then raise exception 'Unsafe synthetic fixture';end if;
 result:=public.submit_event_registration_with_birth_year(v_slug,s,'[가상] 출생연도 저장 검증','+821000009981','new','',true,'synthetic-test-v1',true,false,'naver','test','birth-year-test',1998);
 if result<>'saved'then raise exception 'Save failed %',result;end if;
 select id into application from public.event_registration_responses where submission_id=s;
 if not exists(select 1 from public.event_application_admin_list where id=application and source='registration' and birth_year=1998 and utm_source='naver')then raise exception 'Admin year/attribution missing';end if;
 if public.submit_event_registration_with_birth_year(v_slug,s,'[가상] 출생연도 저장 검증','+821000009981','new','',true,'synthetic-test-v1',true,false,'naver','test','birth-year-test',1998)<>'saved'then raise exception 'Retry failed';end if;
 if public.submit_event_registration_with_birth_year(v_slug,s,'[가상] 출생연도 저장 검증','+821000009981','new','',true,'synthetic-test-v1',true,false,'other','','',1999)<>'invalid'then raise exception 'Changed year retry accepted';end if;
 if public.submit_event_registration_with_birth_year(v_slug,gen_random_uuid(),'[가상] 미래 연도','+821000009983','new','',true,'synthetic-test-v1',true,false,'','','',extract(year from clock_timestamp() at time zone 'Asia/Seoul')::integer+1)<>'birth_year'then raise exception 'Future year accepted';end if;
 if public.submit_event_registration_with_birth_year(v_slug,gen_random_uuid(),'[가상] 과거 연도','+821000009983','new','',true,'synthetic-test-v1',true,false,'','','',1899)<>'birth_year'then raise exception 'Old year accepted';end if;
 result:=public.submit_event_registration_with_birth_year(v_slug,missing,'[가상] 출생연도 선택 미입력','+821000009982','new','',true,'synthetic-test-v1',true,false,'','','',null);
 if result<>'saved'or not exists(select 1 from public.event_registration_responses where submission_id=missing and birth_year is null)then raise exception 'Optional year failed';end if;
 if public.manage_event_application(v_slug,'registration',application,0,'[가상] 출생연도 저장 검증','+821000009981','phone',2000,null,'received','unknown','','')->>'code'<>'saved'then raise exception 'Admin edit failed';end if;
 if not exists(select 1 from public.event_application_admin_list where id=application and birth_year=2000)then raise exception 'Admin override lost';end if;
 if not exists(select 1 from public.event_registration_responses where submission_id=s and birth_year=1998)then raise exception 'Original response overwritten';end if;
end $$;
reset role;
select set_config('request.jwt.claims','{}',true);
set local role anon;
do $$declare blocked boolean:=false;begin
 begin perform birth_year from public.event_registration_responses limit 1;exception when insufficient_privilege then blocked:=true;end;
 if not blocked then raise exception 'Public can read responses';end if;
 if public.submit_event_registration_with_birth_year('event-ade6a5a7-83c2-477b-94f0-a22444a785c3',gen_random_uuid(),'[가상] 비관리자 테스트 차단','+821000009983','new','',true,'synthetic-test-v1',true,false,'','','',1998)<>'closed'then raise exception 'Anonymous test access';end if;
end $$;
reset role;
rollback;
select 'PASS: optional birth year, admin view/override, original response, UTM, retry, invalid years and anonymous access; all writes rolled back' as result;
