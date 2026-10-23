-- REVIEW PACKAGE v1. Not approved for production. Only the pinned clean-lab installer may execute.
BEGIN;
DO $$ BEGIN
 IF current_user<>'postgres' OR current_database()<>'postgres' OR current_setting('photo_install.approved',true) IS DISTINCT FROM 'clean-local-only' OR coalesce(current_setting('photo_install.issuer',true),'') NOT IN ('http://127.0.0.1:59421/auth/v1','http://127.0.0.1:60421/auth/v1') THEN RAISE EXCEPTION 'unapproved target';END IF;
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='postgres' AND rolbypassrls AND rolcreaterole) THEN RAISE EXCEPTION 'installer privileges';END IF;
 IF to_regclass('public.admin_users') IS NULL OR NOT EXISTS(SELECT FROM pg_attribute WHERE attrelid='public.admin_users'::regclass AND attname='user_id' AND atttypid='uuid'::regtype AND NOT attisdropped) THEN RAISE EXCEPTION 'existing administrator integration required';END IF;
 IF NOT EXISTS(SELECT FROM pg_class WHERE oid='storage.objects'::regclass AND relrowsecurity) OR NOT EXISTS(SELECT FROM pg_class WHERE oid='storage.buckets'::regclass AND relrowsecurity) OR to_regprocedure('storage.allow_only_operation(text)') IS NULL OR to_regprocedure('storage.allow_any_operation(text[])') IS NULL THEN RAISE EXCEPTION 'unsupported Storage API policy helpers';END IF;
 IF EXISTS(SELECT FROM pg_namespace WHERE nspname IN ('scope_private','photo_finish_v2','photo_scope_v3','photo_service_v4')) OR EXISTS(SELECT FROM pg_roles WHERE rolname LIKE 'photo_%') OR EXISTS(SELECT FROM storage.buckets WHERE id IN ('history-activity-photos','history-activity-final-photos')) THEN RAISE EXCEPTION 'installation conflict';END IF;
 -- Fresh lab only: do not silently accept unknown permissive Storage policies.
 IF EXISTS(SELECT FROM pg_policies WHERE schemaname='storage') THEN RAISE EXCEPTION 'Storage policy review required';END IF;
