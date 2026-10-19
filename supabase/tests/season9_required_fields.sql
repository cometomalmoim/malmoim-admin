-- All synthetic application and notification queue writes are rolled back.
begin;
do $$
declare p jsonb; bad jsonb; result jsonb; sid uuid := gen_random_uuid();
begin
 p := jsonb_build_object('submission_id',sid,'name','[가상] 필수값 검증','nationality','가상국',
 'date_of_birth','2000-01-01','contact_type','instagram','contact','qa_'||left(replace(sid::text,'-',''),20),
 'preferred_class','thursday','gender','답변하지 않음 / Prefer not to say','occupation','가상 학생',
 'motivation','가상 참여 동기','notice_version','season9-2026-10-14-v1','privacy_consent',true,'fee_confirmed',true);
 foreach bad in array array[p-'gender',p-'occupation',p-'motivation',p||'{"motivation":" "}'::jsonb,p||jsonb_build_object('occupation',repeat('a',201))] loop
  begin
   perform public.submit_season9_application(bad);
   raise exception 'missing validation';
  exception when others then
   if sqlerrm <> 'required_profile_fields' then raise; end if;
  end;
 end loop;
 if has_function_privilege('anon','public.submit_season9_before_required_fields(jsonb)','execute')
 or has_function_privilege('authenticated','public.submit_season9_before_required_fields(jsonb)','execute') then raise exception 'validation bypass'; end if;
 if not has_function_privilege('anon','public.submit_season9_application(jsonb)','execute') then raise exception 'submission unavailable'; end if;
 result := public.submit_season9_application(p);
 if result->>'accepted' <> 'true' then raise exception 'valid application failed'; end if;
 if not exists(select 1 from public.event_applications where submission_id=sid and motivation='가상 참여 동기' and coalesce(introduction,'')='') then raise exception 'optional activities failed'; end if;
end $$;
select 'required fields and optional activities passed; synthetic writes rolled back' as result;
rollback;
