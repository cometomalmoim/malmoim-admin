-- Append to 038 without COMMIT: no public inserts, all schema/notice changes roll back.
set local role anon;
do $$declare y integer;begin
 foreach y in array array[null,1989,2008] loop
  if public.submit_event_registration_with_birth_year('halloween-2026',gen_random_uuid(),'[가상] 필수 연도 거부','+821000009989','new','',true,'invalid-test-version',false,false,'','','',y)<>'birth_year'then raise exception 'Invalid year accepted %',y;end if;
 end loop;
 foreach y in array array[1990,2007] loop
  if public.submit_event_registration_with_birth_year('halloween-2026',gen_random_uuid(),'[가상] 경계 검사','+821000009989','new','',false,'invalid-test-version',false,false,'','','',y)='birth_year'then raise exception 'Valid boundary rejected %',y;end if;
 end loop;
end $$;
reset role;
do $$begin
 if not exists(select 1 from public.recruitment_events where slug='halloween-2026' and privacy_notice_version='halloween-2026-10-18-birth-year-required-v2' and privacy_notice like '%Required information: birth year (YYYY)%' and privacy_notice not like '%You may apply without providing it.%')then raise exception 'Notice not updated';end if;
end $$;
rollback;
select 'PASS: required year, range, valid boundaries, updated notice; no public response saved; changes rolled back' as result;
