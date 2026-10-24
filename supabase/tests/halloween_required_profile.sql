-- Run after 048. Existing administrator-only synthetic fixture; no public submissions.
begin;
do $$declare actor uuid;begin select user_id into actor from public.admin_users limit 1;if actor is null then raise exception 'Missing admin';end if;perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);end $$;
set local role authenticated;
do $$declare v_slug text:='event-ade6a5a7-83c2-477b-94f0-a22444a785c3';s uuid:=gen_random_uuid();missing uuid:=gen_random_uuid();application uuid;result text;begin
 if not exists(select 1 from public.recruitment_events where recruitment_events.slug=v_slug and is_test and not is_archived)then raise exception 'Unsafe synthetic fixture';end if;
 result:=public.submit_event_registration_with_profile(v_slug,s,'[가상] 국적 저장 검증','+821000009971','new','',true,'synthetic-test-v1',true,false,'','','',1998,' Canada ','female');
 if result is distinct from 'saved'then raise exception 'Save failed %',result;end if;
 select id into application from public.event_registration_responses where submission_id=s;
 if not exists(select 1 from public.event_application_language_list where id=application and source='registration' and nationality='Canada' and gender='female' and nationality_group='foreign')then raise exception 'Admin nationality missing';end if;
 if public.submit_event_registration_with_profile(v_slug,s,'[가상] 국적 저장 검증','+821000009971','new','',true,'synthetic-test-v1',true,false,'','','',1998,'Canada','female') is distinct from 'saved'then raise exception 'Retry failed';end if;
 if public.submit_event_registration_with_profile(v_slug,s,'[가상] 국적 저장 검증','+821000009971','new','',true,'synthetic-test-v1',true,false,'','','',1998,'Japan','female') is distinct from 'invalid'then raise exception 'Changed nationality retry accepted';end if;
 if public.submit_event_registration_with_profile(v_slug,gen_random_uuid(),'[가상] 긴 국적','+821000009972','new','',true,'synthetic-test-v1',true,false,'','','',1998,repeat('x',101),'female') is distinct from 'nationality'then raise exception 'Long nationality accepted';end if;
 if public.submit_event_registration_with_profile(v_slug,missing,'[가상] 국적 미입력','+821000009972','new','',true,'synthetic-test-v1',true,false,'','','',1998,null,'female') is distinct from 'saved'then raise exception 'Optional nationality failed';end if;
 if public.manage_event_application(v_slug,'registration',application,0,'[가상] 국적 저장 검증','+821000009971','phone',1998,'대한민국','received','unknown','','')->>'code' is distinct from 'saved'then raise exception 'Admin edit failed';end if;
 if not exists(select 1 from public.event_application_language_list where id=application and nationality='대한민국' and nationality_group='korean')then raise exception 'Admin override lost';end if;
 if not exists(select 1 from public.event_registration_responses where submission_id=s and nationality='Canada')then raise exception 'Original overwritten';end if;
end $$;
reset role;
select set_config('request.jwt.claims','{}',true);
set local role anon;
do $$declare blocked boolean:=false;begin
 if public.submit_event_registration_with_profile('halloween-2026',gen_random_uuid(),'[가상] 필수 검증','','new','',false,'',false,false,'','','',1998,null,'female') is distinct from 'nationality'then raise exception 'Missing nationality accepted';end if;
 if public.submit_event_registration_with_profile('halloween-2026',gen_random_uuid(),'[가상] 필수 검증','','new','',false,'',false,false,'','','',1998,'Canada',null) is distinct from 'gender'then raise exception 'Missing gender accepted';end if;
 if public.submit_event_registration_with_profile('halloween-2026',gen_random_uuid(),'[가상] 필수 검증','','new','',false,'',false,false,'','','',1998,'Canada','invalid') is distinct from 'gender'then raise exception 'Invalid gender accepted';end if;
 begin perform nationality from public.event_registration_responses limit 1;exception when insufficient_privilege then blocked:=true;end;
 if not blocked then raise exception 'Public can read responses';end if;
 if public.submit_event_registration_with_profile('event-ade6a5a7-83c2-477b-94f0-a22444a785c3',gen_random_uuid(),'[가상] 차단 검증','+821000009973','new','',true,'synthetic-test-v1',true,false,'','','',1998,'Canada','female') is distinct from 'closed'then raise exception 'Anonymous test access';end if;
end $$;
reset role;
rollback;
select 'PASS: required nationality/gender, saved gender, admin view, retry, RLS; all test writes rolled back' as result;
