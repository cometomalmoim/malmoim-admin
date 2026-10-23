-- NOT-FOR-EXECUTION / 未承認 / SQL・RPC・同時性・Storage未検証
-- Independent malmoim-review-auth-lab: host API 55421 / DB 55422 ONLY.
-- Do not remove this guard to test. Derive a separately reviewed migration instead.
BEGIN;
DO $$ BEGIN RAISE EXCEPTION 'NOT-FOR-EXECUTION: upload journal draft'; END $$;

-- A future execution wrapper MUST independently verify project config, container ID,
-- host 127.0.0.1:55422 mapping, cluster identity, role ownership/ACL, PG/Storage
-- versions, 001 object definitions, existing policies and protected backup.
-- GUC flags and inet_server_port() behind Docker NAT do NOT prove host/project identity.
DO $$ BEGIN
 IF current_user <> 'postgres'
 OR current_database() <> 'postgres'
 OR to_regclass('public.history_activities') IS NULL
 OR to_regclass('public.history_activity_photos') IS NULL
 OR to_regclass('public.history_activity_commands') IS NULL
 OR to_regclass('public.admin_users') IS NULL
 OR to_regnamespace('history_upload_private') IS NOT NULL
 THEN RAISE EXCEPTION 'Unverified journal prerequisites'; END IF;
 -- These name checks alone are insufficient: definition/owner/ACL/hash comparison
 -- and actual container/role checks remain mandatory in the future wrapper.
END $$;
CREATE SCHEMA history_upload_private;
REVOKE ALL ON SCHEMA history_upload_private FROM PUBLIC,anon,authenticated,service_role;