END $$;
CREATE ROLE photo_finish_owner NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION;
CREATE ROLE photo_finish_attestor NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION;
CREATE ROLE photo_finish_worker NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION;
CREATE ROLE photo_scope_owner NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION;
CREATE ROLE photo_scope_reader NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION;
CREATE ROLE photo_scope_storage_reader NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION;
CREATE ROLE photo_service_owner NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION;
CREATE ROLE photo_storage_issuer NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION;
CREATE ROLE photo_storage_finalizer NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION;
GRANT photo_finish_owner,photo_scope_owner,photo_service_owner TO postgres WITH INHERIT TRUE,SET TRUE;
GRANT CREATE ON SCHEMA public TO photo_finish_owner,photo_scope_owner,photo_service_owner;
CREATE SCHEMA scope_private;
REVOKE ALL ON SCHEMA scope_private FROM PUBLIC,anon,authenticated,service_role;
CREATE SCHEMA photo_finish_v2;
REVOKE ALL ON SCHEMA photo_finish_v2 FROM PUBLIC,anon,authenticated,service_role;
CREATE SCHEMA photo_scope_v3;
REVOKE ALL ON SCHEMA photo_scope_v3 FROM PUBLIC,anon,authenticated,service_role;
CREATE SCHEMA photo_service_v4;
REVOKE ALL ON SCHEMA photo_service_v4 FROM PUBLIC,anon,authenticated,service_role;
GRANT USAGE,CREATE ON SCHEMA scope_private,photo_finish_v2,photo_scope_v3,photo_service_v4 TO photo_finish_owner,photo_scope_owner,photo_service_owner;
CREATE TABLE scope_private.configuration(singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),issuer text NOT NULL);
INSERT INTO scope_private.configuration VALUES(true,current_setting('photo_install.issuer'));
CREATE TABLE scope_private.installation(version text PRIMARY KEY,installed_at timestamptz NOT NULL DEFAULT clock_timestamp());
INSERT INTO scope_private.installation(version) VALUES('history-photos-1');
CREATE TABLE scope_private.capabilities(jti uuid PRIMARY KEY,subject uuid NOT NULL,role_name text NOT NULL CHECK(role_name IN ('photo_storage_issuer','photo_storage_finalizer')),temp_path text NOT NULL,final_path text NOT NULL,revoked boolean NOT NULL DEFAULT false,expires_at timestamptz NOT NULL);
CREATE TABLE photo_finish_v2.activities(id uuid PRIMARY KEY,actor uuid NOT NULL,epoch bigint NOT NULL DEFAULT 0 CHECK(epoch>=0));
CREATE TABLE photo_finish_v2.jobs(id uuid PRIMARY KEY,request_id uuid UNIQUE NOT NULL,activity uuid NOT NULL REFERENCES photo_finish_v2.activities,photo uuid UNIQUE NOT NULL,actor uuid NOT NULL,size bigint NOT NULL CHECK(size BETWEEN 1 AND 4718592),mime text NOT NULL CHECK(mime IN ('image/png','image/jpeg','image/webp')),temp_path text UNIQUE NOT NULL,epoch bigint NOT NULL,revision bigint NOT NULL DEFAULT 0 CHECK(revision>=0),state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','complete','blocked')),digest text CHECK(digest ~ '^[0-9a-f]{64}$'),final_path text UNIQUE,CHECK((state='complete')=(digest IS NOT NULL AND final_path IS NOT NULL)));
CREATE TABLE photo_finish_v2.receipts(id uuid PRIMARY KEY,job uuid UNIQUE NOT NULL REFERENCES photo_finish_v2.jobs,evidence jsonb NOT NULL,seal text NOT NULL,issued_at timestamptz NOT NULL DEFAULT clock_timestamp(),consumed boolean NOT NULL DEFAULT false);
CREATE TABLE photo_scope_v3.publications(activity uuid PRIMARY KEY,actor uuid NOT NULL,version bigint NOT NULL DEFAULT 0 CHECK(version>=0),published boolean NOT NULL DEFAULT false,snapshot jsonb);
CREATE TABLE photo_scope_v3.caps(jti uuid PRIMARY KEY,activity uuid NOT NULL REFERENCES photo_scope_v3.publications,version bigint NOT NULL,path text NOT NULL,expires_at timestamptz NOT NULL);
CREATE TABLE photo_service_v4.activities(id uuid PRIMARY KEY,actor uuid NOT NULL,title text NOT NULL CHECK(length(title) BETWEEN 1 AND 200),date date NOT NULL,description text NOT NULL CHECK(length(description)<=2000),revision bigint NOT NULL DEFAULT 0 CHECK(revision>=0),photo_order uuid[] NOT NULL DEFAULT '{}',cover uuid,CHECK(cardinality(photo_order)<=10),CHECK(cover IS NULL OR cover=ANY(photo_order)));
CREATE TABLE photo_service_v4.requests(id uuid PRIMARY KEY,actor uuid NOT NULL,payload jsonb NOT NULL,result jsonb NOT NULL);
CREATE TABLE photo_service_v4.permits(job uuid PRIMARY KEY,activity uuid NOT NULL REFERENCES photo_service_v4.activities(id),request_id uuid UNIQUE NOT NULL,claimed_at timestamptz NOT NULL DEFAULT clock_timestamp());
ALTER TABLE scope_private.configuration OWNER TO postgres;
ALTER TABLE scope_private.configuration ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON scope_private.configuration FROM PUBLIC,anon,authenticated,service_role,photo_finish_owner,photo_finish_attestor,photo_finish_worker,photo_scope_owner,photo_scope_reader,photo_scope_storage_reader,photo_service_owner,photo_storage_issuer,photo_storage_finalizer;
GRANT ALL ON scope_private.configuration TO postgres;
GRANT SELECT ON scope_private.configuration TO postgres;
ALTER TABLE scope_private.installation OWNER TO postgres;
ALTER TABLE scope_private.installation ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON scope_private.installation FROM PUBLIC,anon,authenticated,service_role,photo_finish_owner,photo_finish_attestor,photo_finish_worker,photo_scope_owner,photo_scope_reader,photo_scope_storage_reader,photo_service_owner,photo_storage_issuer,photo_storage_finalizer;
GRANT ALL ON scope_private.installation TO postgres;
GRANT SELECT ON scope_private.installation TO postgres;
ALTER TABLE scope_private.capabilities OWNER TO postgres;
ALTER TABLE scope_private.capabilities ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON scope_private.capabilities FROM PUBLIC,anon,authenticated,service_role,photo_finish_owner,photo_finish_attestor,photo_finish_worker,photo_scope_owner,photo_scope_reader,photo_scope_storage_reader,photo_service_owner,photo_storage_issuer,photo_storage_finalizer;
GRANT ALL ON scope_private.capabilities TO postgres;
GRANT SELECT ON scope_private.capabilities TO postgres;
ALTER TABLE photo_finish_v2.activities OWNER TO photo_finish_owner;
ALTER TABLE photo_finish_v2.activities ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON photo_finish_v2.activities FROM PUBLIC,anon,authenticated,service_role,photo_finish_owner,photo_finish_attestor,photo_finish_worker,photo_scope_owner,photo_scope_reader,photo_scope_storage_reader,photo_service_owner,photo_storage_issuer,photo_storage_finalizer;
GRANT ALL ON photo_finish_v2.activities TO photo_finish_owner;
GRANT SELECT ON photo_finish_v2.activities TO postgres;
ALTER TABLE photo_finish_v2.jobs OWNER TO photo_finish_owner;
ALTER TABLE photo_finish_v2.jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON photo_finish_v2.jobs FROM PUBLIC,anon,authenticated,service_role,photo_finish_owner,photo_finish_attestor,photo_finish_worker,photo_scope_owner,photo_scope_reader,photo_scope_storage_reader,photo_service_owner,photo_storage_issuer,photo_storage_finalizer;
GRANT ALL ON photo_finish_v2.jobs TO photo_finish_owner;
GRANT SELECT ON photo_finish_v2.jobs TO postgres;
ALTER TABLE photo_finish_v2.receipts OWNER TO photo_finish_owner;
ALTER TABLE photo_finish_v2.receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON photo_finish_v2.receipts FROM PUBLIC,anon,authenticated,service_role,photo_finish_owner,photo_finish_attestor,photo_finish_worker,photo_scope_owner,photo_scope_reader,photo_scope_storage_reader,photo_service_owner,photo_storage_issuer,photo_storage_finalizer;
GRANT ALL ON photo_finish_v2.receipts TO photo_finish_owner;
GRANT SELECT ON photo_finish_v2.receipts TO postgres;
ALTER TABLE photo_scope_v3.publications OWNER TO photo_scope_owner;
ALTER TABLE photo_scope_v3.publications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON photo_scope_v3.publications FROM PUBLIC,anon,authenticated,service_role,photo_finish_owner,photo_finish_attestor,photo_finish_worker,photo_scope_owner,photo_scope_reader,photo_scope_storage_reader,photo_service_owner,photo_storage_issuer,photo_storage_finalizer;
GRANT ALL ON photo_scope_v3.publications TO photo_scope_owner;
GRANT SELECT ON photo_scope_v3.publications TO postgres;
ALTER TABLE photo_scope_v3.caps OWNER TO photo_scope_owner;
ALTER TABLE photo_scope_v3.caps ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON photo_scope_v3.caps FROM PUBLIC,anon,authenticated,service_role,photo_finish_owner,photo_finish_attestor,photo_finish_worker,photo_scope_owner,photo_scope_reader,photo_scope_storage_reader,photo_service_owner,photo_storage_issuer,photo_storage_finalizer;
GRANT ALL ON photo_scope_v3.caps TO photo_scope_owner;
GRANT SELECT ON photo_scope_v3.caps TO postgres;
ALTER TABLE photo_service_v4.activities OWNER TO photo_service_owner;
ALTER TABLE photo_service_v4.activities ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON photo_service_v4.activities FROM PUBLIC,anon,authenticated,service_role,photo_finish_owner,photo_finish_attestor,photo_finish_worker,photo_scope_owner,photo_scope_reader,photo_scope_storage_reader,photo_service_owner,photo_storage_issuer,photo_storage_finalizer;
GRANT ALL ON photo_service_v4.activities TO photo_service_owner;
GRANT SELECT ON photo_service_v4.activities TO postgres;
ALTER TABLE photo_service_v4.requests OWNER TO photo_service_owner;
ALTER TABLE photo_service_v4.requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON photo_service_v4.requests FROM PUBLIC,anon,authenticated,service_role,photo_finish_owner,photo_finish_attestor,photo_finish_worker,photo_scope_owner,photo_scope_reader,photo_scope_storage_reader,photo_service_owner,photo_storage_issuer,photo_storage_finalizer;
GRANT ALL ON photo_service_v4.requests TO photo_service_owner;
GRANT SELECT ON photo_service_v4.requests TO postgres;
ALTER TABLE photo_service_v4.permits OWNER TO photo_service_owner;
ALTER TABLE photo_service_v4.permits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON photo_service_v4.permits FROM PUBLIC,anon,authenticated,service_role,photo_finish_owner,photo_finish_attestor,photo_finish_worker,photo_scope_owner,photo_scope_reader,photo_scope_storage_reader,photo_service_owner,photo_storage_issuer,photo_storage_finalizer;
GRANT ALL ON photo_service_v4.permits TO photo_service_owner;
GRANT SELECT ON photo_service_v4.permits TO postgres;
CREATE FUNCTION photo_finish_v2.actor() RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT auth.uid() $$;
CREATE FUNCTION photo_finish_v2.admin(who uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT EXISTS(SELECT FROM public.admin_users WHERE user_id=who) $$;
CREATE FUNCTION public.photo_finish_request_v2(p jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE who uuid:=photo_finish_v2.actor();a photo_finish_v2.activities;j photo_finish_v2.jobs;ph uuid:=gen_random_uuid();ext text;
BEGIN
 IF who IS NULL OR NOT photo_finish_v2.admin(who) THEN RAISE EXCEPTION 'administrator required' USING ERRCODE='42501';END IF;
 IF p ? 'actor' OR p ? 'user_id' OR p ? 'digest' OR p ? 'receipt' OR p ? 'path' THEN RAISE EXCEPTION 'untrusted evidence';END IF;
 IF p->>'op'='reserve' THEN
  IF (p->>'request') IS NULL THEN RAISE EXCEPTION 'request required';END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p->>'request',0));
  SELECT * INTO j FROM photo_finish_v2.jobs WHERE request_id=(p->>'request')::uuid;
  IF FOUND THEN RAISE EXCEPTION 'duplicate request';END IF;
  IF p->>'activity' IS NULL THEN INSERT INTO photo_finish_v2.activities(id,actor) VALUES(gen_random_uuid(),who) RETURNING * INTO a;
  ELSE SELECT * INTO STRICT a FROM photo_finish_v2.activities WHERE id=(p->>'activity')::uuid AND actor=who FOR UPDATE;END IF;
  IF (SELECT count(*) FROM photo_finish_v2.jobs WHERE activity=a.id)>=10 OR coalesce((SELECT sum(size) FROM photo_finish_v2.jobs WHERE activity=a.id),0)+(p->>'size')::bigint>47185920 THEN RAISE EXCEPTION 'photo limits';END IF;
  ext:=CASE p->>'mime' WHEN 'image/png' THEN 'png' WHEN 'image/jpeg' THEN 'jpg' WHEN 'image/webp' THEN 'webp' END;
  INSERT INTO photo_finish_v2.jobs(id,request_id,activity,photo,actor,size,mime,temp_path,epoch) VALUES(gen_random_uuid(),(p->>'request')::uuid,a.id,ph,who,(p->>'size')::bigint,p->>'mime',a.id::text||'/'||ph::text||'.'||ext,a.epoch) RETURNING * INTO j;
  RETURN jsonb_build_object('jobId',j.id,'requestId',j.request_id,'activityId',a.id,'photoId',ph,'revision',j.revision);
 ELSIF p->>'op'='unpublish' THEN
  SELECT * INTO STRICT a FROM photo_finish_v2.activities WHERE id=(p->>'activity')::uuid AND actor=who FOR UPDATE;
  UPDATE photo_finish_v2.activities SET epoch=epoch+1 WHERE id=a.id;
  UPDATE photo_finish_v2.jobs SET state='blocked',revision=revision+1 WHERE activity=a.id AND state='pending';
  RETURN jsonb_build_object('blocked',true);
 END IF;
 RAISE EXCEPTION 'operation disabled';
END $$;
CREATE FUNCTION photo_finish_v2.job_json(j photo_finish_v2.jobs) RETURNS jsonb LANGUAGE sql SET search_path='' AS $$ SELECT jsonb_build_object('id',j.id,'requestId',j.request_id,'activityId',j.activity,'photoId',j.photo,'actorId',j.actor,'revision',j.revision,'epoch',j.epoch,'size',j.size,'mime',j.mime,'tempPath',j.temp_path,'state',j.state,'digest',j.digest,'finalPath',j.final_path) $$;
CREATE FUNCTION photo_finish_v2.inspect(job uuid,actor uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j photo_finish_v2.jobs;BEGIN
 SELECT * INTO STRICT j FROM photo_finish_v2.jobs WHERE id=job AND jobs.actor=inspect.actor;
 IF NOT photo_finish_v2.admin(actor) OR NOT EXISTS(SELECT FROM photo_finish_v2.activities a WHERE a.id=j.activity AND a.epoch=j.epoch) THEN RAISE EXCEPTION 'administrator or epoch revoked';END IF;
 RETURN photo_finish_v2.job_json(j);
END $$;
CREATE FUNCTION photo_finish_v2.attest(e jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j photo_finish_v2.jobs;a photo_finish_v2.activities;r photo_finish_v2.receipts;expected text;
BEGIN
 SELECT * INTO STRICT j FROM photo_finish_v2.jobs WHERE id=(e->>'jobId')::uuid;
 SELECT * INTO STRICT a FROM photo_finish_v2.activities WHERE id=j.activity FOR UPDATE;
 SELECT * INTO STRICT j FROM photo_finish_v2.jobs WHERE id=j.id FOR UPDATE;
 IF NOT photo_finish_v2.admin(j.actor) OR j.state<>'pending' OR a.epoch<>j.epoch THEN RAISE EXCEPTION 'job blocked';END IF;
 IF e->>'digest' IS NULL OR e->>'digest' !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'hash required';END IF;
 expected:=j.activity::text||'/'||j.photo::text||'/'||(e->>'digest')||CASE j.mime WHEN 'image/png' THEN '.png' WHEN 'image/jpeg' THEN '.jpg' ELSE '.webp' END;
 IF (e->>'requestId')::uuid IS DISTINCT FROM j.request_id OR (e->>'activityId')::uuid IS DISTINCT FROM j.activity OR (e->>'photoId')::uuid IS DISTINCT FROM j.photo OR (e->>'actorId')::uuid IS DISTINCT FROM j.actor OR (e->>'revision')::bigint IS DISTINCT FROM j.revision OR (e->>'epoch')::bigint IS DISTINCT FROM j.epoch OR (e->>'size')::bigint IS DISTINCT FROM j.size OR e->>'mime' IS DISTINCT FROM j.mime OR e->>'tempPath' IS DISTINCT FROM j.temp_path OR e->>'finalPath' IS DISTINCT FROM expected OR e->>'basis' IS DISTINCT FROM 'immutable-final-readback' THEN RAISE EXCEPTION 'evidence binding mismatch';END IF;
 SELECT * INTO r FROM photo_finish_v2.receipts WHERE job=j.id;
 IF FOUND THEN IF r.evidence IS DISTINCT FROM e OR r.consumed THEN RAISE EXCEPTION 'receipt replay';END IF;RETURN jsonb_build_object('id',r.id,'seal',r.seal);END IF;
 INSERT INTO photo_finish_v2.receipts(id,job,evidence,seal) VALUES(gen_random_uuid(),j.id,e,encode(sha256(convert_to(e::text,'UTF8')),'hex')) RETURNING * INTO r;
 RETURN jsonb_build_object('id',r.id,'seal',r.seal);
END $$;
CREATE FUNCTION photo_finish_v2.commit(p jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j photo_finish_v2.jobs;a photo_finish_v2.activities;r photo_finish_v2.receipts;
BEGIN
 SELECT * INTO STRICT j FROM photo_finish_v2.jobs WHERE id=(p->>'jobId')::uuid;
 SELECT * INTO STRICT a FROM photo_finish_v2.activities WHERE id=j.activity FOR UPDATE;
 SELECT * INTO STRICT j FROM photo_finish_v2.jobs WHERE id=j.id FOR UPDATE;
 SELECT * INTO STRICT r FROM photo_finish_v2.receipts WHERE id=(p->>'receiptId')::uuid AND job=j.id FOR UPDATE;
 IF NOT photo_finish_v2.admin(j.actor) OR j.state<>'pending' OR a.epoch<>j.epoch OR (p->>'revision')::bigint IS DISTINCT FROM j.revision OR (p->>'requestId')::uuid IS DISTINCT FROM j.request_id OR p->>'seal' IS DISTINCT FROM r.seal OR r.consumed OR (r.evidence->>'revision')::bigint IS DISTINCT FROM j.revision OR (r.evidence->>'epoch')::bigint IS DISTINCT FROM a.epoch THEN RAISE EXCEPTION 'receipt or CAS rejected';END IF;
 UPDATE photo_finish_v2.jobs SET state='complete',digest=r.evidence->>'digest',final_path=r.evidence->>'finalPath',revision=revision+1 WHERE id=j.id;
 UPDATE photo_finish_v2.receipts SET consumed=true WHERE id=r.id;
END $$;
CREATE FUNCTION photo_finish_v2.cap(job uuid,who uuid,jti uuid,kind text,final text DEFAULT 'unavailable') RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j photo_finish_v2.jobs;BEGIN
 SELECT * INTO STRICT j FROM photo_finish_v2.jobs WHERE id=job AND actor=who;
 IF NOT EXISTS(SELECT FROM public.admin_users WHERE user_id=who) OR j.state='blocked' OR NOT EXISTS(SELECT FROM photo_finish_v2.activities a WHERE a.id=j.activity AND a.epoch=j.epoch) OR kind NOT IN ('photo_storage_issuer','photo_storage_finalizer') THEN RAISE EXCEPTION 'cap denied';END IF;
 IF final<>'unavailable' AND final !~ ('^'||j.activity::text||'/'||j.photo::text||'/[a-f0-9]{64}[.](png|jpg|webp)$') THEN RAISE EXCEPTION 'path denied';END IF;
 INSERT INTO scope_private.capabilities(jti,subject,role_name,temp_path,final_path,expires_at) VALUES(cap.jti,who,kind,j.temp_path,final,clock_timestamp()+interval '2 minutes');
END $$;
CREATE FUNCTION photo_scope_v3.current_actor() RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT auth.uid() WHERE EXISTS(SELECT FROM public.admin_users WHERE user_id=auth.uid()) $$;
CREATE FUNCTION photo_scope_v3.activity_actor(a uuid) RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT actor FROM photo_finish_v2.activities WHERE id=a $$;
CREATE FUNCTION photo_scope_v3.verified_state(a uuid) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('activityId',v.id,'photos',(SELECT jsonb_agg(jsonb_build_object('jobId',j.id,'photoId',j.photo,'path',j.final_path,'digest',j.digest,'size',j.size,'mime',j.mime) ORDER BY j.photo) FROM photo_finish_v2.jobs j WHERE j.activity=v.id))
 FROM photo_finish_v2.activities v WHERE v.id=a AND (SELECT count(*) BETWEEN 1 AND 10 AND coalesce(sum(size),0)<=47185920 FROM photo_finish_v2.jobs WHERE activity=v.id)
 AND NOT EXISTS(SELECT FROM photo_finish_v2.jobs j LEFT JOIN photo_finish_v2.receipts r ON r.job=j.id WHERE j.activity=v.id AND (j.state<>'complete' OR j.epoch<>v.epoch OR r.id IS NULL OR NOT r.consumed OR j.digest IS DISTINCT FROM r.evidence->>'digest' OR j.final_path IS DISTINCT FROM r.evidence->>'finalPath' OR j.final_path IS DISTINCT FROM j.activity::text||'/'||j.photo::text||'/'||j.digest||CASE j.mime WHEN 'image/png' THEN '.png' WHEN 'image/jpeg' THEN '.jpg' ELSE '.webp' END));
$$;
CREATE FUNCTION public.photo_scope_visibility_v3(p jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE who uuid:=photo_scope_v3.current_actor();pub photo_scope_v3.publications;s jsonb;id uuid:=(p->>'activityId')::uuid;
BEGIN
 IF who IS NULL OR photo_scope_v3.activity_actor(id) IS DISTINCT FROM who THEN RAISE EXCEPTION 'administrator required';END IF;
 IF jsonb_typeof(p->'published') IS DISTINCT FROM 'boolean' OR p->>'version' IS NULL OR (p->>'version')::bigint<0 THEN RAISE EXCEPTION 'invalid version';END IF;
 INSERT INTO photo_scope_v3.publications(activity,actor) VALUES(id,who) ON CONFLICT DO NOTHING;
 SELECT * INTO STRICT pub FROM photo_scope_v3.publications WHERE activity=id FOR UPDATE;
 IF pub.version IS DISTINCT FROM (p->>'version')::bigint THEN RAISE EXCEPTION 'CAS conflict';END IF;
 IF (p->>'published')::boolean THEN s:=photo_scope_v3.verified_state(id);IF s IS NULL THEN RAISE EXCEPTION 'not verified';END IF;END IF;
 UPDATE photo_scope_v3.publications SET version=version+1,published=(p->>'published')::boolean,snapshot=s WHERE activity=id;
 RETURN jsonb_build_object('version',pub.version+1,'published',(p->>'published')::boolean);
END $$;
CREATE FUNCTION photo_scope_v3.read(p jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE pub photo_scope_v3.publications;s jsonb;ph jsonb;
BEGIN
 SELECT * INTO pub FROM photo_scope_v3.publications WHERE activity=(p->>'activityId')::uuid FOR SHARE;
 IF NOT FOUND OR NOT pub.published THEN RETURN NULL;END IF;
 s:=photo_scope_v3.verified_state(pub.activity);IF s IS NULL OR s IS DISTINCT FROM pub.snapshot THEN RETURN NULL;END IF;
 IF p->>'op'='snapshot' THEN RETURN s||jsonb_build_object('version',pub.version);END IF;
 IF p->>'op' IS DISTINCT FROM 'cap' OR (p->>'version')::bigint IS DISTINCT FROM pub.version OR p->>'jti' IS NULL THEN RAISE EXCEPTION 'invalid reader request';END IF;
 SELECT value INTO STRICT ph FROM jsonb_array_elements(s->'photos') WHERE value->>'jobId'=p->>'jobId';
 INSERT INTO photo_scope_v3.caps VALUES((p->>'jti')::uuid,pub.activity,pub.version,ph->>'path',clock_timestamp()+interval '90 seconds');
 RETURN jsonb_build_object('path',ph->>'path');
END $$;
CREATE FUNCTION photo_scope_v3.allowed(b text,p text) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(b='history-activity-final-photos' AND auth.jwt()->>'iss'=(SELECT issuer FROM scope_private.configuration WHERE singleton) AND auth.role()='photo_scope_storage_reader' AND EXISTS(SELECT FROM photo_scope_v3.caps c JOIN photo_scope_v3.publications v ON v.activity=c.activity WHERE c.jti::text=auth.jwt()->>'jti' AND c.jti::text=auth.jwt()->>'sub' AND c.path=p AND c.expires_at>clock_timestamp() AND v.published AND v.version=c.version AND v.snapshot IS NOT DISTINCT FROM photo_scope_v3.verified_state(v.activity)),false)
$$;
CREATE FUNCTION photo_service_v4.managed_job(j uuid,who uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT EXISTS(SELECT FROM photo_finish_v2.jobs p JOIN photo_service_v4.activities a ON a.id=p.activity WHERE p.id=j AND a.actor=who) $$;
CREATE FUNCTION photo_service_v4.actor() RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT auth.uid() WHERE EXISTS(SELECT FROM public.admin_users WHERE user_id=auth.uid()) $$;
CREATE FUNCTION photo_service_v4.allocate() RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE who uuid:=photo_service_v4.actor();n uuid:=gen_random_uuid(); BEGIN IF who IS NULL THEN RAISE EXCEPTION 'administrator required';END IF; INSERT INTO photo_finish_v2.activities(id,actor) VALUES(n,who);RETURN n;END $$;
CREATE FUNCTION photo_service_v4.jobs(a uuid) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT coalesce(jsonb_agg(jsonb_build_object('jobId',id,'photoId',photo,'requestId',request_id,'state',state,'revision',revision) ORDER BY photo),'[]'::jsonb) FROM photo_finish_v2.jobs WHERE activity=a $$;
CREATE FUNCTION photo_service_v4.public_version(a uuid) RETURNS bigint LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT coalesce((SELECT version FROM photo_scope_v3.publications WHERE activity=a),0) $$;
CREATE FUNCTION photo_service_v4.public_valid(a uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT EXISTS(SELECT FROM photo_scope_v3.publications p WHERE p.activity=a AND p.published AND p.snapshot IS NOT DISTINCT FROM photo_scope_v3.verified_state(a) AND p.snapshot IS NOT NULL) $$;
CREATE FUNCTION public.photo_service_command_v4(p jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE who uuid:=photo_service_v4.actor();a photo_service_v4.activities;r photo_service_v4.requests;result jsonb;files jsonb;item jsonb;v bigint;ids uuid[];n integer;pub jsonb;
BEGIN
 IF who IS NULL THEN RAISE EXCEPTION 'administrator required' USING ERRCODE='42501';END IF;
 IF p ? 'actor' OR p ? 'user_id' OR p ? 'role' OR p ? 'digest' OR p ? 'receipt' OR p ? 'path' THEN RAISE EXCEPTION 'untrusted input' USING ERRCODE='22023';END IF;
 IF p->>'op'='inspect' THEN
  SELECT * INTO STRICT a FROM photo_service_v4.activities WHERE id=(p->>'activityId')::uuid AND actor=who;
  SELECT jsonb_agg(value||jsonb_build_object('permit',CASE WHEN EXISTS(SELECT FROM photo_service_v4.permits WHERE job=(value->>'jobId')::uuid) THEN 'claimed-or-uncertain' ELSE 'not-issued' END)) INTO files FROM jsonb_array_elements(photo_service_v4.jobs(a.id));
  RETURN jsonb_build_object('activityId',a.id,'revision',a.revision,'title',a.title,'date',a.date,'description',a.description,'order',to_jsonb(a.photo_order),'cover',a.cover,'published',photo_service_v4.public_valid(a.id),'photos',coalesce(files,'[]'::jsonb));
 END IF;
 IF p->>'requestId' IS NULL THEN RAISE EXCEPTION 'request required';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p->>'requestId',4));
 SELECT * INTO r FROM photo_service_v4.requests WHERE id=(p->>'requestId')::uuid;
 IF FOUND THEN
  IF r.actor IS DISTINCT FROM who OR r.payload IS DISTINCT FROM p OR p->>'op'='claim_permit' THEN RAISE EXCEPTION 'request conflict' USING ERRCODE='40001';END IF;
  RETURN r.result||'{"replayed":true}'::jsonb;
 END IF;
 IF p->>'op'='create' THEN
  INSERT INTO photo_service_v4.activities(id,actor,title,date,description) VALUES(photo_service_v4.allocate(),who,p->>'title',(p->>'date')::date,p->>'description') RETURNING * INTO a;
 ELSE
  SELECT * INTO STRICT a FROM photo_service_v4.activities WHERE id=(p->>'activityId')::uuid AND actor=who FOR UPDATE;
  IF p->>'op'='claim_permit' THEN
   SELECT value INTO STRICT item FROM jsonb_array_elements(photo_service_v4.jobs(a.id)) WHERE value->>'jobId'=p->>'jobId';
   IF item->>'requestId' IS DISTINCT FROM p->>'sourceRequestId' OR item->>'state'<>'pending' THEN RAISE EXCEPTION 'reservation required';END IF;
   INSERT INTO photo_service_v4.permits VALUES((p->>'jobId')::uuid,a.id,(p->>'requestId')::uuid,clock_timestamp());
   result:=jsonb_build_object('claimed',true);
   INSERT INTO photo_service_v4.requests VALUES((p->>'requestId')::uuid,who,p,result);RETURN result;
  END IF;
  v:=(p->>'revision')::bigint;IF v IS NULL OR v<0 OR v>=9007199254740991 OR v IS DISTINCT FROM a.revision THEN RAISE EXCEPTION 'CAS conflict' USING ERRCODE='40001';END IF;
  IF p->>'op'='reserve' THEN
   -- Core reservation owns photo IDs/paths and serializes max 10 / 45MiB.
   pub:=public.photo_finish_request_v2(jsonb_build_object('op','reserve','activity',a.id,'request',p->>'requestId','size',p->'size','mime',p->>'mime'));
   UPDATE photo_service_v4.activities SET photo_order=array_append(photo_order,(pub->>'photoId')::uuid),cover=coalesce(cover,(pub->>'photoId')::uuid) WHERE id=a.id;
  ELSIF p->>'op'='layout' THEN
   IF jsonb_typeof(p->'order') IS DISTINCT FROM 'array' OR p->>'cover' IS NULL THEN RAISE EXCEPTION 'layout required';END IF;
   SELECT array_agg(value::uuid ORDER BY ordinality) INTO ids FROM jsonb_array_elements_text(p->'order') WITH ORDINALITY;
   files:=photo_service_v4.jobs(a.id);n:=jsonb_array_length(files);
   IF n=0 OR n>10 OR cardinality(ids) IS DISTINCT FROM n OR (SELECT count(DISTINCT id) FROM unnest(ids)id)<>n OR NOT (p->>'cover')::uuid=ANY(ids) OR EXISTS(SELECT FROM jsonb_array_elements(files) WHERE value->>'state'<>'complete' OR NOT (value->>'photoId')::uuid=ANY(ids)) THEN RAISE EXCEPTION 'invalid full finalized order' USING ERRCODE='22023';END IF;
   UPDATE photo_service_v4.activities SET photo_order=ids,cover=(p->>'cover')::uuid WHERE id=a.id;
  ELSIF p->>'op'='visibility' THEN
   IF jsonb_typeof(p->'published') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'invalid publication';END IF;
   PERFORM public.photo_scope_visibility_v3(jsonb_build_object('activityId',a.id,'published',p->'published','version',photo_service_v4.public_version(a.id)));
  ELSE RAISE EXCEPTION 'operation disabled';END IF;
  UPDATE photo_service_v4.activities SET revision=revision+1 WHERE id=a.id RETURNING * INTO a;
 END IF;
 result:=jsonb_build_object('activityId',a.id,'revision',a.revision,'title',a.title,'date',a.date,'description',a.description,'order',to_jsonb(a.photo_order),'cover',a.cover,'published',photo_service_v4.public_valid(a.id))||coalesce(pub,'{}'::jsonb);
 -- The reservation's job revision is independent from the activity metadata CAS.
 IF p->>'op'='reserve' THEN result:=result||jsonb_build_object('revision',a.revision);END IF;
 INSERT INTO photo_service_v4.requests VALUES((p->>'requestId')::uuid,who,p,result);RETURN result;
END $$;
CREATE FUNCTION photo_service_v4.public_meta(a uuid) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT jsonb_build_object('activityId',id,'title',title,'date',date,'description',description,'revision',revision,'order',to_jsonb(photo_order),'cover',cover) FROM photo_service_v4.activities WHERE id=a AND photo_service_v4.public_valid(a) $$;
CREATE FUNCTION scope_private.allowed(b text,p text) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(auth.jwt()->>'iss'=(SELECT issuer FROM scope_private.configuration WHERE singleton) AND EXISTS(SELECT FROM scope_private.capabilities c WHERE c.jti::text=auth.jwt()->>'jti' AND c.subject::text=auth.jwt()->>'sub' AND c.role_name=auth.role() AND NOT c.revoked AND c.expires_at>clock_timestamp() AND ((b='history-activity-photos' AND c.temp_path=p) OR (b='history-activity-final-photos' AND c.final_path=p))),false)
$$;
ALTER FUNCTION photo_finish_v2.actor() OWNER TO postgres;
REVOKE ALL ON FUNCTION photo_finish_v2.actor() FROM PUBLIC,anon,authenticated,service_role,photo_finish_owner,photo_finish_attestor,photo_finish_worker,photo_scope_owner,photo_scope_reader,photo_scope_storage_reader,photo_service_owner,photo_storage_issuer,photo_storage_finalizer;
GRANT EXECUTE ON FUNCTION photo_finish_v2.actor() TO postgres;
ALTER FUNCTION photo_finish_v2.admin(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION photo_finish_v2.admin(uuid) FROM PUBLIC,anon,authenticated,service_role,photo_finish_owner,photo_finish_attestor,photo_finish_worker,photo_scope_owner,photo_scope_reader,photo_scope_storage_reader,photo_service_owner,photo_storage_issuer,photo_storage_finalizer;
GRANT EXECUTE ON FUNCTION photo_finish_v2.admin(uuid) TO postgres;
ALTER FUNCTION public.photo_finish_request_v2(jsonb) OWNER TO photo_finish_owner;
REVOKE ALL ON FUNCTION public.photo_finish_request_v2(jsonb) FROM PUBLIC,anon,authenticated,service_role,photo_finish_owner,photo_finish_attestor,photo_finish_worker,photo_scope_owner,photo_scope_reader,photo_scope_storage_reader,photo_service_owner,photo_storage_issuer,photo_storage_finalizer;
GRANT EXECUTE ON FUNCTION public.photo_finish_request_v2(jsonb) TO photo_finish_owner;
ALTER FUNCTION photo_finish_v2.job_json(photo_finish_v2.jobs) OWNER TO photo_finish_owner;
REVOKE ALL ON FUNCTION photo_finish_v2.job_json(photo_finish_v2.jobs) FROM PUBLIC,anon,authenticated,service_role,photo_finish_owner,photo_finish_attestor,photo_finish_worker,photo_scope_owner,photo_scope_reader,photo_scope_storage_reader,photo_service_owner,photo_storage_issuer,photo_storage_finalizer;
GRANT EXECUTE ON FUNCTION photo_finish_v2.job_json(photo_finish_v2.jobs) TO photo_finish_owner;
ALTER FUNCTION photo_finish_v2.inspect(uuid,uuid) OWNER TO photo_finish_owner;
REVOKE ALL ON FUNCTION photo_finish_v2.inspect(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role,photo_finish_owner,photo_finish_attestor,photo_finish_worker,photo_scope_owner,photo_scope_reader,photo_scope_storage_reader,photo_service_owner,photo_storage_issuer,photo_storage_finalizer;
GRANT EXECUTE ON FUNCTION photo_finish_v2.inspect(uuid,uuid) TO photo_finish_owner;
ALTER FUNCTION photo_finish_v2.attest(jsonb) OWNER TO photo_finish_owner;
REVOKE ALL ON FUNCTION photo_finish_v2.attest(jsonb) FROM PUBLIC,anon,authenticated,service_role,photo_finish_owner,photo_finish_attestor,photo_finish_worker,photo_scope_owner,photo_scope_reader,photo_scope_storage_reader,photo_service_owner,photo_storage_issuer,photo_storage_finalizer;
GRANT EXECUTE ON FUNCTION photo_finish_v2.attest(jsonb) TO photo_finish_owner;
ALTER FUNCTION photo_finish_v2.commit(jsonb) OWNER TO photo_finish_owner;
REVOKE ALL ON FUNCTION photo_finish_v2.commit(jsonb) FROM PUBLIC,anon,authenticated,service_role,photo_finish_owner,photo_finish_attestor,photo_finish_worker,photo_scope_owner,photo_scope_reader,photo_scope_storage_reader,photo_service_owner,photo_storage_issuer,photo_storage_finalizer;
GRANT EXECUTE ON FUNCTION photo_finish_v2.commit(jsonb) TO photo_finish_owner;
ALTER FUNCTION photo_finish_v2.cap(uuid,uuid,uuid,text,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION photo_finish_v2.cap(uuid,uuid,uuid,text,text) FROM PUBLIC,anon,authenticated,service_role,photo_finish_owner,photo_finish_attestor,photo_finish_worker,photo_scope_owner,photo_scope_reader,photo_scope_storage_reader,photo_service_owner,photo_storage_issuer,photo_storage_finalizer;
GRANT EXECUTE ON FUNCTION photo_finish_v2.cap(uuid,uuid,uuid,text,text) TO postgres;
ALTER FUNCTION photo_scope_v3.current_actor() OWNER TO postgres;
REVOKE ALL ON FUNCTION photo_scope_v3.current_actor() FROM PUBLIC,anon,authenticated,service_role,photo_finish_owner,photo_finish_attestor,photo_finish_worker,photo_scope_owner,photo_scope_reader,photo_scope_storage_reader,photo_service_owner,photo_storage_issuer,photo_storage_finalizer;
GRANT EXECUTE ON FUNCTION photo_scope_v3.current_actor() TO postgres;
ALTER FUNCTION photo_scope_v3.activity_actor(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION photo_scope_v3.activity_actor(uuid) FROM PUBLIC,anon,authenticated,service_role,photo_finish_owner,photo_finish_attestor,photo_finish_worker,photo_scope_owner,photo_scope_reader,photo_scope_storage_reader,photo_service_owner,photo_storage_issuer,photo_storage_finalizer;
GRANT EXECUTE ON FUNCTION photo_scope_v3.activity_actor(uuid) TO postgres;
ALTER FUNCTION photo_scope_v3.verified_state(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION photo_scope_v3.verified_state(uuid) FROM PUBLIC,anon,authenticated,service_role,photo_finish_owner,photo_finish_attestor,photo_finish_worker,photo_scope_owner,photo_scope_reader,photo_scope_storage_reader,photo_service_owner,photo_storage_issuer,photo_storage_finalizer;
GRANT EXECUTE ON FUNCTION photo_scope_v3.verified_state(uuid) TO postgres;
ALTER FUNCTION public.photo_scope_visibility_v3(jsonb) OWNER TO photo_scope_owner;
REVOKE ALL ON FUNCTION public.photo_scope_visibility_v3(jsonb) FROM PUBLIC,anon,authenticated,service_role,photo_finish_owner,photo_finish_attestor,photo_finish_worker,photo_scope_owner,photo_scope_reader,photo_scope_storage_reader,photo_service_owner,photo_storage_issuer,photo_storage_finalizer;
GRANT EXECUTE ON FUNCTION public.photo_scope_visibility_v3(jsonb) TO photo_scope_owner;
ALTER FUNCTION photo_scope_v3.read(jsonb) OWNER TO photo_scope_owner;
REVOKE ALL ON FUNCTION photo_scope_v3.read(jsonb) FROM PUBLIC,anon,authenticated,service_role,photo_finish_owner,photo_finish_attestor,photo_finish_worker,photo_scope_owner,photo_scope_reader,photo_scope_storage_reader,photo_service_owner,photo_storage_issuer,photo_storage_finalizer;
GRANT EXECUTE ON FUNCTION photo_scope_v3.read(jsonb) TO photo_scope_owner;
ALTER FUNCTION photo_scope_v3.allowed(text,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION photo_scope_v3.allowed(text,text) FROM PUBLIC,anon,authenticated,service_role,photo_finish_owner,photo_finish_attestor,photo_finish_worker,photo_scope_owner,photo_scope_reader,photo_scope_storage_reader,photo_service_owner,photo_storage_issuer,photo_storage_finalizer;
GRANT EXECUTE ON FUNCTION photo_scope_v3.allowed(text,text) TO postgres;
ALTER FUNCTION photo_service_v4.managed_job(uuid,uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION photo_service_v4.managed_job(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role,photo_finish_owner,photo_finish_attestor,photo_finish_worker,photo_scope_owner,photo_scope_reader,photo_scope_storage_reader,photo_service_owner,photo_storage_issuer,photo_storage_finalizer;
GRANT EXECUTE ON FUNCTION photo_service_v4.managed_job(uuid,uuid) TO postgres;
ALTER FUNCTION photo_service_v4.actor() OWNER TO postgres;
REVOKE ALL ON FUNCTION photo_service_v4.actor() FROM PUBLIC,anon,authenticated,service_role,photo_finish_owner,photo_finish_attestor,photo_finish_worker,photo_scope_owner,photo_scope_reader,photo_scope_storage_reader,photo_service_owner,photo_storage_issuer,photo_storage_finalizer;
GRANT EXECUTE ON FUNCTION photo_service_v4.actor() TO postgres;
ALTER FUNCTION photo_service_v4.allocate() OWNER TO photo_finish_owner;
REVOKE ALL ON FUNCTION photo_service_v4.allocate() FROM PUBLIC,anon,authenticated,service_role,photo_finish_owner,photo_finish_attestor,photo_finish_worker,photo_scope_owner,photo_scope_reader,photo_scope_storage_reader,photo_service_owner,photo_storage_issuer,photo_storage_finalizer;
GRANT EXECUTE ON FUNCTION photo_service_v4.allocate() TO photo_finish_owner;
ALTER FUNCTION photo_service_v4.jobs(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION photo_service_v4.jobs(uuid) FROM PUBLIC,anon,authenticated,service_role,photo_finish_owner,photo_finish_attestor,photo_finish_worker,photo_scope_owner,photo_scope_reader,photo_scope_storage_reader,photo_service_owner,photo_storage_issuer,photo_storage_finalizer;
GRANT EXECUTE ON FUNCTION photo_service_v4.jobs(uuid) TO postgres;
ALTER FUNCTION photo_service_v4.public_version(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION photo_service_v4.public_version(uuid) FROM PUBLIC,anon,authenticated,service_role,photo_finish_owner,photo_finish_attestor,photo_finish_worker,photo_scope_owner,photo_scope_reader,photo_scope_storage_reader,photo_service_owner,photo_storage_issuer,photo_storage_finalizer;
GRANT EXECUTE ON FUNCTION photo_service_v4.public_version(uuid) TO postgres;
ALTER FUNCTION photo_service_v4.public_valid(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION photo_service_v4.public_valid(uuid) FROM PUBLIC,anon,authenticated,service_role,photo_finish_owner,photo_finish_attestor,photo_finish_worker,photo_scope_owner,photo_scope_reader,photo_scope_storage_reader,photo_service_owner,photo_storage_issuer,photo_storage_finalizer;
GRANT EXECUTE ON FUNCTION photo_service_v4.public_valid(uuid) TO postgres;
ALTER FUNCTION public.photo_service_command_v4(jsonb) OWNER TO photo_service_owner;
REVOKE ALL ON FUNCTION public.photo_service_command_v4(jsonb) FROM PUBLIC,anon,authenticated,service_role,photo_finish_owner,photo_finish_attestor,photo_finish_worker,photo_scope_owner,photo_scope_reader,photo_scope_storage_reader,photo_service_owner,photo_storage_issuer,photo_storage_finalizer;
GRANT EXECUTE ON FUNCTION public.photo_service_command_v4(jsonb) TO photo_service_owner;
ALTER FUNCTION photo_service_v4.public_meta(uuid) OWNER TO photo_service_owner;
REVOKE ALL ON FUNCTION photo_service_v4.public_meta(uuid) FROM PUBLIC,anon,authenticated,service_role,photo_finish_owner,photo_finish_attestor,photo_finish_worker,photo_scope_owner,photo_scope_reader,photo_scope_storage_reader,photo_service_owner,photo_storage_issuer,photo_storage_finalizer;
GRANT EXECUTE ON FUNCTION photo_service_v4.public_meta(uuid) TO photo_service_owner;
ALTER FUNCTION scope_private.allowed(text,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION scope_private.allowed(text,text) FROM PUBLIC,anon,authenticated,service_role,photo_finish_owner,photo_finish_attestor,photo_finish_worker,photo_scope_owner,photo_scope_reader,photo_scope_storage_reader,photo_service_owner,photo_storage_issuer,photo_storage_finalizer;
GRANT EXECUTE ON FUNCTION scope_private.allowed(text,text) TO postgres;
GRANT EXECUTE ON FUNCTION photo_finish_v2.actor() TO photo_finish_owner;
GRANT EXECUTE ON FUNCTION photo_finish_v2.admin(uuid) TO photo_finish_owner;
GRANT EXECUTE ON FUNCTION photo_service_v4.actor() TO photo_finish_owner;
GRANT EXECUTE ON FUNCTION photo_finish_v2.inspect(uuid,uuid) TO photo_finish_attestor;
GRANT EXECUTE ON FUNCTION photo_finish_v2.attest(jsonb) TO photo_finish_attestor;
GRANT EXECUTE ON FUNCTION photo_finish_v2.cap(uuid,uuid,uuid,text,text) TO photo_finish_attestor;
GRANT EXECUTE ON FUNCTION photo_service_v4.managed_job(uuid,uuid) TO photo_finish_attestor;
GRANT EXECUTE ON FUNCTION photo_finish_v2.commit(jsonb) TO photo_finish_worker;
GRANT EXECUTE ON FUNCTION photo_scope_v3.current_actor() TO photo_scope_owner;
GRANT EXECUTE ON FUNCTION photo_scope_v3.activity_actor(uuid) TO photo_scope_owner;
GRANT EXECUTE ON FUNCTION photo_scope_v3.verified_state(uuid) TO photo_scope_owner;
GRANT EXECUTE ON FUNCTION photo_scope_v3.read(jsonb) TO photo_scope_reader;
GRANT EXECUTE ON FUNCTION photo_service_v4.public_meta(uuid) TO photo_scope_reader;
GRANT EXECUTE ON FUNCTION photo_scope_v3.allowed(text,text) TO photo_scope_storage_reader;
GRANT EXECUTE ON FUNCTION photo_service_v4.actor() TO photo_service_owner;
GRANT EXECUTE ON FUNCTION photo_service_v4.allocate() TO photo_service_owner;
GRANT EXECUTE ON FUNCTION photo_service_v4.jobs(uuid) TO photo_service_owner;
GRANT EXECUTE ON FUNCTION photo_service_v4.public_version(uuid) TO photo_service_owner;
GRANT EXECUTE ON FUNCTION photo_service_v4.public_valid(uuid) TO photo_service_owner;
GRANT EXECUTE ON FUNCTION public.photo_finish_request_v2(jsonb) TO photo_service_owner;
GRANT EXECUTE ON FUNCTION public.photo_scope_visibility_v3(jsonb) TO photo_service_owner;
GRANT EXECUTE ON FUNCTION scope_private.allowed(text,text) TO photo_storage_issuer;
GRANT EXECUTE ON FUNCTION scope_private.allowed(text,text) TO photo_storage_finalizer;
GRANT EXECUTE ON FUNCTION public.photo_finish_request_v2(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.photo_scope_visibility_v3(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.photo_service_command_v4(jsonb) TO authenticated;
GRANT USAGE ON SCHEMA scope_private TO photo_finish_owner;
GRANT USAGE ON SCHEMA photo_finish_v2 TO photo_finish_owner;
GRANT USAGE ON SCHEMA photo_scope_v3 TO photo_finish_owner;
GRANT USAGE ON SCHEMA photo_service_v4 TO photo_finish_owner;
GRANT USAGE ON SCHEMA scope_private TO photo_finish_attestor;
GRANT USAGE ON SCHEMA photo_finish_v2 TO photo_finish_attestor;
GRANT USAGE ON SCHEMA photo_scope_v3 TO photo_finish_attestor;
GRANT USAGE ON SCHEMA photo_service_v4 TO photo_finish_attestor;
GRANT USAGE ON SCHEMA scope_private TO photo_finish_worker;
GRANT USAGE ON SCHEMA photo_finish_v2 TO photo_finish_worker;
GRANT USAGE ON SCHEMA photo_scope_v3 TO photo_finish_worker;
GRANT USAGE ON SCHEMA photo_service_v4 TO photo_finish_worker;
GRANT USAGE ON SCHEMA scope_private TO photo_scope_owner;
GRANT USAGE ON SCHEMA photo_finish_v2 TO photo_scope_owner;
GRANT USAGE ON SCHEMA photo_scope_v3 TO photo_scope_owner;
GRANT USAGE ON SCHEMA photo_service_v4 TO photo_scope_owner;
GRANT USAGE ON SCHEMA scope_private TO photo_scope_reader;
GRANT USAGE ON SCHEMA photo_finish_v2 TO photo_scope_reader;
GRANT USAGE ON SCHEMA photo_scope_v3 TO photo_scope_reader;
GRANT USAGE ON SCHEMA photo_service_v4 TO photo_scope_reader;
GRANT USAGE ON SCHEMA scope_private TO photo_scope_storage_reader;
GRANT USAGE ON SCHEMA photo_finish_v2 TO photo_scope_storage_reader;
GRANT USAGE ON SCHEMA photo_scope_v3 TO photo_scope_storage_reader;
GRANT USAGE ON SCHEMA photo_service_v4 TO photo_scope_storage_reader;
GRANT USAGE ON SCHEMA scope_private TO photo_service_owner;
GRANT USAGE ON SCHEMA photo_finish_v2 TO photo_service_owner;
GRANT USAGE ON SCHEMA photo_scope_v3 TO photo_service_owner;
GRANT USAGE ON SCHEMA photo_service_v4 TO photo_service_owner;
GRANT USAGE ON SCHEMA scope_private TO photo_storage_issuer;
GRANT USAGE ON SCHEMA photo_finish_v2 TO photo_storage_issuer;
GRANT USAGE ON SCHEMA photo_scope_v3 TO photo_storage_issuer;
GRANT USAGE ON SCHEMA photo_service_v4 TO photo_storage_issuer;
GRANT USAGE ON SCHEMA scope_private TO photo_storage_finalizer;
GRANT USAGE ON SCHEMA photo_finish_v2 TO photo_storage_finalizer;
GRANT USAGE ON SCHEMA photo_scope_v3 TO photo_storage_finalizer;
GRANT USAGE ON SCHEMA photo_service_v4 TO photo_storage_finalizer;
GRANT photo_storage_issuer,photo_storage_finalizer,photo_scope_storage_reader TO authenticator;
GRANT USAGE ON SCHEMA storage TO photo_storage_issuer,photo_storage_finalizer,photo_scope_storage_reader;
GRANT SELECT ON storage.buckets TO photo_storage_issuer,photo_storage_finalizer,photo_scope_storage_reader;
GRANT INSERT ON storage.objects TO photo_storage_issuer;
GRANT SELECT,INSERT ON storage.objects TO photo_storage_finalizer;
GRANT SELECT ON storage.objects TO photo_scope_storage_reader;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES
('history-activity-photos','history-activity-photos',false,4718592,ARRAY['image/png','image/jpeg','image/webp']),
('history-activity-final-photos','history-activity-final-photos',false,4718592,ARRAY['image/png','image/jpeg','image/webp']);
CREATE POLICY hp_issue_temp ON storage.objects FOR INSERT TO photo_storage_issuer WITH CHECK(bucket_id='history-activity-photos' AND scope_private.allowed(bucket_id,name) AND storage.allow_only_operation('object.sign_upload_url'));
CREATE POLICY hp_read_temp ON storage.objects FOR SELECT TO photo_storage_finalizer USING(bucket_id='history-activity-photos' AND scope_private.allowed(bucket_id,name) AND storage.allow_only_operation('object.get_authenticated'));
CREATE POLICY hp_create_final ON storage.objects FOR INSERT TO photo_storage_finalizer WITH CHECK(bucket_id='history-activity-final-photos' AND scope_private.allowed(bucket_id,name) AND storage.allow_only_operation('object.upload'));
CREATE POLICY hp_verify_final ON storage.objects FOR SELECT TO photo_storage_finalizer USING(bucket_id='history-activity-final-photos' AND scope_private.allowed(bucket_id,name) AND storage.allow_only_operation('object.get_authenticated'));
CREATE POLICY hp_public_final ON storage.objects FOR SELECT TO photo_scope_storage_reader USING(bucket_id='history-activity-final-photos' AND photo_scope_v3.allowed(bucket_id,name) AND storage.allow_any_operation(ARRAY['object.sign','object.get_authenticated']));
REVOKE CREATE ON SCHEMA public,scope_private,photo_finish_v2,photo_scope_v3,photo_service_v4 FROM photo_finish_owner,photo_scope_owner,photo_service_owner;
REVOKE photo_finish_owner,photo_scope_owner,photo_service_owner FROM postgres;
COMMIT;
