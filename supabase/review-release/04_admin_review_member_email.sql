-- PREPARED, NOT EXECUTED. Confirm Production qkhlvdctdcpfyvohhikl manually.
-- Read-only exact-email lookup for existing administrators. No table/RLS/data changes.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $$ BEGIN
 IF current_user<>'postgres' OR NOT EXISTS(SELECT FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls)) THEN RAISE EXCEPTION 'STOP: existing postgres owner required'; END IF;
 IF to_regclass('public.admin_users') IS NULL OR to_regclass('auth.users') IS NULL THEN RAISE EXCEPTION 'STOP: existing Auth/admin dependencies missing'; END IF;
 IF EXISTS(SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='history_admin_find_review_member') THEN RAISE EXCEPTION 'STOP: RPC name collision'; END IF;
END $$;
CREATE FUNCTION public.history_admin_find_review_member(p_email text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE matches bigint;result jsonb;
BEGIN
 -- Authorization precedes validation and any account lookup (including not-found).
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT FROM public.admin_users WHERE user_id=auth.uid()) THEN
 RAISE EXCEPTION 'Administrator required' USING ERRCODE='42501'; END IF;
 IF p_email IS NULL OR length(p_email)>254 OR p_email<>btrim(p_email)
 OR p_email !~ '^[^[:space:]@,;]+@[^[:space:]@,;]+\.[^[:space:]@,;]+$' THEN
 RAISE EXCEPTION 'One exact email required' USING ERRCODE='22023'; END IF;
 -- Supabase Auth normalizes and looks up LOWER(email). Compare the full
 -- normalized email, never LIKE/ILIKE; reject all ambiguous case variants.
 -- This normalization never creates a participant link or approval.
 SELECT count(*) INTO matches FROM auth.users u WHERE lower(u.email::text)=lower(p_email);
 IF matches>1 THEN RAISE EXCEPTION 'Ambiguous account; no member selected' USING ERRCODE='21000'; END IF;
 IF matches=0 THEN RETURN NULL; END IF;
 SELECT jsonb_build_object('id',u.id,'email',u.email,'confirmed',u.email_confirmed_at IS NOT NULL)
 INTO result FROM auth.users u WHERE lower(u.email::text)=lower(p_email);
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.history_admin_find_review_member(text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.history_admin_find_review_member(text) TO authenticated;
DO $$ BEGIN
 IF NOT EXISTS(SELECT FROM pg_proc WHERE oid='public.history_admin_find_review_member(text)'::regprocedure AND proowner='postgres'::regrole AND prosecdef AND 'search_path=""'=ANY(proconfig))
 OR has_function_privilege('anon','public.history_admin_find_review_member(text)','EXECUTE')
 OR has_function_privilege('service_role','public.history_admin_find_review_member(text)','EXECUTE')
 OR NOT has_function_privilege('authenticated','public.history_admin_find_review_member(text)','EXECUTE') THEN RAISE EXCEPTION 'STOP: email lookup RPC boundary mismatch'; END IF;
END $$;
COMMIT;