CREATE TABLE history_upload_private.jobs (
 request_id uuid PRIMARY KEY,
 schema_version smallint NOT NULL DEFAULT 1 CHECK(schema_version=1),
 bucket_id text NOT NULL DEFAULT 'history-activity-photos' CHECK(bucket_id='history-activity-photos'),
 activity_id uuid NOT NULL REFERENCES public.history_activities(id) ON DELETE RESTRICT,
 actor_id uuid NOT NULL, -- audit identity, never cascade on Auth account removal
 fingerprint text NOT NULL CHECK(fingerprint ~ '^[0-9a-f]{64}$'),
 revision bigint NOT NULL DEFAULT 0 CHECK(revision BETWEEN 0 AND 9007199254740991),
 phase text NOT NULL DEFAULT 'claimed' CHECK(phase IN
 ('claimed','reserved','starting','uploading','verifying','ending','succeeded','failed','uncertain','deletion_pending')),
 issue text CHECK(issue IN ('storage_rejected','invalid_file','needs_confirmation','deletion_requested')),
 delete_requested boolean NOT NULL DEFAULT false,
 delete_requested_at timestamptz,
 reserve_id uuid NOT NULL,
 reserve_activity_revision bigint CHECK(reserve_activity_revision>0),
 expected_count integer NOT NULL CHECK(expected_count BETWEEN 1 AND 10),
 completed integer NOT NULL DEFAULT 0 CHECK(completed BETWEEN 0 AND expected_count),
 recovery_required boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 last_confirmed_at timestamptz,
 confirmation_kind text CHECK(confirmation_kind IN
 ('reservation','ticket_issued','storage_terminated','file_verified','ticket_closed')),
 confirmation_slot integer CHECK(confirmation_slot BETWEEN 0 AND 9),
 CHECK(delete_requested=(delete_requested_at IS NOT NULL)),
 CHECK((last_confirmed_at IS NULL)=(confirmation_kind IS NULL)),
 CHECK(NOT delete_requested OR phase IN ('uncertain','deletion_pending')),
 UNIQUE(request_id,activity_id)
);
CREATE TABLE history_upload_private.files (
 request_id uuid NOT NULL,
 activity_id uuid NOT NULL,
 slot integer NOT NULL CHECK(slot BETWEEN 0 AND 9),
 begin_id uuid NOT NULL, end_id uuid NOT NULL,
 -- Original RPC inputs support receipt lookup, never blind replay with a new revision.
 begin_activity_revision bigint, end_activity_revision bigint,
 photo_id uuid UNIQUE, storage_path text, byte_size bigint, mime_type text,
 ticket uuid,
 dispatch_id uuid UNIQUE,
 dispatch text CHECK(dispatch IN ('intent_recorded','invoked')),
 response text NOT NULL DEFAULT 'unknown' CHECK(response IN ('unknown','stored','rejected')),
 verification text NOT NULL DEFAULT 'pending' CHECK(verification IN ('pending','valid','invalid')),
 end_confirmed boolean NOT NULL DEFAULT false,
 intent_at timestamptz, invocation_recorded_at timestamptz,
 response_at timestamptz, verified_at timestamptz, ended_at timestamptz,
 response_evidence uuid, verification_evidence uuid, end_evidence uuid,
 PRIMARY KEY(request_id,slot),
 FOREIGN KEY(request_id,activity_id) REFERENCES history_upload_private.jobs(request_id,activity_id) ON DELETE RESTRICT,
 FOREIGN KEY(activity_id,photo_id) REFERENCES public.history_activity_photos(activity_id,id) ON DELETE RESTRICT,
 CHECK((photo_id IS NULL AND storage_path IS NULL AND byte_size IS NULL AND mime_type IS NULL)
 OR (photo_id IS NOT NULL AND storage_path IS NOT NULL AND byte_size IS NOT NULL AND mime_type IS NOT NULL
 AND byte_size BETWEEN 1 AND 5242880 AND mime_type IN ('image/jpeg','image/png','image/webp')
 AND storage_path=activity_id::text||'/'||photo_id::text||CASE mime_type
 WHEN 'image/jpeg' THEN '.jpg' WHEN 'image/png' THEN '.png' ELSE '.webp' END)),
 CHECK(ticket IS NULL OR photo_id IS NOT NULL),
 CHECK((dispatch_id IS NULL AND dispatch IS NULL AND intent_at IS NULL)
 OR (dispatch_id IS NOT NULL AND dispatch IS NOT NULL AND intent_at IS NOT NULL AND ticket IS NOT NULL)),
 CHECK((dispatch IS NOT DISTINCT FROM 'invoked')=(invocation_recorded_at IS NOT NULL)),
 CHECK(response='unknown' OR dispatch IS NOT DISTINCT FROM 'invoked'),
 CHECK((response='unknown')=(response_at IS NULL)),
 CHECK((response='unknown')=(response_evidence IS NULL)),
 CHECK(verification='pending' OR response='stored'),
 CHECK((verification='valid')=(verified_at IS NOT NULL)),
 CHECK((verification='pending')=(verification_evidence IS NULL)),
 CHECK(NOT end_confirmed OR response<>'unknown'),
 CHECK(end_confirmed=(ended_at IS NOT NULL)), CHECK(end_confirmed=(end_evidence IS NOT NULL))
);
CREATE TABLE history_upload_private.events (
 event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_id uuid NOT NULL REFERENCES history_upload_private.jobs(request_id) ON DELETE RESTRICT,
 revision bigint NOT NULL, kind text NOT NULL CHECK(kind IN
 ('claim','reserve','ticket','starting','intent','invoked','response','verification','end','complete','fail','uncertain','delete')),
 slot integer, evidence_ref uuid,
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(request_id,revision),
 FOREIGN KEY(request_id,slot) REFERENCES history_upload_private.files(request_id,slot) ON DELETE RESTRICT
);
CREATE INDEX upload_jobs_recovery ON history_upload_private.jobs(created_at,request_id)
 WHERE recovery_required OR delete_requested OR phase NOT IN ('succeeded','failed');
