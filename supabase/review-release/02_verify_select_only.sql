-- SELECT ONLY. Confirm Production qkhlvdctdcpfyvohhikl manually.
-- Catalog and bucket configuration only; no user rows or application RPC calls.
SELECT jsonb_build_object(
 'tables',(SELECT jsonb_agg(jsonb_build_object('name',x.name,'exists',c.oid IS NOT NULL,'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,'owner',pg_get_userbyid(c.relowner))) FROM unnest(ARRAY['history_reviews','history_participant_links','history_participant_audit']) x(name) LEFT JOIN pg_namespace n ON n.nspname='public' LEFT JOIN pg_class c ON c.relnamespace=n.oid AND c.relname=x.name),
 'function_presence',(SELECT jsonb_agg(jsonb_build_object('name',x.name,'exists',to_regprocedure(x.name) IS NOT NULL)) FROM unnest(ARRAY['public.history_can_create_review()','public.history_manage_participant(uuid,uuid,text,integer,boolean,text,uuid,text)','public.validate_history_review()','public.history_admin_review_context(uuid,uuid)','public.history_admin_find_review_member(text)']) x(name)),
 'functions',(SELECT jsonb_agg(jsonb_build_object('name',p.proname,'arguments',pg_get_function_identity_arguments(p.oid),'acl',p.proacl,'authenticated_grant_option',has_function_privilege('authenticated',p.oid,concat_ws(' ', 'EXECUTE', 'WITH', 'GRANT', 'OPTION')),'service_role_execute',has_function_privilege('service_role',p.oid,'EXECUTE'),'owner',pg_get_userbyid(p.proowner),'definer',p.prosecdef,'settings',p.proconfig,'anon_execute',has_function_privilege('anon',p.oid,'EXECUTE'),'authenticated_execute',has_function_privilege('authenticated',p.oid,'EXECUTE'))) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('history_can_create_review','history_manage_participant','validate_history_review','history_admin_review_context','history_admin_find_review_member')),
 'policies',(SELECT jsonb_agg(jsonb_build_object('table',schemaname||'.'||tablename,'name',policyname,'roles',roles,'command',cmd,'permissive',permissive,'using',qual,'check',with_check)) FROM pg_policies WHERE (schemaname='public' AND tablename IN ('history_reviews','history_participant_links','history_participant_audit')) OR (schemaname='storage' AND tablename='objects' AND policyname LIKE 'hrv2_%')),
 'table_privileges',(SELECT jsonb_agg(jsonb_build_object('table',x.name,'role',r.rolname,
 'select',has_table_privilege(r.oid,to_regclass('public.'||x.name),'SELECT'),
 'insert',has_table_privilege(r.oid,to_regclass('public.'||x.name),'INSERT'),
 'update',has_table_privilege(r.oid,to_regclass('public.'||x.name),'UPDATE'),
 'delete',has_table_privilege(r.oid,to_regclass('public.'||x.name),'DELETE'),
 'other_or_grant_option',has_table_privilege(r.oid,to_regclass('public.'||x.name),'TRUNCATE,REFERENCES,TRIGGER,SELECT WITH GRANT OPTION,INSERT WITH GRANT OPTION,UPDATE WITH GRANT OPTION,DELETE WITH GRANT OPTION')))
 FROM unnest(ARRAY['history_reviews','history_participant_links','history_participant_audit']) x(name) CROSS JOIN pg_roles r WHERE r.rolname IN ('anon','authenticated','service_role')),
 'column_privileges',(SELECT jsonb_agg(jsonb_build_object('table',c.relname,'column',a.attname,'role',r.rolname,
 'select',has_column_privilege(r.oid,c.oid,a.attnum,'SELECT'),'insert',has_column_privilege(r.oid,c.oid,a.attnum,'INSERT'),
 'update',has_column_privilege(r.oid,c.oid,a.attnum,'UPDATE'),'references',has_column_privilege(r.oid,c.oid,a.attnum,'REFERENCES'),
 'grant_option',has_column_privilege(r.oid,c.oid,a.attnum,'SELECT WITH GRANT OPTION,INSERT WITH GRANT OPTION,UPDATE WITH GRANT OPTION,REFERENCES WITH GRANT OPTION')))
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid CROSS JOIN pg_roles r
 WHERE n.nspname='public' AND c.relname IN ('history_reviews','history_participant_links','history_participant_audit') AND a.attnum>0 AND NOT a.attisdropped AND r.rolname IN ('anon','authenticated','service_role')),
 'bucket',(SELECT jsonb_build_object('private',NOT public,'size',file_size_limit,'mime',allowed_mime_types) FROM storage.buckets WHERE id='history-review-photos')
);
