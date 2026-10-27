-- PREPARED, NOT EXECUTED. Confirm qkhlvdctdcpfyvohhikl and install reviewed 01 first.
-- Adds ONE read-only administrator RPC; no existing tables, records or policies changed.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $$ BEGIN
 IF current_user<>'postgres' OR NOT EXISTS(SELECT FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls)) THEN RAISE EXCEPTION 'STOP: existing postgres owner required'; END IF;
 IF to_regclass('public.history_participant_links') IS NULL OR to_regclass('public.history_participant_audit') IS NULL THEN RAISE EXCEPTION 'STOP: install reviewed review schema first'; END IF;
 IF EXISTS(SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='history_admin_review_context') THEN RAISE EXCEPTION 'STOP: RPC collision'; END IF;
END $$;
CREATE FUNCTION public.history_admin_review_context(p_user uuid,p_person uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT FROM public.admin_users WHERE user_id=auth.uid()) THEN
 RAISE EXCEPTION 'Administrator required' USING ERRCODE='42501'; END IF;
 IF p_user IS NULL OR p_person IS NULL THEN RAISE EXCEPTION 'Exact verified identities required'; END IF;
 SELECT jsonb_build_object(
 'member',jsonb_build_object('id',u.id,'email',u.email,'confirmed',u.email_confirmed_at IS NOT NULL),
 'person',jsonb_build_object('id',p.id,'name',p.name,'contact',p.contact),
 'link',(SELECT jsonb_build_object('person_id',l.person_id,'revision',l.revision,'status',l.status) FROM public.history_participant_links l WHERE l.user_id=p_user),
 'audit',coalesce((SELECT jsonb_agg(to_jsonb(a)) FROM (SELECT revision,action,reason,created_at FROM public.history_participant_audit WHERE user_id=p_user ORDER BY revision DESC LIMIT 20) a),'[]'::jsonb),
 'evidence',coalesce((SELECT jsonb_agg(to_jsonb(q)) FROM (
 SELECT t.source,t.application_id AS application,e.title,e.starts_at,t.confirmation,t.attendance,
 coalesce((SELECT jsonb_agg(to_jsonb(sd)) FROM (
 SELECT s.session_date,d.attendance FROM public.event_session_attendance d
 JOIN public.event_sessions s ON s.id=d.session_id AND s.event_id=d.event_id
 WHERE d.event_id=t.event_id AND d.source=t.source AND d.application_id=t.application_id
 ORDER BY s.session_date DESC,s.id LIMIT 20) sd),'[]'::jsonb) AS sessions,
 NOT EXISTS(SELECT FROM public.event_application_admin_list a WHERE a.event_id=t.event_id AND a.source=t.source AND a.id=t.application_id AND NOT a.is_archived) AS archived,
 coalesce(t.confirmation='confirmed' AND NOT e.is_test
 AND EXISTS(SELECT FROM public.event_application_admin_list a WHERE a.event_id=t.event_id AND a.source=t.source AND a.id=t.application_id AND NOT a.is_archived)
 AND ((NOT EXISTS(SELECT FROM public.event_sessions z WHERE z.event_id=e.id)
 AND e.starts_at IS NOT NULL AND e.starts_at<=CURRENT_TIMESTAMP AND t.attendance='attended')
 OR EXISTS(SELECT FROM public.event_session_attendance d JOIN public.event_sessions s ON s.id=d.session_id AND s.event_id=d.event_id
 WHERE d.event_id=t.event_id AND d.source=t.source AND d.application_id=t.application_id AND d.attendance='attended' AND s.session_date<=(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date)),false) AS eligible
 FROM public.event_participation t JOIN public.recruitment_events e ON e.id=t.event_id WHERE t.person_id=p_person ORDER BY e.starts_at DESC NULLS LAST,t.source,t.application_id LIMIT 100
 ) q),'[]'::jsonb)) INTO result FROM auth.users u CROSS JOIN public.event_people p WHERE u.id=p_user AND p.id=p_person;
 IF result IS NULL THEN RAISE EXCEPTION 'Member or participant not found'; END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.history_admin_review_context(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.history_admin_review_context(uuid,uuid) TO authenticated;
DO $$ BEGIN
 IF NOT EXISTS(SELECT FROM pg_proc WHERE oid='public.history_admin_review_context(uuid,uuid)'::regprocedure AND proowner='postgres'::regrole AND prosecdef AND 'search_path=""'=ANY(proconfig))
 OR has_function_privilege('anon','public.history_admin_review_context(uuid,uuid)','EXECUTE')
 OR has_function_privilege('service_role','public.history_admin_review_context(uuid,uuid)','EXECUTE') THEN RAISE EXCEPTION 'STOP: read RPC boundary mismatch'; END IF;
END $$;
COMMIT;
