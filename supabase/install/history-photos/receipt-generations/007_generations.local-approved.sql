-- LOCAL60422 ONLY. Explicit approved overlay, after 001 -> 003 -> 005.
-- No token issuance, Storage mutation, or automatic receipt renewal.
BEGIN;
DO $$ BEGIN
 IF current_user<>'postgres' OR current_database()<>'postgres' OR current_setting('photo_generation.approved',true) IS DISTINCT FROM 'malmoim-photo-package-e118b7ab:60422' OR NOT EXISTS(SELECT FROM scope_private.configuration WHERE issuer='http://127.0.0.1:60421/auth/v1') OR to_regprocedure('photo_finish_v2.lookup_receipt(uuid,uuid,uuid,uuid)') IS NULL OR NOT EXISTS(SELECT FROM pg_roles WHERE rolname='photo_helper_reader_owner') OR to_regclass('photo_finish_v2.receipt_generations') IS NOT NULL THEN RAISE EXCEPTION 'generation target/prerequisite/conflict'; END IF;
END $$;
GRANT photo_finish_owner,photo_helper_reader_owner,photo_scope_owner TO postgres WITH INHERIT TRUE,SET TRUE;
GRANT CREATE ON SCHEMA photo_finish_v2 TO photo_finish_owner;
GRANT CREATE ON SCHEMA photo_scope_v3 TO photo_scope_owner;
CREATE TABLE photo_finish_v2.receipt_generations(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),job uuid NOT NULL REFERENCES photo_finish_v2.jobs(id),
 generation bigint NOT NULL CHECK(generation>0 AND generation<9007199254740991),
 root_receipt uuid NOT NULL REFERENCES photo_finish_v2.receipts(id),previous_receipt uuid NOT NULL,
 visibility_version bigint NOT NULL CHECK(visibility_version>=0),
 recovery_request uuid NOT NULL UNIQUE, evidence jsonb NOT NULL,seal text NOT NULL CHECK(seal ~ '^[a-f0-9]{64}$'),
 issued_at timestamptz NOT NULL DEFAULT clock_timestamp(),consumed boolean NOT NULL DEFAULT false,
 UNIQUE(job,generation),UNIQUE(previous_receipt),CHECK(id<>previous_receipt));
ALTER TABLE photo_finish_v2.receipt_generations OWNER TO photo_finish_owner;
ALTER TABLE photo_finish_v2.receipt_generations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON photo_finish_v2.receipt_generations FROM PUBLIC,anon,authenticated,service_role,photo_finish_attestor,photo_finish_worker,photo_scope_reader,photo_scope_storage_reader,photo_storage_issuer,photo_storage_finalizer,photo_service_owner,photo_scope_owner,photo_capability_owner;
GRANT SELECT ON photo_finish_v2.receipt_generations TO postgres;
GRANT SELECT(id,job,generation,evidence,consumed) ON photo_finish_v2.receipt_generations TO photo_helper_reader_owner;
CREATE POLICY generation_verified_read ON photo_finish_v2.receipt_generations FOR SELECT TO photo_helper_reader_owner USING(true);

-- Hold the existing publication row against a concurrent visibility change. No new
-- UPDATE privilege for finish_owner. Missing private-state row => explicit block.
CREATE FUNCTION photo_scope_v3.recovery_guard(a uuid,expected bigint) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v bigint;BEGIN
 SELECT version INTO STRICT v FROM photo_scope_v3.publications WHERE activity=a FOR SHARE;
 IF expected IS NULL OR expected<0 OR expected IS DISTINCT FROM v THEN RAISE EXCEPTION 'visibility changed';END IF;RETURN v;
