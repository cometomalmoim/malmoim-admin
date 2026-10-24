-- CATALOGUE ONLY: manually select the intended project in Dashboard first.
-- Run separately in personal/team projects and label each result yourself.
-- No project identity is inferred from current_database() (often postgres in both).
-- No user rows, object keys, URLs, keys, JWTs, passwords or mutating RPC calls.
BEGIN READ ONLY;
WITH wanted(name) AS (VALUES
 ('admin_users'),('recruitment_events'),('event_registration_responses'),
 ('event_applications'),('event_manual_applications'),('event_application_list'),('event_application_admin_list'),
 ('event_people'),('event_participation'),('event_participation_audit'),
 ('event_sessions'),('event_session_attendance'),('event_session_audit'),
 ('event_person_session_totals'),('event_person_totals'),('event_person_overview'),('event_person_session_history'),
 ('people'),('people_events'),('member_profiles'),('history_reviews'),
 ('history_participant_links'),('history_participant_evidence'),('history_participant_audit'),
 ('history_photo_albums'),('history_photo_items')),
relations AS (
 SELECT w.name,c.oid,c.relkind,c.relowner,c.relrowsecurity,c.relforcerowsecurity,c.reloptions
 FROM wanted w LEFT JOIN pg_namespace n ON n.nspname='public'
 LEFT JOIN pg_class c ON c.relnamespace=n.oid AND c.relname=w.name
)
SELECT jsonb_build_object(
 'database',current_database(),'catalogue_reader',current_user,
 'relations',(SELECT jsonb_agg(jsonb_build_object('schema','public','name',r.name,'exists',r.oid IS NOT NULL,
 'kind',r.relkind,'owner',pg_get_userbyid(r.relowner),'rls',r.relrowsecurity,'force_rls',r.relforcerowsecurity,'options',r.reloptions,
 'columns',(SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull) ORDER BY a.attnum) FROM pg_attribute a WHERE a.attrelid=r.oid AND a.attnum>0 AND NOT a.attisdropped),
 'constraints',(SELECT jsonb_agg(jsonb_build_object('name',k.conname,'definition',pg_get_constraintdef(k.oid))) FROM pg_constraint k WHERE k.conrelid=r.oid),
 'api_privileges',(SELECT jsonb_agg(jsonb_build_object('role',v.rolname,'select',has_table_privilege(v.oid,r.oid,'SELECT'),'insert',has_table_privilege(v.oid,r.oid,'INSERT'),'column_insert',has_any_column_privilege(v.oid,r.oid,'INSERT'),'update',has_table_privilege(v.oid,r.oid,'UPDATE'),'column_update',has_any_column_privilege(v.oid,r.oid,'UPDATE'),'delete',has_table_privilege(v.oid,r.oid,'DELETE'))) FROM pg_roles v WHERE v.rolname IN ('anon','authenticated') AND r.oid IS NOT NULL)
 ) ORDER BY r.name) FROM relations r),
 'auth_person_foreign_keys',(SELECT jsonb_agg(jsonb_build_object('table',n.nspname||'.'||c.relname,'name',k.conname,'definition',pg_get_constraintdef(k.oid))) FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE k.contype='f' AND n.nspname='public' AND (k.confrelid IN (to_regclass('auth.users'),to_regclass('public.event_people'),to_regclass('public.people')))),
 'functions',(SELECT jsonb_agg(jsonb_build_object('name',p.proname,'arguments',pg_get_function_identity_arguments(p.oid),'result',pg_get_function_result(p.oid),'owner',v.rolname,'owner_bypassrls',v.rolbypassrls,'owner_super',v.rolsuper,'definer',p.prosecdef,'settings',p.proconfig,'acl',p.proacl,'definition',pg_get_functiondef(p.oid),
 'api_execute',(SELECT jsonb_agg(jsonb_build_object('role',x.rolname,'execute',has_function_privilege(x.oid,p.oid,'EXECUTE'))) FROM pg_roles x WHERE x.rolname IN ('anon','authenticated')))
 ORDER BY p.proname,pg_get_function_identity_arguments(p.oid)) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_roles v ON v.oid=p.proowner WHERE n.nspname='public' AND p.prokind='f' AND p.proname IN ('link_event_person','record_event_participation','manage_event_session','record_session_attendance','manage_person','history_can_create_review','history_manage_participant','validate_history_review')),
 'policies',(SELECT jsonb_agg(jsonb_build_object('table',schemaname||'.'||tablename,'name',policyname,'roles',roles,'command',cmd,'permissive',permissive,'using',qual,'check',with_check) ORDER BY schemaname,tablename,policyname) FROM pg_policies WHERE (schemaname='public' AND tablename IN (SELECT name FROM wanted)) OR (schemaname='storage' AND tablename='objects')),
 'storage_table',(SELECT jsonb_build_object('rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,'owner',pg_get_userbyid(c.relowner),'acl',c.relacl) FROM pg_class c WHERE c.oid=to_regclass('storage.objects')),
 'buckets',(SELECT jsonb_agg(jsonb_build_object('id',id,'private',NOT public,'limit',file_size_limit,'mime',allowed_mime_types) ORDER BY id) FROM storage.buckets WHERE id IN ('history-review-photos','history-simple-photos','people-photos')),
 'default_acls',(SELECT jsonb_agg(jsonb_build_object('owner',pg_get_userbyid(d.defaclrole),'schema',n.nspname,'object_type',d.defaclobjtype,'acl',d.defaclacl)) FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace WHERE n.nspname='public' OR d.defaclnamespace=0)
) AS catalogue;
COMMIT;