CREATE INDEX upload_jobs_activity ON history_upload_private.jobs(activity_id,request_id);
CREATE INDEX upload_files_photo ON history_upload_private.files(photo_id);
-- No permissive policies; all direct access denied. Definer functions must validate too.
ALTER TABLE history_upload_private.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE history_upload_private.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE history_upload_private.events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA history_upload_private FROM PUBLIC,anon,authenticated,service_role;

-- HARD CLOSED. No role, credential, GUC or caller-supplied boolean activates this.
-- p_report separates server evidence capability from ordinary administrator identity.
-- A future reviewed authentication design must replace this in a NEW migration.
CREATE FUNCTION history_upload_private.require_server(p_actor uuid,p_report boolean)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.admin_users WHERE user_id=p_actor)
 THEN RAISE EXCEPTION 'Administrator required' USING ERRCODE='42501'; END IF;
 RAISE EXCEPTION 'Server authentication/report capability unresolved; disabled' USING ERRCODE='42501';
END $$;

CREATE FUNCTION history_upload_private.claim(
 p_actor uuid,p_request uuid,p_activity uuid,p_fingerprint text,p_reserve uuid,p_begin uuid[],p_end uuid[])
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a public.history_activities%ROWTYPE; old history_upload_private.jobs%ROWTYPE;
 n integer; affected integer;
BEGIN
 PERFORM history_upload_private.require_server(p_actor,false);
 n:=cardinality(p_begin);
 IF n IS NULL OR n NOT BETWEEN 1 AND 10 OR cardinality(p_end) IS DISTINCT FROM n
 OR array_ndims(p_begin) IS DISTINCT FROM 1 OR array_ndims(p_end) IS DISTINCT FROM 1
 OR array_lower(p_begin,1)<>1 OR array_lower(p_end,1)<>1
 OR p_request IS NULL OR p_reserve IS NULL
 OR EXISTS(SELECT 1 FROM unnest(p_begin||p_end) x WHERE x IS NULL)
 OR (SELECT count(DISTINCT x) FROM unnest(ARRAY[p_reserve]||p_begin||p_end) x)<>1+2*n
 THEN RAISE EXCEPTION 'Invalid claim'; END IF;
 SELECT * INTO a FROM public.history_activities WHERE id=p_activity FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Activity unavailable'; END IF;
 -- Serializes operation-ID cross-column checks among journal claims only.
 PERFORM pg_catalog.pg_advisory_xact_lock(72731041);
 SELECT * INTO old FROM history_upload_private.jobs WHERE request_id=p_request;
 IF FOUND THEN
   IF old.actor_id<>p_actor OR old.activity_id<>p_activity OR old.fingerprint<>p_fingerprint
   THEN RAISE EXCEPTION 'Request conflict'; END IF;
   RETURN false; -- existing is inspect-only, never dispatch permission
 END IF;
 IF a.lifecycle IN ('deleting','deleted') OR a.delete_requested_at IS NOT NULL
 THEN RAISE EXCEPTION 'Deletion pending'; END IF;
 IF EXISTS(SELECT 1 FROM history_upload_private.jobs j WHERE j.actor_id=p_actor AND j.reserve_id=ANY(ARRAY[p_reserve]||p_begin||p_end))
 OR EXISTS(SELECT 1 FROM history_upload_private.files f JOIN history_upload_private.jobs j USING(request_id)
 WHERE j.actor_id=p_actor AND (f.begin_id=ANY(ARRAY[p_reserve]||p_begin||p_end) OR f.end_id=ANY(ARRAY[p_reserve]||p_begin||p_end)))
 OR EXISTS(SELECT 1 FROM public.history_activity_commands c WHERE c.actor=p_actor AND c.request_id=ANY(ARRAY[p_reserve]||p_begin||p_end))
 THEN RAISE EXCEPTION 'Operation identity conflict'; END IF;
 INSERT INTO history_upload_private.jobs(request_id,activity_id,actor_id,fingerprint,reserve_id,expected_count)
 VALUES(p_request,p_activity,p_actor,p_fingerprint,p_reserve,n) ON CONFLICT(request_id) DO NOTHING;
 GET DIAGNOSTICS affected=ROW_COUNT;
 IF affected<>1 THEN RAISE EXCEPTION 'Concurrent request conflict; inspect separately'; END IF;
 INSERT INTO history_upload_private.files(request_id,activity_id,slot,begin_id,end_id)
 SELECT p_request,p_activity,i-1,p_begin[i],p_end[i] FROM generate_series(1,n) i;
 INSERT INTO history_upload_private.events(request_id,revision,kind) VALUES(p_request,0,'claim');
 RETURN true;
