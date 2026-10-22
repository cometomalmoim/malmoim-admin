-- All synthetic application and notification queue writes are rolled back.
begin;
do $$declare p jsonb;bad jsonb;result jsonb;sid uuid:=gen_random_uuid();begin
 p:=jsonb_build_object('submission_id',sid,'name','[가상] 사진 동의 검증','nationality','가상국','date_of_birth','2000-01-01','contact_type','instagram','contact','qa_'||left(replace(sid::text,'-',''),20),'preferred_class','thursday','gender','답변하지 않음 / Prefer not to say','occupation','가상 학생','motivation','가상 참여 동기','korean_level','조금 가능 / Basic','english_level','유창함 / Fluent','full_attendance',true,'notice_version','season9-2026-10-22-photo-required-v2','privacy_consent',true,'fee_confirmed',true,'photo_consent',true,'future_updates_consent',false);
 foreach bad in array array[p-'photo_consent',p||'{"photo_consent":false}'::jsonb,p||'{"photo_consent":null}'::jsonb,p||'{"photo_consent":"true"}'::jsonb]loop
  begin perform public.submit_season9_application(bad);raise exception 'Missing photo consent accepted';exception when others then if sqlerrm<>'photo_consent_required'then raise;end if;end;
 end loop;
 if has_function_privilege('anon','public.submit_season9_before_required_fields(jsonb)','execute')then raise exception 'Private wrapper bypass';end if;
 result:=public.submit_season9_application(p);
 if result->>'accepted' is distinct from 'true'then raise exception 'Consented submission failed';end if;
 if not exists(select 1 from public.event_applications where submission_id=sid and photo_consent=true and future_updates_consent=false and privacy_notice_version='season9-2026-10-22-photo-required-v2' and privacy_notice_snapshot like '%활동 사진 활용 동의는 필수%')then raise exception 'Consent/version/snapshot not stored';end if;
end $$;
rollback;
select 'PASS: required photo consent, explicit boolean only, stored consent/version/snapshot, optional updates, private RPC; all writes rolled back' as result;
