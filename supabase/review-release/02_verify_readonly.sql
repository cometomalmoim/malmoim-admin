-- FUTURE post-install check only. Not executed in preparation phase.
BEGIN READ ONLY;
SELECT jsonb_build_object(
 'tables',(SELECT jsonb_agg(jsonb_build_object('name',x.name,'exists',c.oid IS NOT NULL,'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,'owner',pg_get_userbyid(c.relowner))) FROM unnest(ARRAY['history_reviews','history_participant_links','history_participant_audit']) x(name) LEFT JOIN pg_namespace n ON n.nspname='public' LEFT JOIN pg_class c ON c.relnamespace=n.oid AND c.relname=x.name),
 'function_presence',(SELECT jsonb_agg(jsonb_build_object('name',x.name,'exists',to_regprocedure(x.name) IS NOT NULL)) FROM unnest(ARRAY['public.history_can_create_review()','public.history_manage_participant(uuid,uuid,text,integer,boolean,text,uuid,text)','public.validate_history_review()','public.history_admin_review_context(uuid,uuid)','public.history_admin_find_review_member(text)']) x(name)),
 'functions',(SELECT jsonb_agg(jsonb_build_object('name',p.proname,'arguments',pg_get_function_identity_arguments(p.oid),'service_role_execute',has_function_privilege('service_role',p.oid,'EXECUTE'),'owner',pg_get_userbyid(p.proowner),'definer',p.prosecdef,'settings',p.proconfig,'anon_execute',has_function_privilege('anon',p.oid,'EXECUTE'),'authenticated_execute',has_function_privilege('authenticated',p.oid,'EXECUTE'))) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('history_can_create_review','history_manage_participant','validate_history_review','history_admin_review_context','history_admin_find_review_member')),
 'policies',(SELECT jsonb_agg(jsonb_build_object('table',schemaname||'.'||tablename,'name',policyname,'roles',roles,'command',cmd,'permissive',permissive,'using',qual,'check',with_check)) FROM pg_policies WHERE (schemaname='public' AND tablename IN ('history_reviews','history_participant_links','history_participant_audit')) OR (schemaname='storage' AND tablename='objects' AND policyname LIKE 'hrv2_%')),
 'bucket',(SELECT jsonb_build_object('private',NOT public,'size',file_size_limit,'mime',allowed_mime_types) FROM storage.buckets WHERE id='history-review-photos')
);
COMMIT;
-- Expected: 3 postgres-owned RLS/FORCE tables; 5 functions after 01 + 03 + 04 (4 definer, trigger invoker),
-- authenticated EXECUTE only on the 4 RPCs; 5 review policies, 0 link/audit policies,
-- 9 new Storage policies; private 1048576-byte JPG/PNG/WebP bucket.
-- Review full policy predicates AND effective ACLs; counts alone are insufficient.
