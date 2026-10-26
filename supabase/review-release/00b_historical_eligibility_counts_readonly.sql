-- READ ONLY / NOT EXECUTED. Select Production qkhlvdctdcpfyvohhikl first.
-- Counts only. No identities, contacts, dates, titles, account IDs or participant IDs returned.
-- Evidence eligibility only: Auth identity verification/approval is still separate.
-- Missing historical records cannot be detected as real attendance by any catalogue query.
BEGIN READ ONLY;
DO $$ BEGIN
 IF current_user<>'postgres' OR NOT EXISTS(SELECT FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls)) THEN
 RAISE EXCEPTION 'STOP: aggregate reader must see complete existing RLS-protected records'; END IF;
END $$;
-- Populate ONLY independently verified cohort/event mappings. Do not infer cohort
-- from year, title or preferred_class. Empty mapping keeps records unclassified.
WITH cohort_map(cohort,event_id) AS (SELECT NULL::integer,NULL::uuid WHERE false),
evidence AS (
 SELECT t.event_id,t.person_id,t.source,t.confirmation,t.attendance,
 e.id IS NOT NULL AS event_exists,e.is_test,
 EXISTS(SELECT FROM public.event_application_admin_list a
 WHERE a.event_id=t.event_id AND a.source=t.source AND a.id=t.application_id) AS application_exists,
 EXISTS(SELECT FROM public.event_application_admin_list a
 WHERE a.event_id=t.event_id AND a.source=t.source AND a.id=t.application_id AND NOT a.is_archived) AS active_application,
 EXISTS(SELECT FROM public.event_sessions z WHERE z.event_id=e.id) AS has_sessions,
 e.starts_at IS NOT NULL AND e.starts_at<=CURRENT_TIMESTAMP AS event_has_started,
 EXISTS(SELECT FROM public.event_session_attendance d
 JOIN public.event_sessions s ON s.id=d.session_id AND s.event_id=d.event_id
 WHERE d.event_id=t.event_id AND d.source=t.source AND d.application_id=t.application_id
 AND d.attendance='attended' AND s.session_date<=(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date) AS past_session_attended
 FROM public.event_participation t LEFT JOIN public.recruitment_events e ON e.id=t.event_id
), evaluated AS (
 SELECT *,coalesce(event_exists AND confirmation='confirmed' AND NOT is_test AND active_application
 AND ((NOT has_sessions AND event_has_started AND attendance='attended') OR past_session_attended),false) AS eligible
 FROM evidence
), people AS (
 SELECT person_id,bool_or(eligible) AS any_eligible FROM evaluated WHERE person_id IS NOT NULL GROUP BY person_id
)
SELECT jsonb_build_object(
 'cohort_counts',(SELECT jsonb_agg(to_jsonb(c)) FROM (
 SELECT m.cohort,count(*) AS participation_records,count(*) FILTER(WHERE v.eligible) AS eligible_records,
 count(DISTINCT v.person_id) AS recorded_people,count(DISTINCT v.person_id) FILTER(WHERE v.eligible) AS eligible_people,
 count(*) FILTER(WHERE NOT v.eligible AND v.application_exists AND NOT v.active_application) AS excluded_archived_records,
 count(*) FILTER(WHERE NOT v.eligible AND v.has_sessions AND v.attendance='attended' AND NOT v.past_session_attended) AS excluded_event_only_attendance
 FROM evaluated v LEFT JOIN cohort_map m ON m.event_id=v.event_id GROUP BY m.cohort ORDER BY m.cohort NULLS LAST
 ) c),
 'people_with_records',(SELECT count(*) FROM people),
 'people_with_any_eligible_evidence',(SELECT count(*) FROM people WHERE any_eligible),
 'people_without_eligible_evidence',(SELECT count(*) FROM people WHERE NOT any_eligible),
 'event_people_without_participation',(SELECT count(*) FROM public.event_people p WHERE NOT EXISTS(SELECT FROM public.event_participation t WHERE t.person_id=p.id)),
 'participation_records',(SELECT count(*) FROM evaluated),
 'eligible_records',(SELECT count(*) FROM evaluated WHERE eligible),
 -- Exclusion reasons overlap: never sum them or treat them as proof of actual non-attendance.
 'excluded_confirmed_event_attended_records',(SELECT count(*) FROM evaluated WHERE confirmation='confirmed' AND attendance='attended' AND NOT eligible),
 'excluded_past_session_attended_records',(SELECT count(*) FROM evaluated WHERE past_session_attended AND NOT eligible),
 'excluded_with_archived_application',(SELECT count(*) FROM evaluated WHERE NOT eligible AND application_exists AND NOT active_application),
 'excluded_missing_application',(SELECT count(*) FROM evaluated WHERE NOT eligible AND NOT application_exists),
 'excluded_not_confirmed',(SELECT count(*) FROM evaluated WHERE NOT eligible AND confirmation IS DISTINCT FROM 'confirmed'),
 'excluded_test_or_unknown_event',(SELECT count(*) FROM evaluated WHERE NOT eligible AND (NOT event_exists OR is_test IS DISTINCT FROM false)),
 'excluded_sessions_exist_but_only_event_attendance',(SELECT count(*) FROM evaluated WHERE NOT eligible AND has_sessions AND attendance='attended' AND NOT past_session_attended),
 'excluded_no_session_and_unknown_or_future_start',(SELECT count(*) FROM evaluated WHERE NOT eligible AND NOT has_sessions AND event_has_started IS DISTINCT FROM true),
 'excluded_no_person_link',(SELECT count(*) FROM evaluated WHERE NOT eligible AND person_id IS NULL),
 'unmapped_evidence_source',(SELECT count(*) FROM evaluated WHERE eligible AND source NOT IN ('season9','registration','manual'))
) AS historical_review_evidence_counts;
COMMIT;
