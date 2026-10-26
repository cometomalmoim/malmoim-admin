-- READ ONLY. Select Dashboard project qkhlvdctdcpfyvohhikl yourself first.
-- Database name cannot prove project identity. No user rows, keys or file paths.
BEGIN READ ONLY;
WITH expected(relation,column_name,type_name) AS (VALUES
 ('auth.users','id','uuid'),('public.admin_users','user_id','uuid'),
 ('public.event_people','id','uuid'),
 ('public.event_application_admin_list','event_id','uuid'),('public.event_application_admin_list','id','uuid'),
 ('public.event_application_admin_list','source','text'),('public.event_application_admin_list','is_archived','boolean'),
 ('public.event_participation','person_id','uuid'),('public.event_participation','event_id','uuid'),
 ('public.event_participation','source','text'),('public.event_participation','application_id','uuid'),
 ('public.event_participation','confirmation','text'),('public.event_participation','attendance','text'),
 ('public.recruitment_events','id','uuid'),('public.recruitment_events','is_test','boolean'),('public.recruitment_events','starts_at','timestamp with time zone'),
 ('public.event_sessions','id','uuid'),('public.event_sessions','event_id','uuid'),('public.event_sessions','session_date','date'),
 ('public.event_session_attendance','session_id','uuid'),('public.event_session_attendance','event_id','uuid'),
 ('public.event_session_attendance','source','text'),('public.event_session_attendance','application_id','uuid'),('public.event_session_attendance','attendance','text')),
wanted(name) AS (VALUES ('history_reviews'),('history_participant_links'),('history_participant_audit'),('history_participant_evidence'),('admin_users'),('event_people'),('event_participation'),('event_sessions'),('event_session_attendance'),('recruitment_events'),('event_application_admin_list'))
SELECT jsonb_build_object(
 'dependencies',(SELECT jsonb_agg(jsonb_build_object('relation',e.relation,'column',e.column_name,'expected',e.type_name,'actual',format_type(a.atttypid,a.atttypmod),'matches',coalesce(a.atttypid=to_regtype(e.type_name),false))) FROM expected e LEFT JOIN pg_attribute a ON a.attrelid=to_regclass(e.relation) AND a.attname=e.column_name AND a.attnum>0 AND NOT a.attisdropped),
 'review_tables',(SELECT jsonb_agg(jsonb_build_object('name',w.name,'exists',c.oid IS NOT NULL,'owner',pg_get_userbyid(c.relowner),'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,
 'columns',(SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod))) FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped),
 'acl',(SELECT jsonb_agg(jsonb_build_object('role',r.rolname,'select',has_table_privilege(r.oid,c.oid,'SELECT'),'insert',has_table_privilege(r.oid,c.oid,'INSERT'),'update',has_table_privilege(r.oid,c.oid,'UPDATE'),'delete',has_table_privilege(r.oid,c.oid,'DELETE'))) FROM pg_roles r WHERE r.rolname IN ('anon','authenticated') AND c.oid IS NOT NULL))) FROM wanted w LEFT JOIN pg_class c ON c.oid=to_regclass('public.'||w.name)),
 'functions',(SELECT jsonb_agg(jsonb_build_object('name',p.proname,'args',pg_get_function_identity_arguments(p.oid),'owner',pg_get_userbyid(p.proowner),'definer',p.prosecdef,'settings',p.proconfig,'definition',pg_get_functiondef(p.oid),'anon_execute',has_function_privilege('anon',p.oid,'EXECUTE'),'authenticated_execute',has_function_privilege('authenticated',p.oid,'EXECUTE'))) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f' AND p.proname IN ('history_can_create_review','history_manage_participant','validate_history_review','link_event_person','record_event_participation','record_session_attendance')),
 'identity_foreign_keys',(SELECT jsonb_agg(jsonb_build_object('table',n.nspname||'.'||c.relname,'definition',pg_get_constraintdef(k.oid))) FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE k.contype='f' AND n.nspname='public' AND k.confrelid IN (to_regclass('auth.users'),to_regclass('public.event_people'))),
 'policies',(SELECT jsonb_agg(jsonb_build_object('table',schemaname||'.'||tablename,'name',policyname,'roles',roles,'command',cmd,'permissive',permissive,'using',qual,'check',with_check)) FROM pg_policies WHERE (schemaname='public' AND tablename IN (SELECT name FROM wanted)) OR (schemaname='storage' AND tablename='objects')),
 'review_bucket',(SELECT jsonb_agg(jsonb_build_object('id',id,'private',NOT public,'limit',file_size_limit,'mime',allowed_mime_types)) FROM storage.buckets WHERE id='history-review-photos'),
 'storage_acl',(SELECT jsonb_agg(jsonb_build_object('role',r.rolname,'select',has_table_privilege(r.oid,c.oid,'SELECT'),'insert',has_table_privilege(r.oid,c.oid,'INSERT'),'delete',has_table_privilege(r.oid,c.oid,'DELETE'))) FROM pg_class c CROSS JOIN pg_roles r WHERE c.oid=to_regclass('storage.objects') AND r.rolname IN ('anon','authenticated'))
) AS review_preflight;
COMMIT;
