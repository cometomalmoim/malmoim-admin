-- Future submissions require explicit photo consent; preserve existing applications.
begin;
do $migration$
declare def text;
begin
 if (select count(*) from public.recruitment_events where slug='season9')<>1 then raise exception 'Expected exactly one season9 event';end if;
 if not exists(select 1 from public.recruitment_events where slug='season9' and privacy_notice_version='season9-2026-10-14-v1' and privacy_notice like '%사진 활용 및 다음 기수 안내 동의는 선택 사항입니다.%')then raise exception 'Unexpected season9 notice; review before applying';end if;
 select pg_get_functiondef('public.submit_season9_before_required_fields(jsonb)'::regprocedure) into def;
 if (select count(*) from regexp_matches(def,'\mUPDATE\M','gi'))<>1 or strpos(lower(def),'for update;')=0 or def ~* '\m(delete|truncate)\M' then raise exception 'Unexpected DML in intake definition';end if;
 if strpos(def,'''season9-2026-10-14-v1''')=0 or strpos(def,'if payload is null or jsonb_typeof(payload)')=0 then raise exception 'Unexpected season9 intake implementation';end if;
 def:=replace(def,'''season9-2026-10-14-v1''','''season9-2026-10-22-photo-required-v2''');
 -- Previously open forms are accepted only with explicit photo consent.
 -- New stored records use the new version and current notice snapshot.
 def:=replace(def,'if payload->>''notice_version'' is distinct from ''season9-2026-10-22-photo-required-v2''','if coalesce(payload->>''notice_version'','''') not in (''season9-2026-10-14-v1'',''season9-2026-10-22-photo-required-v2'')');
 def:=replace(def,'if payload is null or jsonb_typeof(payload)','if payload->''photo_consent'' is distinct from ''true''::jsonb then raise exception ''photo_consent_required''; end if;'||chr(10)||'  if payload is null or jsonb_typeof(payload)');
 execute def;
 select pg_get_functiondef('public.season9_registration_info()'::regprocedure) into def;
 if strpos(def,'''season9-2026-10-14-v1''')=0 then raise exception 'Unexpected season9 intake gate';end if;
 execute replace(def,'''season9-2026-10-14-v1''','''season9-2026-10-22-photo-required-v2''');
end $migration$;
update public.recruitment_events set privacy_notice=replace(replace(privacy_notice,
'사진 활용 및 다음 기수 안내 동의는 선택 사항입니다.',
'활동 사진 활용 동의는 필수이며, 동의하지 않으면 신청할 수 없습니다. 다음 기수 안내 동의는 선택 사항입니다.'),
'Required privacy consent is necessary to apply; photo use and future updates are optional.',
'Required privacy consent and consent to the use of activity photos are necessary to apply; future updates remain optional.'),
privacy_notice_version='season9-2026-10-22-photo-required-v2'
where slug='season9' and privacy_notice_version='season9-2026-10-14-v1';
revoke all on function public.submit_season9_before_required_fields(jsonb) from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
