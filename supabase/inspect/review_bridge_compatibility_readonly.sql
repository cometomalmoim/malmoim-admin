-- READ ONLY. Choose the user-confirmed team project in Dashboard first.
-- No personal records. This reports compatibility; it never installs or approves.
BEGIN READ ONLY;
WITH expected(relation,column_name,type_name) AS (VALUES
 ('auth.users','id','uuid'),('public.admin_users','user_id','uuid'),
 ('public.event_people','id','uuid'),
 ('public.event_participation','person_id','uuid'),('public.event_participation','event_id','uuid'),
 ('public.event_participation','source','text'),('public.event_participation','application_id','uuid'),
 ('public.event_participation','confirmation','text'),('public.event_participation','attendance','text'),
 ('public.recruitment_events','id','uuid'),('public.recruitment_events','is_test','boolean'),('public.recruitment_events','starts_at','timestamp with time zone'),
 ('public.event_sessions','id','uuid'),('public.event_sessions','event_id','uuid'),('public.event_sessions','session_date','date'),
 ('public.event_session_attendance','session_id','uuid'),('public.event_session_attendance','event_id','uuid'),
 ('public.event_session_attendance','source','text'),('public.event_session_attendance','application_id','uuid'),('public.event_session_attendance','attendance','text')),
checks AS (SELECT e.*,a.atttypid,a.attname,format_type(a.atttypid,a.atttypmod) AS actual_type
 FROM expected e LEFT JOIN pg_attribute a ON a.attrelid=to_regclass(e.relation) AND a.attname=e.column_name AND a.attnum>0 AND NOT a.attisdropped)
SELECT jsonb_build_object(
 'columns',(SELECT jsonb_agg(jsonb_build_object('relation',relation,'column',column_name,'exists',attname IS NOT NULL,'expected_type',type_name,'actual_type',actual_type,'type_matches',coalesce(atttypid=to_regtype(type_name),false)) ORDER BY relation,column_name) FROM checks),
 'all_expected_types_match',(SELECT bool_and(coalesce(atttypid=to_regtype(type_name),false)) FROM checks),
 'new_name_collisions',(SELECT jsonb_agg(jsonb_build_object('name',x.name,'exists',to_regclass('public.'||x.name) IS NOT NULL)) FROM unnest(ARRAY['history_reviews','history_participant_links','history_participant_audit','history_participant_evidence']) x(name)),
 'function_collisions',(SELECT jsonb_agg(jsonb_build_object('name',p.proname,'arguments',pg_get_function_identity_arguments(p.oid),'owner',pg_get_userbyid(p.proowner),'settings',p.proconfig)) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('history_can_create_review','history_manage_participant','validate_history_review')),
 'existing_installer_attributes',(SELECT jsonb_build_object('role',rolname,'super',rolsuper,'bypassrls',rolbypassrls) FROM pg_roles WHERE rolname=current_user),
 'storage_acl',(SELECT jsonb_agg(jsonb_build_object('role',r.rolname,'select',has_table_privilege(r.oid,c.oid,'SELECT'),'insert',has_table_privilege(r.oid,c.oid,'INSERT'),'delete',has_table_privilege(r.oid,c.oid,'DELETE'))) FROM pg_class c CROSS JOIN pg_roles r WHERE c.oid=to_regclass('storage.objects') AND r.rolname IN ('anon','authenticated')),
 'bucket_collision',(SELECT count(*)>0 FROM storage.buckets WHERE id='history-review-photos' OR name='history-review-photos')
) AS compatibility;
COMMIT;
