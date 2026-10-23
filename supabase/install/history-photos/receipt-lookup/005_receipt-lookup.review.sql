-- Local60422 only; existing receipt store, no new tables/roles or receipt issuance.
BEGIN;
DO $$ BEGIN
 IF current_user<>'postgres' OR current_setting('photo_receipt.approved',true) IS DISTINCT FROM 'malmoim-photo-package-e118b7ab:60422' OR NOT EXISTS(SELECT FROM scope_private.configuration WHERE issuer='http://127.0.0.1:60421/auth/v1') OR to_regprocedure('photo_finish_v2.lookup_receipt(uuid,uuid,uuid,uuid)') IS NOT NULL THEN RAISE EXCEPTION 'receipt lookup target/conflict';END IF;
END $$;
GRANT photo_finish_owner TO postgres WITH INHERIT TRUE,SET TRUE;
GRANT CREATE ON SCHEMA photo_finish_v2 TO photo_finish_owner;
CREATE FUNCTION photo_finish_v2.lookup_receipt(jid uuid,rqid uuid,rid uuid,who uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j photo_finish_v2.jobs;r photo_finish_v2.receipts;a photo_finish_v2.activities;now_at timestamptz;
BEGIN
 SELECT * INTO j FROM photo_finish_v2.jobs WHERE id=jid AND request_id=rqid AND actor=who;
 IF NOT FOUND OR NOT photo_finish_v2.admin(who) OR j.state<>'pending' THEN RETURN NULL;END IF;
 SELECT * INTO a FROM photo_finish_v2.activities WHERE id=j.activity;
 SELECT * INTO r FROM photo_finish_v2.receipts WHERE id=rid AND job=jid;
 now_at:=clock_timestamp();
 IF r.id IS NULL OR r.consumed OR a.epoch IS DISTINCT FROM j.epoch OR r.issued_at IS NULL OR r.issued_at>now_at OR r.issued_at<now_at-interval '5 minutes' OR r.seal IS DISTINCT FROM encode(sha256(convert_to(r.evidence::text,'UTF8')),'hex') THEN RETURN NULL;END IF;
 IF (r.evidence->>'revision')::bigint IS DISTINCT FROM j.revision OR (r.evidence->>'epoch')::bigint IS DISTINCT FROM j.epoch OR (r.evidence->>'jobId')::uuid IS DISTINCT FROM j.id OR (r.evidence->>'requestId')::uuid IS DISTINCT FROM j.request_id OR (r.evidence->>'activityId')::uuid IS DISTINCT FROM j.activity OR (r.evidence->>'photoId')::uuid IS DISTINCT FROM j.photo OR (r.evidence->>'actorId')::uuid IS DISTINCT FROM who OR (r.evidence->>'size')::bigint IS DISTINCT FROM j.size OR r.evidence->>'mime' IS DISTINCT FROM j.mime OR r.evidence->>'tempPath' IS DISTINCT FROM j.temp_path OR r.evidence->>'basis' IS DISTINCT FROM 'immutable-final-readback' THEN RETURN NULL;END IF;
 RETURN jsonb_build_object('issuer','photo_finish_v2.attest','receiptId',r.id,'seal',r.seal,'issuedAt',r.issued_at,'checkedAt',now_at,'consumed',r.consumed,'evidence',r.evidence,'job',photo_finish_v2.job_json(j));
END $$;
ALTER FUNCTION photo_finish_v2.lookup_receipt(uuid,uuid,uuid,uuid) OWNER TO photo_finish_owner;
REVOKE ALL ON FUNCTION photo_finish_v2.lookup_receipt(uuid,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role,photo_finish_worker,photo_scope_reader,photo_scope_storage_reader,photo_service_owner,photo_helper_reader_owner,photo_capability_owner,photo_storage_issuer,photo_storage_finalizer;
GRANT EXECUTE ON FUNCTION photo_finish_v2.lookup_receipt(uuid,uuid,uuid,uuid) TO photo_finish_owner,photo_finish_attestor;
-- Check receipt age again AFTER the existing activity/job/receipt locks.
CREATE OR REPLACE FUNCTION photo_finish_v2.commit(p jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j photo_finish_v2.jobs;a photo_finish_v2.activities;r photo_finish_v2.receipts;
BEGIN
 SELECT * INTO STRICT j FROM photo_finish_v2.jobs WHERE id=(p->>'jobId')::uuid;
 SELECT * INTO STRICT a FROM photo_finish_v2.activities WHERE id=j.activity FOR UPDATE;
 SELECT * INTO STRICT j FROM photo_finish_v2.jobs WHERE id=j.id FOR UPDATE;
 SELECT * INTO STRICT r FROM photo_finish_v2.receipts WHERE id=(p->>'receiptId')::uuid AND job=j.id FOR UPDATE;
 IF NOT photo_finish_v2.admin(j.actor) OR j.state<>'pending' OR a.epoch<>j.epoch OR (p->>'revision')::bigint IS DISTINCT FROM j.revision OR (p->>'requestId')::uuid IS DISTINCT FROM j.request_id OR p->>'seal' IS DISTINCT FROM r.seal OR r.consumed OR r.issued_at IS NULL OR r.issued_at>clock_timestamp() OR r.issued_at<clock_timestamp()-interval '5 minutes' OR (r.evidence->>'revision')::bigint IS DISTINCT FROM j.revision OR (r.evidence->>'epoch')::bigint IS DISTINCT FROM a.epoch THEN RAISE EXCEPTION 'receipt or CAS rejected';END IF;
 UPDATE photo_finish_v2.jobs SET state='complete',digest=r.evidence->>'digest',final_path=r.evidence->>'finalPath',revision=revision+1 WHERE id=j.id;
 UPDATE photo_finish_v2.receipts SET consumed=true WHERE id=r.id;
END $$;
REVOKE CREATE ON SCHEMA photo_finish_v2 FROM photo_finish_owner;
REVOKE photo_finish_owner FROM postgres;
COMMIT;