END $$;

-- Typed command CAS rather than accepting an arbitrary UploadRecord overwrite.
-- Adapter mapping and full transition tests are prerequisites, not implemented here.
CREATE FUNCTION history_upload_private.cas(p_actor uuid,p_request uuid,p_revision bigint,
 p_action text,p_slot integer DEFAULT NULL,p_dispatch uuid DEFAULT NULL,p_photo uuid DEFAULT NULL,
 p_ticket uuid DEFAULT NULL,p_activity_revision bigint DEFAULT NULL)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j history_upload_private.jobs%ROWTYPE; a public.history_activities%ROWTYPE;
 f history_upload_private.files%ROWTYPE; p public.history_activity_photos%ROWTYPE;
 aid uuid; t timestamptz:=clock_timestamp();
BEGIN
 PERFORM history_upload_private.require_server(p_actor,false);
 SELECT activity_id INTO aid FROM history_upload_private.jobs WHERE request_id=p_request AND actor_id=p_actor;
 IF NOT FOUND THEN RAISE EXCEPTION 'Job unavailable'; END IF;
 SELECT * INTO a FROM public.history_activities WHERE id=aid FOR UPDATE;
 SELECT * INTO j FROM history_upload_private.jobs WHERE request_id=p_request FOR UPDATE;
 IF j.revision<>p_revision THEN RETURN false; END IF;
 IF p_action IS NULL OR p_action NOT IN ('reserve','ticket','starting','intent','invoked','complete','fail','uncertain','delete')
 THEN RAISE EXCEPTION 'Invalid CAS action'; END IF;
 IF j.phase IN ('succeeded','failed','uncertain','deletion_pending') AND p_action NOT IN ('uncertain','delete')
 THEN RAISE EXCEPTION 'Recovery required; no automatic replay'; END IF;
 IF (j.delete_requested OR a.lifecycle IN ('deleting','deleted') OR a.delete_requested_at IS NOT NULL
 OR EXISTS(SELECT 1 FROM public.history_activity_photos WHERE activity_id=aid AND state IN ('delete_wait','deleting')))
 AND p_action NOT IN ('uncertain','delete') THEN RAISE EXCEPTION 'Deletion pending'; END IF;
 IF p_slot IS NOT NULL THEN
   SELECT * INTO f FROM history_upload_private.files WHERE request_id=p_request AND slot=p_slot;
   IF NOT FOUND THEN RAISE EXCEPTION 'Invalid slot'; END IF;
 END IF;
 IF p_action='reserve' THEN
   IF p_slot IS NULL OR f.photo_id IS NOT NULL OR j.phase NOT IN ('claimed','reserved')
   THEN RAISE EXCEPTION 'Invalid reservation'; END IF;
   SELECT * INTO p FROM public.history_activity_photos WHERE activity_id=aid AND id=p_photo;
   IF NOT FOUND OR p.state<>'pending' OR p.upload_in_flight THEN RAISE EXCEPTION 'Reservation mismatch'; END IF;
   UPDATE history_upload_private.files SET photo_id=p.id,storage_path=p.storage_path,byte_size=p.byte_size,mime_type=p.mime_type
   WHERE request_id=p_request AND slot=p_slot;
 ELSIF p_action='ticket' THEN
   IF p_slot IS NULL OR f.ticket IS NOT NULL OR p_ticket IS NULL OR p_activity_revision IS NULL OR p_activity_revision<1
   OR NOT EXISTS(SELECT 1 FROM public.history_activity_photos WHERE activity_id=aid AND id=f.photo_id
   AND upload_in_flight AND upload_ticket=p_ticket AND state='pending')
   THEN RAISE EXCEPTION 'Ticket mismatch'; END IF;
   UPDATE history_upload_private.files SET ticket=p_ticket,begin_activity_revision=p_activity_revision WHERE request_id=p_request AND slot=p_slot;
 ELSIF p_action='starting' THEN
   IF p_slot IS NULL OR f.photo_id IS NULL OR f.dispatch_id IS NOT NULL OR p_slot<>j.completed
   THEN RAISE EXCEPTION 'Invalid starting state'; END IF;
 ELSIF p_action='intent' THEN
   IF p_slot IS NULL OR p_slot<>j.completed OR f.ticket IS NULL OR f.dispatch_id IS NOT NULL OR p_dispatch IS NULL
   THEN RAISE EXCEPTION 'Dispatch already recorded or ticket missing'; END IF;
   UPDATE history_upload_private.files SET dispatch_id=p_dispatch,dispatch='intent_recorded',intent_at=t WHERE request_id=p_request AND slot=p_slot;
 ELSIF p_action='invoked' THEN
   IF p_slot IS NULL OR f.dispatch IS DISTINCT FROM 'intent_recorded' OR p_dispatch IS DISTINCT FROM f.dispatch_id
   THEN RAISE EXCEPTION 'Invalid invocation'; END IF;
   UPDATE history_upload_private.files SET dispatch='invoked',invocation_recorded_at=t WHERE request_id=p_request AND slot=p_slot;
 ELSIF p_action='complete' THEN
   IF EXISTS(SELECT 1 FROM history_upload_private.files WHERE request_id=p_request
   AND (response<>'stored' OR verification<>'valid' OR NOT end_confirmed))
   THEN RAISE EXCEPTION 'Completion evidence required'; END IF;
 ELSIF p_action='fail' THEN
   IF NOT EXISTS(SELECT 1 FROM history_upload_private.files WHERE request_id=p_request AND end_confirmed
   AND (response='rejected' OR (response='stored' AND verification='invalid')))
   THEN RAISE EXCEPTION 'Failure evidence required'; END IF;
 END IF;
 IF EXISTS(SELECT 1 FROM history_upload_private.files WHERE request_id=p_request GROUP BY request_id
 HAVING count(*)<>j.expected_count OR coalesce(sum(byte_size),0)>52428800)
 OR EXISTS(SELECT 1 FROM public.history_activity_photos WHERE activity_id=aid AND state<>'deleted'
 GROUP BY activity_id HAVING count(*)>10 OR sum(byte_size)>52428800)
 THEN RAISE EXCEPTION 'Photo limit exceeded'; END IF;
 UPDATE history_upload_private.jobs SET revision=revision+1,updated_at=t,
 phase=CASE p_action WHEN 'reserve' THEN 'reserved' WHEN 'starting' THEN 'starting'
 WHEN 'ticket' THEN 'uploading' WHEN 'complete' THEN 'succeeded' WHEN 'fail' THEN 'failed'
 WHEN 'uncertain' THEN 'uncertain' WHEN 'delete' THEN 'deletion_pending' ELSE phase END,
 issue=CASE p_action WHEN 'uncertain' THEN 'needs_confirmation' WHEN 'delete' THEN 'deletion_requested' ELSE issue END,
 delete_requested=delete_requested OR p_action='delete',
 delete_requested_at=CASE WHEN p_action='delete' THEN coalesce(delete_requested_at,t) ELSE delete_requested_at END,
 recovery_required=p_action NOT IN ('complete','fail'),
 completed=CASE WHEN p_action='complete' THEN expected_count ELSE completed END
 WHERE request_id=p_request;
 INSERT INTO history_upload_private.events(request_id,revision,kind,slot)
 VALUES(p_request,j.revision+1,p_action,p_slot);
 RETURN true;
