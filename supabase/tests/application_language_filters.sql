begin;
do $$
declare eid uuid; aid uuid:=gen_random_uuid(); alias text;
begin
 select id into eid from public.recruitment_events where is_test limit 1;
 if eid is null then raise exception 'test event required'; end if;
 insert into public.event_applications(id,event_id,submission_id,name,contact,contact_type,preferred_class,privacy_notice_version,privacy_consent,fee_policy_confirmed,korean_level,english_level)
 values(aid,eid,gen_random_uuid(),'[가상] 언어 국적 필터','qa_language_'||left(replace(aid::text,'-',''),10),'instagram','thursday','synthetic-test-v1',true,true,'저는 한국 사람입니다 / I am Korean','조금 가능 / Basic');
 foreach alias in array array['대한민국','한국','South Korea','Republic of Korea','KR','KOR','Korea, Republic of','대한민국 / South Korea'] loop
  update public.event_applications set nationality=alias where id=aid;
  if not exists(select 1 from public.event_application_language_list where id=aid and source='season9' and nationality_group='korean' and korean_level='저는 한국 사람입니다 / I am Korean' and english_level='조금 가능 / Basic') then raise exception 'korean alias or combined filter failed'; end if;
 end loop;
 update public.event_applications set nationality='Japan' where id=aid;
 if not exists(select 1 from public.event_application_language_list where id=aid and nationality_group='foreign') then raise exception 'foreign filter failed'; end if;
 update public.event_applications set nationality=null where id=aid;
 if not exists(select 1 from public.event_application_language_list where id=aid and nationality_group='unknown') then raise exception 'unknown filter failed'; end if;
 if has_table_privilege('anon','public.event_application_language_list','select') then raise exception 'public access'; end if;
end $$;
set local role authenticated;
do $$ begin
 if exists(select 1 from public.event_application_language_list) then raise exception 'nonadmin access'; end if;
end $$;
reset role;
select 'PASS: Korean aliases, foreign, unknown, combined language filters, anonymous/nonadmin isolation; synthetic rows rolled back' as result;
rollback;
