-- Synthetic records only; rollback leaves existing records unchanged.
begin;
do $$
declare e public.recruitment_events; sid uuid:=gen_random_uuid(); result text; aid uuid;
begin
 select user_id into strict aid from public.admin_users limit 1;
 perform set_config('request.jwt.claim.sub',aid::text,true);
 select * into strict e from public.recruitment_events where is_test limit 1;
 result:=public.submit_event_registration_attributed(e.slug,sid,'[가상] UTM 검증','+821000009917','new','',true,'synthetic-test-v1',true,false,'daangn','social','synthetic-check');
 if result<>'saved' then raise exception 'submit failed: %',result;end if;
 if not exists(select 1 from public.event_application_traffic_list where event_id=e.id and name='[가상] UTM 검증' and utm_source='daangn' and utm_medium='social' and utm_campaign='synthetic-check') then raise exception 'attribution readback failed';end if;
 result:=public.submit_event_registration_attributed(e.slug,sid,'[가상] UTM 검증','+821000009917','new','',true,'synthetic-test-v1',true,false,'meta','other','overwrite');
 if result<>'saved' or not exists(select 1 from public.event_application_traffic_list where event_id=e.id and name='[가상] UTM 검증' and utm_source='daangn') then raise exception 'retry overwrote attribution';end if;
 if has_table_privilege('anon','public.event_application_attribution','SELECT') or has_table_privilege('authenticated','public.event_application_attribution','INSERT') or has_table_privilege('anon','public.event_application_traffic_list','SELECT') then raise exception 'unexpected grants';end if;
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000099',true);
 result:=public.submit_event_registration_attributed(e.slug,gen_random_uuid(),'[가상] 차단','+821000009918','new','',true,'synthetic-test-v1',true,false,'naver','','');
 if result<>'closed' then raise exception 'non-admin test submission permitted';end if;
end $$;
set local role authenticated;
do $$begin
 if exists(select 1 from public.event_application_traffic_list) or exists(select 1 from public.event_application_attribution) then raise exception 'non-admin read permitted';end if;
end $$;
reset role;
rollback;
select 'UTM synthetic save/retry/grants/RLS passed; test records rolled back' as result;