END $$;
ALTER FUNCTION photo_scope_v3.recovery_guard(uuid,bigint) OWNER TO photo_scope_owner;
REVOKE ALL ON FUNCTION photo_scope_v3.recovery_guard(uuid,bigint) FROM PUBLIC,anon,authenticated,service_role,photo_finish_attestor,photo_finish_worker,photo_scope_reader,photo_scope_storage_reader,photo_service_owner,photo_helper_reader_owner,photo_capability_owner,photo_storage_issuer,photo_storage_finalizer;
GRANT EXECUTE ON FUNCTION photo_scope_v3.recovery_guard(uuid,bigint) TO photo_finish_owner;
GRANT EXECUTE ON FUNCTION photo_service_v4.public_version(uuid) TO photo_finish_owner;
-- Trusted attestor only. Exposes history metadata for explicit recovery, never to a browser.
CREATE FUNCTION photo_finish_v2.recovery_state(jid uuid,rqid uuid,who uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j photo_finish_v2.jobs;a photo_finish_v2.activities;r photo_finish_v2.receipts;g photo_finish_v2.receipt_generations;
BEGIN
 SELECT * INTO STRICT j FROM photo_finish_v2.jobs WHERE id=jid AND request_id=rqid AND actor=who;
 SELECT * INTO STRICT a FROM photo_finish_v2.activities WHERE id=j.activity;
 IF NOT photo_finish_v2.admin(who) OR a.epoch IS DISTINCT FROM j.epoch OR j.state='blocked' THEN RAISE EXCEPTION 'recovery revoked';END IF;
 SELECT * INTO STRICT r FROM photo_finish_v2.receipts WHERE job=j.id;
 SELECT * INTO g FROM photo_finish_v2.receipt_generations WHERE job=j.id ORDER BY generation DESC LIMIT 1;
 RETURN jsonb_build_object('visibilityVersion',photo_service_v4.public_version(j.activity),'job',photo_finish_v2.job_json(j),'generation',coalesce(g.generation,0),'receiptId',coalesce(g.id,r.id),'seal',coalesce(g.seal,r.seal),'issuedAt',coalesce(g.issued_at,r.issued_at),'consumed',coalesce(g.consumed,r.consumed),'evidence',coalesce(g.evidence,r.evidence));
END $$;

-- The authenticated attestor is the external-file trust boundary. SQL cannot download or
-- decode Storage. This RPC is NOT granted to browsers/workers and requires fresh evidence.
CREATE FUNCTION photo_finish_v2.revalidate_generation(e jsonb,p jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j photo_finish_v2.jobs;a photo_finish_v2.activities;r photo_finish_v2.receipts;g photo_finish_v2.receipt_generations;n photo_finish_v2.receipt_generations;old_id uuid;old_time timestamptz;old_e jsonb;old_used boolean;version bigint;now_at timestamptz;
BEGIN
 SELECT * INTO STRICT j FROM photo_finish_v2.jobs WHERE id=(e->>'jobId')::uuid;
 SELECT * INTO STRICT a FROM photo_finish_v2.activities WHERE id=j.activity FOR UPDATE;
 SELECT * INTO STRICT j FROM photo_finish_v2.jobs WHERE id=j.id FOR UPDATE;
 SELECT * INTO STRICT r FROM photo_finish_v2.receipts WHERE job=j.id FOR UPDATE;
 SELECT * INTO g FROM photo_finish_v2.receipt_generations WHERE job=j.id ORDER BY generation DESC LIMIT 1 FOR UPDATE;
 old_id:=coalesce(g.id,r.id);old_time:=coalesce(g.issued_at,r.issued_at);old_e:=coalesce(g.evidence,r.evidence);old_used:=coalesce(g.consumed,r.consumed);version:=coalesce(g.generation,0);now_at:=clock_timestamp();
 IF NOT photo_finish_v2.admin(j.actor) OR j.state<>'pending' OR a.epoch IS DISTINCT FROM j.epoch OR old_used OR old_time>=now_at-interval '5 minutes' OR old_time>now_at OR old_time IS NULL THEN RAISE EXCEPTION 'recovery not eligible';END IF;
 IF (p->>'generation')::bigint IS DISTINCT FROM version OR version<0 OR version>=9007199254740990 OR (p->>'previousReceiptId')::uuid IS DISTINCT FROM old_id OR (p->>'revision')::bigint IS DISTINCT FROM j.revision OR p->>'recoveryRequestId' IS NULL THEN RAISE EXCEPTION 'generation CAS rejected';END IF;
 PERFORM photo_scope_v3.recovery_guard(j.activity,(p->>'visibilityVersion')::bigint);
 -- Immutable binding: a new generation cannot select a different file or job.
 IF e IS DISTINCT FROM old_e OR (e->>'jobId')::uuid IS DISTINCT FROM j.id OR (e->>'requestId')::uuid IS DISTINCT FROM j.request_id OR (e->>'activityId')::uuid IS DISTINCT FROM j.activity OR (e->>'photoId')::uuid IS DISTINCT FROM j.photo OR (e->>'actorId')::uuid IS DISTINCT FROM j.actor OR (e->>'revision')::bigint IS DISTINCT FROM j.revision OR (e->>'epoch')::bigint IS DISTINCT FROM j.epoch OR (e->>'size')::bigint IS DISTINCT FROM j.size OR e->>'mime' IS DISTINCT FROM j.mime OR e->>'tempPath' IS DISTINCT FROM j.temp_path OR e->>'basis' IS DISTINCT FROM 'immutable-final-readback' OR e->>'digest' IS NULL OR e->>'digest' !~ '^[a-f0-9]{64}$' OR e->>'finalPath' IS DISTINCT FROM (j.activity::text||'/'||j.photo::text||'/'||(e->>'digest')||CASE j.mime WHEN 'image/png' THEN '.png' WHEN 'image/jpeg' THEN '.jpg' ELSE '.webp' END) THEN RAISE EXCEPTION 'generation evidence mismatch';END IF;
 INSERT INTO photo_finish_v2.receipt_generations(job,generation,root_receipt,previous_receipt,recovery_request,visibility_version,evidence,seal) VALUES(j.id,version+1,r.id,old_id,(p->>'recoveryRequestId')::uuid,(p->>'visibilityVersion')::bigint,e,encode(sha256(convert_to(jsonb_build_object('evidence',e,'generation',version+1,'previous',old_id,'request',p->>'recoveryRequestId')::text,'UTF8')),'hex')) RETURNING * INTO n;
 RETURN jsonb_build_object('id',n.id,'seal',n.seal,'generation',n.generation);
END $$;
CREATE OR REPLACE FUNCTION photo_finish_v2.lookup_receipt(jid uuid,rqid uuid,rid uuid,who uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j photo_finish_v2.jobs;r photo_finish_v2.receipts;a photo_finish_v2.activities;now_at timestamptz;g photo_finish_v2.receipt_generations;
BEGIN
 SELECT * INTO j FROM photo_finish_v2.jobs WHERE id=jid AND request_id=rqid AND actor=who;
 IF NOT FOUND OR NOT photo_finish_v2.admin(who) OR j.state<>'pending' THEN RETURN NULL;END IF;
 SELECT * INTO a FROM photo_finish_v2.activities WHERE id=j.activity;
 SELECT * INTO r FROM photo_finish_v2.receipts WHERE id=rid AND job=jid;
 SELECT * INTO g FROM photo_finish_v2.receipt_generations WHERE job=jid ORDER BY generation DESC LIMIT 1;
 IF g.id IS NOT NULL THEN
  IF g.id IS DISTINCT FROM rid OR g.visibility_version IS DISTINCT FROM photo_service_v4.public_version(j.activity) THEN RETURN NULL;END IF;
  r.id:=g.id;r.job:=g.job;r.evidence:=g.evidence;r.seal:=g.seal;r.issued_at:=g.issued_at;r.consumed:=g.consumed;
 END IF;
 now_at:=clock_timestamp();
 IF r.id IS NULL OR r.consumed OR a.epoch IS DISTINCT FROM j.epoch OR r.issued_at IS NULL OR r.issued_at>now_at OR r.issued_at<now_at-interval '5 minutes' OR r.seal IS DISTINCT FROM (CASE WHEN g.id IS NULL THEN encode(sha256(convert_to(r.evidence::text,'UTF8')),'hex') ELSE encode(sha256(convert_to(jsonb_build_object('evidence',g.evidence,'generation',g.generation,'previous',g.previous_receipt,'request',g.recovery_request::text)::text,'UTF8')),'hex') END) THEN RETURN NULL;END IF;
 IF (r.evidence->>'revision')::bigint IS DISTINCT FROM j.revision OR (r.evidence->>'epoch')::bigint IS DISTINCT FROM j.epoch OR (r.evidence->>'jobId')::uuid IS DISTINCT FROM j.id OR (r.evidence->>'requestId')::uuid IS DISTINCT FROM j.request_id OR (r.evidence->>'activityId')::uuid IS DISTINCT FROM j.activity OR (r.evidence->>'photoId')::uuid IS DISTINCT FROM j.photo OR (r.evidence->>'actorId')::uuid IS DISTINCT FROM who OR (r.evidence->>'size')::bigint IS DISTINCT FROM j.size OR r.evidence->>'mime' IS DISTINCT FROM j.mime OR r.evidence->>'tempPath' IS DISTINCT FROM j.temp_path OR r.evidence->>'basis' IS DISTINCT FROM 'immutable-final-readback' THEN RETURN NULL;END IF;
 RETURN jsonb_build_object('issuer',CASE WHEN g.id IS NULL THEN 'photo_finish_v2.attest' ELSE 'photo_finish_v2.revalidate_generation' END,'receiptId',r.id,'seal',r.seal,'issuedAt',r.issued_at,'checkedAt',now_at,'consumed',r.consumed,'evidence',r.evidence,'job',photo_finish_v2.job_json(j));
END $$;
CREATE OR REPLACE FUNCTION photo_finish_v2.commit(p jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j photo_finish_v2.jobs;a photo_finish_v2.activities;r photo_finish_v2.receipts;g photo_finish_v2.receipt_generations;
BEGIN
 SELECT * INTO STRICT j FROM photo_finish_v2.jobs WHERE id=(p->>'jobId')::uuid;
 SELECT * INTO STRICT a FROM photo_finish_v2.activities WHERE id=j.activity FOR UPDATE;
 SELECT * INTO STRICT j FROM photo_finish_v2.jobs WHERE id=j.id FOR UPDATE;
 SELECT * INTO STRICT r FROM photo_finish_v2.receipts WHERE job=j.id FOR UPDATE;
 SELECT * INTO g FROM photo_finish_v2.receipt_generations WHERE job=j.id ORDER BY generation DESC LIMIT 1 FOR UPDATE;
 IF g.id IS NOT NULL THEN
  PERFORM photo_scope_v3.recovery_guard(j.activity,g.visibility_version);
  r.id:=g.id;r.evidence:=g.evidence;r.seal:=g.seal;r.issued_at:=g.issued_at;r.consumed:=g.consumed;
 END IF;
 IF (p->>'receiptId')::uuid IS DISTINCT FROM r.id THEN RAISE EXCEPTION 'superseded generation';END IF;
 IF NOT photo_finish_v2.admin(j.actor) OR j.state<>'pending' OR a.epoch<>j.epoch OR (p->>'revision')::bigint IS DISTINCT FROM j.revision OR (p->>'requestId')::uuid IS DISTINCT FROM j.request_id OR p->>'seal' IS DISTINCT FROM r.seal OR r.consumed OR r.issued_at IS NULL OR r.issued_at>clock_timestamp() OR r.issued_at<clock_timestamp()-interval '5 minutes' OR (r.evidence->>'revision')::bigint IS DISTINCT FROM j.revision OR (r.evidence->>'epoch')::bigint IS DISTINCT FROM a.epoch THEN RAISE EXCEPTION 'receipt or CAS rejected';END IF;
 UPDATE photo_finish_v2.jobs SET state='complete',digest=r.evidence->>'digest',final_path=r.evidence->>'finalPath',revision=revision+1 WHERE id=j.id;
 IF g.id IS NULL THEN UPDATE photo_finish_v2.receipts SET consumed=true WHERE id=r.id;ELSE UPDATE photo_finish_v2.receipt_generations SET consumed=true WHERE id=g.id;END IF;
END $$;
CREATE OR REPLACE FUNCTION photo_scope_v3.verified_state(a uuid) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('activityId',v.id,'photos',(SELECT jsonb_agg(jsonb_build_object('jobId',j.id,'photoId',j.photo,'path',j.final_path,'digest',j.digest,'size',j.size,'mime',j.mime) ORDER BY j.photo) FROM photo_finish_v2.jobs j WHERE j.activity=v.id))
 FROM photo_finish_v2.activities v WHERE v.id=a AND (SELECT count(*) BETWEEN 1 AND 10 AND coalesce(sum(size),0)<=47185920 FROM photo_finish_v2.jobs WHERE activity=v.id)
 AND NOT EXISTS(SELECT FROM photo_finish_v2.jobs j LEFT JOIN LATERAL (SELECT id,evidence,consumed FROM photo_finish_v2.receipt_generations WHERE job=j.id ORDER BY generation DESC LIMIT 1) g ON true LEFT JOIN photo_finish_v2.receipts old ON old.job=j.id LEFT JOIN LATERAL (SELECT coalesce(g.id,old.id) id,coalesce(g.evidence,old.evidence) evidence,coalesce(g.consumed,old.consumed) consumed) r ON true WHERE j.activity=v.id AND (j.state<>'complete' OR j.epoch<>v.epoch OR r.id IS NULL OR NOT r.consumed OR j.digest IS DISTINCT FROM r.evidence->>'digest' OR j.final_path IS DISTINCT FROM r.evidence->>'finalPath' OR j.final_path IS DISTINCT FROM j.activity::text||'/'||j.photo::text||'/'||j.digest||CASE j.mime WHEN 'image/png' THEN '.png' WHEN 'image/jpeg' THEN '.jpg' ELSE '.webp' END));
$$;
ALTER FUNCTION photo_finish_v2.recovery_state(uuid,uuid,uuid) OWNER TO photo_finish_owner;
REVOKE ALL ON FUNCTION photo_finish_v2.recovery_state(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role,photo_finish_worker,photo_scope_reader,photo_scope_storage_reader,photo_service_owner,photo_scope_owner,photo_helper_reader_owner,photo_capability_owner,photo_storage_issuer,photo_storage_finalizer;
GRANT EXECUTE ON FUNCTION photo_finish_v2.recovery_state(uuid,uuid,uuid) TO photo_finish_attestor;
ALTER FUNCTION photo_finish_v2.revalidate_generation(jsonb,jsonb) OWNER TO photo_finish_owner;
REVOKE ALL ON FUNCTION photo_finish_v2.revalidate_generation(jsonb,jsonb) FROM PUBLIC,anon,authenticated,service_role,photo_finish_worker,photo_scope_reader,photo_scope_storage_reader,photo_service_owner,photo_scope_owner,photo_helper_reader_owner,photo_capability_owner,photo_storage_issuer,photo_storage_finalizer;
GRANT EXECUTE ON FUNCTION photo_finish_v2.revalidate_generation(jsonb,jsonb) TO photo_finish_attestor;
REVOKE CREATE ON SCHEMA photo_finish_v2 FROM photo_finish_owner;
REVOKE CREATE ON SCHEMA photo_scope_v3 FROM photo_scope_owner;
REVOKE photo_finish_owner,photo_helper_reader_owner,photo_scope_owner FROM postgres;
COMMIT;