END $$;

-- End report is deliberately hard-blocked independently of the general server gate.
-- Evidence UUIDs are references, not cryptographic proof. No caller can activate this.
CREATE FUNCTION history_upload_private.report(p_actor uuid,p_request uuid,p_revision bigint,
 p_slot integer,p_kind text,p_evidence uuid,p_outcome text DEFAULT NULL,p_activity_revision bigint DEFAULT NULL)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM history_upload_private.require_server(p_actor,true);
 RAISE EXCEPTION 'NOT IMPLEMENTED: authenticated evidence provenance and command receipt validation required';
 -- Future reviewed implementation: parent activity -> job locks; exact CAS; bind
 -- dispatch ID + ticket + photo + server identity; append event in same transaction.
 -- response: only verified termination, never timeout -> rejected.
 -- verification: stored response plus actual content/length/MIME/decoding evidence.
 -- end: original command receipt and matching SQL ticket termination required.
 -- confirmation timestamps are DB generated ONLY when validated facts are accepted.
 -- verified response+file validation updates last_confirmed_at/kind/slot atomically.
 -- completed advances only for a contiguous prefix with stored+valid+end_confirmed.
 -- No SQL metadata/file presence alone proves request termination.
END $$;

CREATE FUNCTION history_upload_private.recovery_page(p_actor uuid,p_before timestamptz,
 p_after_time timestamptz DEFAULT NULL,p_after_id uuid DEFAULT NULL,p_limit integer DEFAULT 100)
 RETURNS SETOF history_upload_private.jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM history_upload_private.require_server(p_actor,false);
 IF p_before IS NULL OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100
 OR (p_after_time IS NULL)<>(p_after_id IS NULL) THEN RAISE EXCEPTION 'Invalid recovery cursor'; END IF;
 RETURN QUERY SELECT j.* FROM history_upload_private.jobs j
 WHERE j.actor_id=p_actor AND j.created_at<=p_before
 AND (p_after_time IS NULL OR (j.created_at,j.request_id)>(p_after_time,p_after_id))
 AND (j.recovery_required OR j.delete_requested OR j.phase NOT IN ('succeeded','failed'))
 ORDER BY j.created_at,j.request_id LIMIT p_limit;
 -- This is inspection, never dispatch permission. Revoked-admin handover is absent.
 -- Concurrent changes behind a cursor require repeated scans; this is not MVCC snapshot pagination.
END $$;
CREATE FUNCTION history_upload_private.get_job(p_actor uuid,p_request uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 PERFORM history_upload_private.require_server(p_actor,false);
 SELECT jsonb_build_object('job',to_jsonb(j),'files',
 (SELECT coalesce(jsonb_agg(to_jsonb(f) ORDER BY slot),'[]'::jsonb) FROM history_upload_private.files f WHERE f.request_id=j.request_id))
 INTO result FROM history_upload_private.jobs j WHERE request_id=p_request AND actor_id=p_actor;
 IF NOT FOUND THEN RAISE EXCEPTION 'Job unavailable'; END IF;
 RETURN result; -- server-only normalized result, not a browser payload
END $$;

-- No GRANT, role creation, owner switch, default privilege mutation or Storage DML.
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA history_upload_private FROM PUBLIC,anon,authenticated,service_role;
-- All SECURITY DEFINER owners would be the verified execution owner; actual ACL and
-- ownership must be rechecked. Owner/superuser powers cannot be prohibited by RLS.
-- No automatic retention cleanup, table drops, bucket deletes or CASCADE recovery.
ROLLBACK;
