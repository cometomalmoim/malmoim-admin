-- INTEGRATED NOT-FOR-EXECUTION / DO NOT APPLY / NO AUTH OR UPLOAD ACTIVATION
-- FRESH installation candidate ONLY: cannot be applied over 001 or journal objects.
-- SQL/PLpgSQL syntax, RLS/ACL, Storage policies and concurrency NOT DB-VALIDATED.
-- Do not remove guards or paste subsections. Derive a separately reviewed lab migration.
BEGIN;
DO $blocked$ BEGIN RAISE EXCEPTION 'NOT-FOR-EXECUTION: integrated activity photo draft'; END $blocked$;
-- Source 001 SHA256: d88995771b075271c31c7e1ff737c60fd9b53f2f8a2fe86458ac1f1f8a7dd676
-- Source journal SHA256: e3de009fc44e3ebb27d30d541368a17a5d228d448cb200f7fa1e350ecb826c66

-- PART A: original activity schema, revised limits and CLOSED mutation gates.
DO $preflight$
BEGIN
 IF current_setting('malmoim.activity_photo_approval',true) IS DISTINCT FROM 'approved-local-55422-v1'
 THEN RAISE EXCEPTION 'Separate user approval and verified lab runner required'; END IF;
 IF current_setting('malmoim.verified_project',true) IS DISTINCT FROM 'malmoim-review-auth-lab'
 OR current_setting('malmoim.verified_host_port',true) IS DISTINCT FROM '127.0.0.1:55422'
 OR current_setting('malmoim.verified_db_container',true) IS DISTINCT FROM 'cf128859882a3ca20549b8dc6aa77dea55f209ade39d6aca7996e911e922ba16'
 OR current_setting('malmoim.verified_storage_image',true) IS DISTINCT FROM 'public.ecr.aws/supabase/storage-api:v1.82.1'
 THEN RAISE EXCEPTION 'Missing external container/port/Storage-version attestation'; END IF;
 -- Attestations alone are NOT target proof: verify DB cluster identity as well.
 IF (SELECT system_identifier::text FROM pg_control_system())<>'7698203627437625379'
 OR current_database()<>'postgres' OR current_user<>'postgres' OR session_user<>'postgres'
 OR current_setting('role')<>'none' OR current_setting('server_version')<>'17.11'
 OR inet_server_port()<>5432
 THEN RAISE EXCEPTION 'Unexpected database cluster/role/version'; END IF;
 -- 5432 is the verified container backend port; it is NOT host DB54322.
 IF NOT has_schema_privilege('postgres','public','CREATE')
 OR NOT has_table_privilege('postgres','storage.objects','SELECT')
 OR NOT has_table_privilege('postgres','storage.buckets','INSERT')
 OR NOT has_table_privilege('postgres','public.admin_users','SELECT')
 OR NOT coalesce((current_setting('supautils.policy_grants',true)::jsonb->'postgres')
    @> '["storage.objects","storage.buckets"]'::jsonb,false)
 THEN RAISE EXCEPTION 'Missing reviewed application/policy privileges'; END IF;
 IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='storage' AND c.relname IN ('objects','buckets') AND c.relrowsecurity
 AND NOT c.relforcerowsecurity AND pg_get_userbyid(c.relowner)='supabase_storage_admin')<>2
 THEN RAISE EXCEPTION 'Storage ownership/RLS precondition changed'; END IF;
 IF (SELECT count(*) FROM information_schema.columns WHERE table_schema='storage'
 AND table_name='objects' AND ((column_name IN ('id','bucket_id','name','metadata','archived_at'))
 OR (column_name IN ('is_delete_marker','is_versioned') AND data_type='boolean')))<>7
 THEN RAISE EXCEPTION 'Storage object schema differs'; END IF;
 IF EXISTS(SELECT 1 FROM storage.buckets WHERE id='history-activity-photos')
 OR EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relname IN ('history_activities','history_activity_photos','history_activity_commands','history_activity_published_date'))
 OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname IN ('history_activity_assert_bucket','history_activity_photo_lock',
     'history_activity_validate','history_activity_is_admin','history_manage_activity','history_activity_storage_allowed'))
 OR EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage' AND policyname LIKE 'history_activity_%')
 THEN RAISE EXCEPTION 'New-object name collision; no overwrite/re-execution permitted'; END IF;
 IF NOT EXISTS(SELECT 1 FROM storage.buckets WHERE id='history-review-photos' AND public IS FALSE
   AND file_size_limit=1048576 AND type::text='STANDARD' AND versioning_status='DISABLED')
 OR (SELECT count(*) FROM pg_policies WHERE schemaname='storage' AND tablename='buckets')<>0
 OR (SELECT count(*) FROM pg_policies WHERE schemaname='storage' AND tablename='objects')<>4
 THEN RAISE EXCEPTION 'Existing bucket/policy snapshot changed'; END IF;
 IF to_regclass('public.history_reviews') IS NULL
 OR (SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid='public.admin_users'::regclass)<>'postgres'
 OR has_table_privilege('anon','public.admin_users','SELECT')
 OR has_table_privilege('authenticated','public.admin_users','INSERT,UPDATE,DELETE')
 THEN RAISE EXCEPTION 'Administrator/review dependency changed'; END IF;
END $preflight$;
-- Exact name/role/command/USING/WITH CHECK snapshot. Format/version drift stops safely.
DO $policies$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
 AND policyname='history_photos_participant_guard' AND permissive='RESTRICTIVE' AND cmd='INSERT'
 AND roles=ARRAY['authenticated']::name[]
 AND qual IS NOT DISTINCT FROM NULL AND with_check IS NOT DISTINCT FROM '((bucket_id <> ''history-review-photos''::text) OR (((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text) AND (name ~ ''^[0-9a-f-]+/[0-9a-f-]+/[0-9a-f-]+\.(jpg|png|webp)$''::text) AND (( SELECT history_can_create_review() AS history_can_create_review) OR (EXISTS ( SELECT 1
   FROM history_reviews r
  WHERE ((r.author_id = ( SELECT auth.uid() AS uid)) AND ((r.id)::text = (storage.foldername(objects.name))[2])))))))')
 THEN RAISE EXCEPTION 'Existing Storage policy differs from reviewed snapshot'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
 AND policyname='history_review_photos_create' AND permissive='PERMISSIVE' AND cmd='INSERT'
 AND roles=ARRAY['authenticated']::name[]
 AND qual IS NOT DISTINCT FROM NULL AND with_check IS NOT DISTINCT FROM '((bucket_id = ''history-review-photos''::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text) AND (name ~ ''^[0-9a-f-]+/[0-9a-f-]+/[0-9a-f-]+\.(jpg|png|webp)$''::text))')
 THEN RAISE EXCEPTION 'Existing Storage policy differs from reviewed snapshot'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
 AND policyname='history_review_photos_delete' AND permissive='PERMISSIVE' AND cmd='DELETE'
 AND roles=ARRAY['authenticated']::name[]
 AND qual IS NOT DISTINCT FROM '((bucket_id = ''history-review-photos''::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text))' AND with_check IS NOT DISTINCT FROM NULL)
 THEN RAISE EXCEPTION 'Existing Storage policy differs from reviewed snapshot'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
 AND policyname='history_review_photos_read' AND permissive='PERMISSIVE' AND cmd='SELECT'
 AND roles=ARRAY['anon','authenticated']::name[]
 AND qual IS NOT DISTINCT FROM '((bucket_id = ''history-review-photos''::text) AND (((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text) OR (EXISTS ( SELECT 1
   FROM history_reviews r
  WHERE (objects.name = ANY (r.photo_paths))))))' AND with_check IS NOT DISTINCT FROM NULL)
 THEN RAISE EXCEPTION 'Existing Storage policy differs from reviewed snapshot'; END IF;
END $policies$;

-- OBSERVED LAB ONLY: PostgreSQL17.11 / Storage1.82.1, NOT production evidence.
-- Requires existing public.admin_users(user_id) and Supabase Storage schema.
-- Preferred LAB executor: postgres, without SET ROLE or new privilege grants.
-- Observed supautils.policy_grants authorizes postgres policies on objects/buckets,
-- despite no membership in supabase_storage_admin. This is not a production claim.
-- Revalidate settings/role/ownership immediately before future reviewed DDL.
DO $$
BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres'
   OR NOT has_schema_privilege(current_user,'public','CREATE')
   OR NOT coalesce((current_setting('supautils.policy_grants',true)::jsonb->'postgres')
      @> '["storage.objects","storage.buckets"]'::jsonb,false)
   OR NOT has_table_privilege(current_user,'storage.buckets','INSERT')
 THEN RAISE EXCEPTION 'Reviewed postgres lab execution prerequisites missing'; END IF;
 -- Registered settings are evidence of configuration, not proof of DDL hook behavior.
 -- Container/project/55422 matching must also be checked outside SQL before connection.
END $$;

-- Called from ready/publication validation. Wrong bucket configuration fails closed.
CREATE FUNCTION public.history_activity_assert_bucket() RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM storage.buckets WHERE id='history-activity-photos'
   AND name='history-activity-photos' AND public IS FALSE AND type::text='STANDARD'
   AND versioning_status='DISABLED' AND lifecycle_configuration IS NULL
   AND lifecycle_configuration_generation IS NULL AND file_size_limit=4718592
   AND allowed_mime_types @> ARRAY['image/jpeg','image/png','image/webp']::text[]
   AND allowed_mime_types <@ ARRAY['image/jpeg','image/png','image/webp']::text[])
 THEN RAISE EXCEPTION 'Unexpected activity bucket configuration'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.history_activity_assert_bucket() FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE public.history_activities (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 120),
 activity_date date NOT NULL,
 category text NOT NULL CHECK (category IN ('regular','special')),
 cohort integer,
 description text NOT NULL CHECK (length(btrim(description)) BETWEEN 1 AND 2000),
 is_published boolean NOT NULL DEFAULT false,
 lifecycle text NOT NULL DEFAULT 'draft' CHECK(lifecycle IN ('draft','complete','deleting','deleted')),
 CHECK(NOT is_published OR lifecycle='complete'),
 cover_photo_id uuid,
 delete_requested_at timestamptz,
 revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((category='regular' AND cohort IS NOT NULL AND cohort>0)
     OR (category='special' AND cohort IS NULL))
);
CREATE TABLE public.history_activity_photos (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 activity_id uuid NOT NULL REFERENCES public.history_activities(id),
 storage_path text NOT NULL UNIQUE,
 alt text NOT NULL CHECK (length(btrim(alt)) BETWEEN 1 AND 500),
 position integer CHECK (position BETWEEN 0 AND 9),
 byte_size bigint NOT NULL CHECK (byte_size BETWEEN 1 AND 4718592),
 mime_type text NOT NULL CHECK (mime_type IN ('image/jpeg','image/png','image/webp')),
 state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','ready','delete_wait','deleting','deleted')),
 upload_in_flight boolean NOT NULL DEFAULT false,
 upload_ticket uuid,
 delete_requested_at timestamptz,
 cleanup_observed_at timestamptz,
 cleanup_checks integer NOT NULL DEFAULT 0 CHECK(cleanup_checks BETWEEN 0 AND 2),
 CONSTRAINT history_activity_photo_position_state CHECK(
   (state='deleted' AND position IS NULL AND NOT upload_in_flight)
   OR (state<>'deleted' AND position IS NOT NULL)),
 CONSTRAINT history_activity_photo_upload_ticket CHECK(NOT upload_in_flight OR upload_ticket IS NOT NULL),
 UNIQUE(activity_id,id),
 UNIQUE(activity_id,position) DEFERRABLE INITIALLY DEFERRED,
 CHECK (storage_path = activity_id::text || '/' || id::text ||
   CASE mime_type WHEN 'image/jpeg' THEN '.jpg' WHEN 'image/png' THEN '.png' ELSE '.webp' END)
);
ALTER TABLE public.history_activities ADD CONSTRAINT history_activity_cover_fk
 FOREIGN KEY(id,cover_photo_id) REFERENCES public.history_activity_photos(activity_id,id)
 DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX history_activity_published_date ON public.history_activities(activity_date DESC,id) WHERE is_published;

-- Serialize photo mutations under the parent row lock, including concurrent uploads.
-- IDs and ownership cannot be moved between activities.
CREATE FUNCTION public.history_activity_photo_lock() RETURNS trigger
 LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF TG_OP='UPDATE' AND (NEW.id<>OLD.id OR NEW.activity_id<>OLD.activity_id OR NEW.storage_path<>OLD.storage_path)
 THEN RAISE EXCEPTION 'Immutable photo identity'; END IF;
 IF TG_OP='DELETE' THEN
   PERFORM 1 FROM public.history_activities WHERE id=OLD.activity_id FOR UPDATE;
   RETURN OLD;
 END IF;
 PERFORM 1 FROM public.history_activities WHERE id=NEW.activity_id FOR UPDATE;
 RETURN NEW;
END $$;
CREATE TRIGGER history_activity_photo_lock BEFORE INSERT OR UPDATE OR DELETE
 ON public.history_activity_photos FOR EACH ROW EXECUTE FUNCTION public.history_activity_photo_lock();

-- Deferred checks allow atomic cover changes/reordering. Empty private drafts are allowed.
-- Finalized private and published activities require a ready cover; pending/deleting
-- resources must never become publicly visible. Metadata is verified under owner rights.
CREATE FUNCTION public.history_activity_validate() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE aid uuid; a public.history_activities%ROWTYPE; n bigint; total bigint; validate_media boolean;
BEGIN
 IF TG_TABLE_NAME='history_activities' THEN aid:=NEW.id;
 ELSIF TG_OP='DELETE' THEN aid:=OLD.activity_id;
 ELSE aid:=NEW.activity_id; END IF;
 SELECT * INTO a FROM public.history_activities WHERE id=aid FOR UPDATE;
 IF NOT FOUND THEN RETURN NULL; END IF;
 -- Private containment must work with corrupt/missing files or bucket drift.
 -- Photo events becoming ready and published activities still validate all media.
 validate_media:=a.is_published;
 IF TG_TABLE_NAME='history_activity_photos' AND TG_OP<>'DELETE' THEN
   validate_media:=validate_media OR NEW.state='ready';
 END IF;
 IF validate_media THEN PERFORM public.history_activity_assert_bucket(); END IF;
 SELECT count(*),coalesce(sum(byte_size),0) INTO n,total
 FROM public.history_activity_photos WHERE activity_id=aid AND state<>'deleted';
 IF n>10 OR total>47185920 THEN RAISE EXCEPTION 'Activity photo limit exceeded'; END IF;
 IF validate_media AND EXISTS (SELECT 1 FROM public.history_activity_photos p WHERE p.activity_id=aid AND p.state='ready'
   AND NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id='history-activity-photos'
     AND o.name=p.storage_path
     AND o.archived_at IS NULL AND o.is_delete_marker IS FALSE AND o.is_versioned IS FALSE
     AND jsonb_typeof(o.metadata)='object'
     AND CASE WHEN o.metadata->>'size' ~ '^[0-9]{1,7}$'
       THEN (o.metadata->>'size')::bigint=p.byte_size ELSE false END
     AND o.metadata->>'mimetype'=p.mime_type))
 THEN RAISE EXCEPTION 'Ready photo requires live completed object with matching metadata'; END IF;
 IF a.lifecycle='complete' OR a.is_published THEN
   IF a.cover_photo_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.history_activity_photos
     WHERE activity_id=aid AND id=a.cover_photo_id AND state='ready')
   THEN RAISE EXCEPTION 'Ready representative photo required'; END IF;
 END IF;
 IF (a.lifecycle='complete' OR a.is_published) AND EXISTS (SELECT 1 FROM public.history_activity_photos WHERE activity_id=aid AND state NOT IN ('ready','deleted'))
 THEN RAISE EXCEPTION 'Publish only complete activity'; END IF;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.history_activity_validate() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.history_activity_photo_lock() FROM PUBLIC,anon,authenticated,service_role;
CREATE CONSTRAINT TRIGGER history_activity_validate AFTER INSERT OR UPDATE ON public.history_activities
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.history_activity_validate();
CREATE CONSTRAINT TRIGGER history_activity_photos_validate AFTER INSERT OR UPDATE OR DELETE ON public.history_activity_photos
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.history_activity_validate();


-- Durable request receipts double as append-only audit; no FK to deletable activity.
CREATE TABLE public.history_activity_commands (
 actor uuid NOT NULL, request_id uuid NOT NULL, activity_id uuid NOT NULL,
 command jsonb NOT NULL, result jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(actor,request_id)
);
CREATE FUNCTION public.history_activity_is_admin() RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(auth.uid() IS NOT NULL AND auth.role()='authenticated'
 AND EXISTS(SELECT 1 FROM public.admin_users WHERE user_id=auth.uid()),false)
$$;
REVOKE ALL ON FUNCTION public.history_activity_is_admin() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.history_activity_is_admin() TO anon,authenticated;

-- Only this RPC writes app tables. No caller-supplied actor/paths/dynamic SQL.
-- Commands are specified in the companion design document. Every change is locked,
-- versioned, audited and idempotent per authenticated actor + request UUID.
CREATE FUNCTION public.history_manage_activity(
 p_action text, p_activity uuid, p_revision bigint, p_request uuid, p_payload jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 a public.history_activities%ROWTYPE; receipt public.history_activity_commands%ROWTYPE;
 cmd jsonb; answer jsonb; ids uuid[]; cover uuid; item jsonb; photo uuid;
 bytes bigint; mime text; aid uuid; next_revision bigint; old_count bigint;
BEGIN
 IF NOT public.history_activity_is_admin() THEN RAISE EXCEPTION 'Administrator required' USING ERRCODE='42501'; END IF;
 -- Integrated draft: administrator identity is NOT trusted-server evidence.
 IF p_action IN ('begin_upload','end_upload','observe_cleanup','finish_photo_delete','finish_delete','finalize','publish')
 THEN RAISE EXCEPTION 'Internal evidence path unresolved; action disabled' USING ERRCODE='42501'; END IF;
 IF p_request IS NULL OR p_payload IS NULL OR jsonb_typeof(p_payload)<>'object'
 OR p_action IS NULL OR p_action NOT IN ('create','edit','reserve','finalize','layout','publish','unpublish',
 'begin_photo_delete','finish_photo_delete','begin_delete','finish_delete','begin_upload','end_upload','observe_cleanup')
 THEN RAISE EXCEPTION 'Invalid command'; END IF;
 IF p_action IN ('create','edit','reserve','finalize','layout','publish','begin_upload') THEN
   PERFORM public.history_activity_assert_bucket();
 END IF;
 cmd:=jsonb_build_object('action',p_action,'activity',p_activity,'revision',p_revision,'payload',p_payload);
 -- Locks one request even if its activity was already removed by finish_delete.
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text||p_request::text,0));
 SELECT * INTO receipt FROM public.history_activity_commands WHERE actor=auth.uid() AND request_id=p_request;
 IF FOUND THEN
   IF receipt.command<>cmd THEN RAISE EXCEPTION 'Request ID reused for different input'; END IF;
   RETURN receipt.result;
 END IF;
 IF p_action='create' THEN
   IF p_activity IS NOT NULL OR p_revision IS NOT NULL THEN RAISE EXCEPTION 'Create takes no existing identity'; END IF;
   INSERT INTO public.history_activities(title,activity_date,category,cohort,description)
   VALUES(btrim(p_payload->>'title'),(p_payload->>'date')::date,p_payload->>'category',
     (p_payload->>'cohort')::integer,btrim(p_payload->>'description')) RETURNING * INTO a;
 ELSE
   IF p_activity IS NULL OR p_revision IS NULL THEN RAISE EXCEPTION 'Identity and revision required'; END IF;
   SELECT * INTO a FROM public.history_activities WHERE id=p_activity FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Activity unavailable'; END IF;
   IF a.revision<>p_revision THEN RAISE EXCEPTION 'Revision conflict: reload before editing' USING ERRCODE='40001'; END IF;
   IF a.lifecycle='deleted' THEN RAISE EXCEPTION 'Activity is tombstoned'; END IF;
   IF a.lifecycle='deleting' AND p_action NOT IN ('begin_delete','finish_delete','end_upload','observe_cleanup','unpublish')
   THEN RAISE EXCEPTION 'Activity deletion in progress'; END IF;
   -- Publishing/unpublishing are separate explicit operations. File/layout edits are private.
   IF a.is_published AND p_action NOT IN ('unpublish','begin_delete')
   THEN RAISE EXCEPTION 'Unpublish before editing'; END IF;
   IF p_action='edit' THEN
     UPDATE public.history_activities SET title=btrim(p_payload->>'title'),activity_date=(p_payload->>'date')::date,
       category=p_payload->>'category',cohort=(p_payload->>'cohort')::integer,
       description=btrim(p_payload->>'description') WHERE id=a.id;
   ELSIF p_action='reserve' THEN
     IF jsonb_typeof(p_payload->'photos') IS DISTINCT FROM 'array'
       OR jsonb_array_length(p_payload->'photos') NOT BETWEEN 1 AND 10
     THEN RAISE EXCEPTION 'Expected 1..10 photo reservations'; END IF;
     IF EXISTS(SELECT 1 FROM public.history_activity_photos WHERE activity_id=a.id AND state IN ('delete_wait','deleting'))
     THEN RAISE EXCEPTION 'Finish pending deletion first'; END IF;
     SELECT count(*) INTO old_count FROM public.history_activity_photos WHERE activity_id=a.id AND state<>'deleted';
     IF old_count+jsonb_array_length(p_payload->'photos')>10 THEN RAISE EXCEPTION 'Maximum 10 photos'; END IF;
     UPDATE public.history_activities SET lifecycle='draft' WHERE id=a.id;
     FOR item IN SELECT value FROM jsonb_array_elements(p_payload->'photos') LOOP
       photo:=gen_random_uuid(); bytes:=(item->>'bytes')::bigint; mime:=item->>'mime';
       INSERT INTO public.history_activity_photos(id,activity_id,storage_path,alt,position,byte_size,mime_type)
       VALUES(photo,a.id,a.id::text||'/'||photo::text||CASE mime WHEN 'image/jpeg' THEN '.jpg' WHEN 'image/png' THEN '.png' ELSE '.webp' END,
         btrim(item->>'alt'),(SELECT min(i) FROM generate_series(0,9) AS free(i) WHERE NOT EXISTS
           (SELECT 1 FROM public.history_activity_photos WHERE activity_id=a.id AND state<>'deleted' AND position=i)),bytes,mime);
     END LOOP;
   ELSIF p_action='begin_upload' THEN
     IF current_setting('malmoim.activity_upload_coordinator',true) IS DISTINCT FROM 'implemented-and-reviewed-v1'
     THEN RAISE EXCEPTION 'Upload coordinator/scanner not implemented or reviewed'; END IF;
     photo:=(p_payload->>'photo')::uuid;
     IF NOT EXISTS(SELECT 1 FROM public.history_activity_photos WHERE activity_id=a.id AND id=photo
       AND state='pending' AND NOT upload_in_flight)
     THEN RAISE EXCEPTION 'Upload unavailable or already running'; END IF;
     UPDATE public.history_activity_photos SET upload_in_flight=true,upload_ticket=gen_random_uuid(),
       cleanup_observed_at=NULL,cleanup_checks=0 WHERE activity_id=a.id AND id=photo;
   ELSIF p_action='end_upload' THEN
     -- Only a trusted server coordinator may report a conclusively terminated API request.
     -- A timeout/crash alone is NOT evidence that Storage has stopped writing.
     photo:=(p_payload->>'photo')::uuid;
     IF NOT EXISTS(SELECT 1 FROM public.history_activity_photos WHERE activity_id=a.id AND id=photo
       AND upload_in_flight AND upload_ticket=(p_payload->>'ticket')::uuid)
     THEN RAISE EXCEPTION 'Upload ticket mismatch'; END IF;
     UPDATE public.history_activity_photos SET upload_in_flight=false,
       state=CASE WHEN state='delete_wait' THEN 'deleting' ELSE state END,
       cleanup_observed_at=NULL,cleanup_checks=0 WHERE activity_id=a.id AND id=photo;
   ELSIF p_action IN ('finalize','layout') THEN
     IF jsonb_typeof(p_payload->'order') IS DISTINCT FROM 'array'
     THEN RAISE EXCEPTION 'Full ordered photo IDs required'; END IF;
     SELECT array_agg(value::uuid ORDER BY ord) INTO ids
       FROM jsonb_array_elements_text(p_payload->'order') WITH ORDINALITY AS x(value,ord);
     SELECT count(*) INTO old_count FROM public.history_activity_photos WHERE activity_id=a.id AND state<>'deleted';
     IF coalesce(cardinality(ids),0) NOT BETWEEN 1 AND 10 OR cardinality(ids)<>old_count
       OR (SELECT count(DISTINCT x) FROM unnest(ids) AS x)<>old_count
       OR EXISTS(SELECT 1 FROM public.history_activity_photos WHERE activity_id=a.id AND state<>'deleted' AND (state IN ('delete_wait','deleting') OR upload_in_flight OR NOT(id=ANY(ids))))
       OR EXISTS(SELECT 1 FROM unnest(ids) AS x WHERE NOT EXISTS
         (SELECT 1 FROM public.history_activity_photos p WHERE p.activity_id=a.id AND p.id=x AND p.state<>'deleted'))
     THEN RAISE EXCEPTION 'Order must contain each current photo exactly once'; END IF;
     cover:=(p_payload->>'cover')::uuid;
     IF cover IS NULL OR NOT(cover=ANY(ids)) THEN RAISE EXCEPTION 'One representative required'; END IF;
     IF p_action='layout' AND EXISTS(SELECT 1 FROM public.history_activity_photos WHERE activity_id=a.id AND state NOT IN ('ready','deleted'))
     THEN RAISE EXCEPTION 'Finalize uploads first'; END IF;
     -- SQL checks committed live metadata, not actual blob completion/content.
     -- Before this RPC the trusted application server must download/verify the
     -- uploaded bytes using Storage API. No client 'verified=true' is accepted.
     -- Deferred validator excludes archived/versioned/delete-marker rows and
     -- checks authoritative storage size/mimetype for every ready row.
     UPDATE public.history_activity_photos p SET position=x.ord::integer-1,state='ready'
       FROM unnest(ids) WITH ORDINALITY AS x(id,ord) WHERE p.id=x.id AND p.activity_id=a.id;
     UPDATE public.history_activities SET cover_photo_id=cover,lifecycle='complete' WHERE id=a.id;
   ELSIF p_action='publish' THEN
     IF a.lifecycle<>'complete' THEN RAISE EXCEPTION 'Complete photos and representative first'; END IF;
     UPDATE public.history_activities SET is_published=true WHERE id=a.id;
   ELSIF p_action='unpublish' THEN
     UPDATE public.history_activities SET is_published=false WHERE id=a.id;
   ELSIF p_action='begin_photo_delete' THEN
     photo:=(p_payload->>'photo')::uuid;
     IF NOT EXISTS(SELECT 1 FROM public.history_activity_photos WHERE activity_id=a.id AND id=photo AND state<>'deleted')
     THEN RAISE EXCEPTION 'Photo unavailable'; END IF;
     UPDATE public.history_activities SET lifecycle='draft',cover_photo_id=CASE WHEN cover_photo_id=photo THEN NULL ELSE cover_photo_id END WHERE id=a.id;
     UPDATE public.history_activity_photos SET state=CASE WHEN upload_in_flight THEN 'delete_wait' ELSE 'deleting' END,
       delete_requested_at=coalesce(delete_requested_at,clock_timestamp()),cleanup_observed_at=NULL,cleanup_checks=0
       WHERE activity_id=a.id AND id=photo;
   ELSIF p_action='observe_cleanup' THEN
     -- Call only after server API list/download verification. SQL additionally checks metadata.
     -- Two scans separated by >=60s are evidence, NOT a proof against arbitrarily late writes.
     photo:=(p_payload->>'photo')::uuid;
     IF NOT EXISTS(SELECT 1 FROM public.history_activity_photos WHERE activity_id=a.id AND id=photo
       AND state='deleting' AND NOT upload_in_flight)
     THEN RAISE EXCEPTION 'Deletion waits for upload termination'; END IF;
     IF EXISTS(SELECT 1 FROM storage.objects o JOIN public.history_activity_photos p ON p.storage_path=o.name
       WHERE p.activity_id=a.id AND p.id=photo AND o.bucket_id='history-activity-photos') THEN
       UPDATE public.history_activity_photos SET cleanup_checks=0,cleanup_observed_at=NULL WHERE activity_id=a.id AND id=photo;
     ELSE
       UPDATE public.history_activity_photos SET cleanup_checks=CASE
         WHEN cleanup_checks=0 THEN 1
         WHEN clock_timestamp()>=cleanup_observed_at+interval '60 seconds' THEN 2 ELSE cleanup_checks END,
         cleanup_observed_at=CASE WHEN cleanup_checks=0 THEN clock_timestamp() ELSE cleanup_observed_at END
       WHERE activity_id=a.id AND id=photo;
     END IF;
   ELSIF p_action='finish_photo_delete' THEN
     photo:=(p_payload->>'photo')::uuid;
     IF NOT EXISTS(SELECT 1 FROM public.history_activity_photos WHERE activity_id=a.id AND id=photo AND state='deleting' AND NOT upload_in_flight AND cleanup_checks=2)
     THEN RAISE EXCEPTION 'Two cleanup observations and terminated upload required'; END IF;
     IF EXISTS(SELECT 1 FROM storage.objects o JOIN public.history_activity_photos p ON p.storage_path=o.name
       WHERE p.activity_id=a.id AND p.id=photo AND o.bucket_id='history-activity-photos')
     THEN RAISE EXCEPTION 'Storage object still present'; END IF;
     -- Keep a permanent path tombstone: never lose tracking for a late Storage write.
     UPDATE public.history_activity_photos SET state='deleted',position=NULL WHERE activity_id=a.id AND id=photo;
   ELSIF p_action='begin_delete' THEN
     UPDATE public.history_activities SET is_published=false,lifecycle='deleting',cover_photo_id=NULL,
       delete_requested_at=coalesce(delete_requested_at,clock_timestamp()) WHERE id=a.id;
     UPDATE public.history_activity_photos SET state=CASE WHEN upload_in_flight THEN 'delete_wait' ELSE 'deleting' END,
       delete_requested_at=coalesce(delete_requested_at,clock_timestamp()),cleanup_observed_at=NULL,cleanup_checks=0
       WHERE activity_id=a.id AND state NOT IN ('deleted','delete_wait','deleting');
   ELSIF p_action='finish_delete' THEN
     IF a.lifecycle<>'deleting' THEN RAISE EXCEPTION 'Prepare activity deletion first'; END IF;
     IF EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='history-activity-photos' AND split_part(name,'/',1)=a.id::text)
     THEN RAISE EXCEPTION 'Storage cleanup incomplete'; END IF;
     IF EXISTS(SELECT 1 FROM public.history_activity_photos WHERE activity_id=a.id AND
       (upload_in_flight OR state='delete_wait' OR (state<>'deleted' AND cleanup_checks<>2)))
     THEN RAISE EXCEPTION 'Uploads or cleanup observations still pending'; END IF;
     UPDATE public.history_activity_photos SET state='deleted',position=NULL WHERE activity_id=a.id;
     UPDATE public.history_activities SET lifecycle='deleted' WHERE id=a.id;
     -- Metadata tombstones and audit receipts are deliberately retained, not physically deleted.
   END IF;
   UPDATE public.history_activities SET revision=revision+1 WHERE id=a.id RETURNING * INTO a;
 END IF;
 aid:=a.id; next_revision:=a.revision;
 answer:=jsonb_build_object('activity_id',aid,'revision',next_revision,'deleted',p_action='finish_delete');
 IF p_action IN ('reserve','begin_upload','begin_photo_delete','begin_delete','observe_cleanup') THEN
   answer:=answer||jsonb_build_object('photos',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'path',storage_path,'state',state,'upload_ticket',upload_ticket,'upload_in_flight',upload_in_flight,'cleanup_checks',cleanup_checks) ORDER BY position),'[]'::jsonb)
     FROM public.history_activity_photos WHERE activity_id=aid));
 END IF;
 INSERT INTO public.history_activity_commands(actor,request_id,activity_id,command,result)
 VALUES(auth.uid(),p_request,aid,cmd,answer);
 RETURN answer;
END $$;
REVOKE ALL ON FUNCTION public.history_manage_activity(text,uuid,bigint,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.history_manage_activity(text,uuid,bigint,uuid,jsonb) TO authenticated;

ALTER TABLE public.history_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.history_activity_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.history_activity_commands ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.history_activities,public.history_activity_photos,public.history_activity_commands FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.history_activities,public.history_activity_photos TO anon,authenticated;
GRANT SELECT ON public.history_activity_commands TO authenticated;
-- No direct INSERT/UPDATE/DELETE grants, including administrators. Definer RPC only.
CREATE POLICY history_activity_read ON public.history_activities FOR SELECT TO anon,authenticated
 USING((is_published AND lifecycle='complete') OR public.history_activity_is_admin());
CREATE POLICY history_activity_photo_read ON public.history_activity_photos FOR SELECT TO anon,authenticated
 USING(public.history_activity_is_admin() OR (state='ready' AND EXISTS(SELECT 1 FROM public.history_activities a
 WHERE a.id=activity_id AND a.is_published AND a.lifecycle='complete')));
CREATE POLICY history_activity_command_read ON public.history_activity_commands FOR SELECT TO authenticated
 USING(public.history_activity_is_admin());

-- RLS helper returns only a permission boolean; no storage query (avoids recursion).
-- RLS-probe locks are rolled back by Storage savepoints. They do NOT fence final writes.
-- Persistent tickets/deletion waits/tombstones require a future server coordinator and
-- cleanup scanner; even those do not make DB + Storage IO atomic.
CREATE FUNCTION public.history_activity_storage_allowed(p_mode text,p_path text) RETURNS boolean
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE aid uuid; allowed boolean;
BEGIN
 PERFORM public.history_activity_assert_bucket();
 IF p_mode='read' THEN
   IF public.history_activity_is_admin() THEN RETURN true; END IF;
   RETURN EXISTS(SELECT 1 FROM public.history_activity_photos p JOIN public.history_activities a ON a.id=p.activity_id
     WHERE p.storage_path=p_path AND p.state='ready' AND a.is_published AND a.lifecycle='complete');
 END IF;
 -- Direct/signed upload policy semantics and server cleanup identity unverified.
 -- Hard closed for ALL writes, even administrators; read branch above unchanged.
 IF p_mode IN ('insert','delete') THEN RETURN false; END IF;
 IF p_mode NOT IN ('insert','delete') OR NOT public.history_activity_is_admin() THEN RETURN false; END IF;
 SELECT activity_id INTO aid FROM public.history_activity_photos WHERE storage_path=p_path;
 IF NOT FOUND THEN RETURN false; END IF;
 PERFORM 1 FROM public.history_activities WHERE id=aid FOR SHARE;
 SELECT EXISTS(SELECT 1 FROM public.history_activity_photos p JOIN public.history_activities a ON a.id=p.activity_id
   WHERE p.storage_path=p_path AND NOT a.is_published AND
     ((p_mode='insert' AND p.state='pending' AND p.upload_in_flight AND a.lifecycle='draft') OR
      (p_mode='delete' AND p.state IN ('deleting','deleted') AND NOT p.upload_in_flight))) INTO allowed;
 RETURN allowed;
END $$;
REVOKE ALL ON FUNCTION public.history_activity_storage_allowed(text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.history_activity_storage_allowed(text,text) TO anon,authenticated;
-- STORAGE POLICY BLOCK: same preferred postgres executor via existing policy_grants.
-- Table owner remains supabase_storage_admin; policies have no independent owner.
-- Do not change schema/table owners, role memberships or global default privileges.
-- postgres public CREATE + Storage bucket INSERT + policy_grants are separate rights.
INSERT INTO storage.buckets(id,name,public,type,versioning_status,file_size_limit,allowed_mime_types)
 VALUES('history-activity-photos','history-activity-photos',false,'STANDARD','DISABLED',4718592,
 ARRAY['image/jpeg','image/png','image/webp']);
-- Explicit configuration check; no assertion of actual CREATE POLICY permissions.
DO $$ BEGIN PERFORM public.history_activity_assert_bucket(); END $$;
CREATE POLICY history_activity_storage_read ON storage.objects FOR SELECT TO anon,authenticated
 USING(CASE WHEN bucket_id='history-activity-photos' THEN public.history_activity_storage_allowed('read',name) ELSE false END);
CREATE POLICY history_activity_storage_upload ON storage.objects FOR INSERT TO authenticated
 WITH CHECK(CASE WHEN bucket_id='history-activity-photos' THEN public.history_activity_storage_allowed('insert',name) ELSE false END);
CREATE POLICY history_activity_storage_delete ON storage.objects FOR DELETE TO authenticated
 USING(CASE WHEN bucket_id='history-activity-photos' THEN public.history_activity_storage_allowed('delete',name) ELSE false END);

-- AND guards neutralize unrelated permissive OR grants on THIS bucket only.
-- UPDATE guard checks old AND new bucket, blocking overwrite and moves in/out.
CREATE POLICY history_activity_storage_read_guard ON storage.objects AS RESTRICTIVE FOR SELECT TO PUBLIC
 USING(CASE WHEN bucket_id='history-activity-photos' THEN public.history_activity_storage_allowed('read',name) ELSE true END);
CREATE POLICY history_activity_storage_insert_guard ON storage.objects AS RESTRICTIVE FOR INSERT TO PUBLIC
 WITH CHECK(CASE WHEN bucket_id='history-activity-photos' THEN public.history_activity_storage_allowed('insert',name) ELSE true END);
CREATE POLICY history_activity_storage_delete_guard ON storage.objects AS RESTRICTIVE FOR DELETE TO PUBLIC
 USING(CASE WHEN bucket_id='history-activity-photos' THEN public.history_activity_storage_allowed('delete',name) ELSE true END);
CREATE POLICY history_activity_storage_update_guard ON storage.objects AS RESTRICTIVE FOR UPDATE TO PUBLIC
 USING(bucket_id<>'history-activity-photos') WITH CHECK(bucket_id<>'history-activity-photos');
-- BYPASSRLS/table owner/service_role are outside this protection. Storage signed
-- upload capabilities and S3/service paths are NOT authorized for this workflow.
-- Final catalogue assertions for a FUTURE approved application, NOT executed here.
-- Account for independent default ACL grants, not just PUBLIC privilege inheritance.
DO $$
DECLARE f record; is_helper boolean; t text;
BEGIN
 FOR f IN SELECT p.oid,p.proname,p.proowner,p.prosecdef,p.proconfig
   FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname IN ('history_activity_assert_bucket',
    'history_activity_photo_lock','history_activity_validate','history_activity_is_admin',
    'history_manage_activity','history_activity_storage_allowed')
 LOOP
   IF pg_get_userbyid(f.proowner)<>'postgres' THEN RAISE EXCEPTION 'Unexpected function owner'; END IF;
   IF (f.proname<>'history_activity_photo_lock' AND NOT f.prosecdef)
      OR NOT coalesce('search_path=""'=ANY(f.proconfig),false)
   THEN RAISE EXCEPTION 'Unexpected function security configuration'; END IF;
   is_helper:=f.proname IN ('history_activity_is_admin','history_activity_storage_allowed');
   IF has_function_privilege('service_role',f.oid,'EXECUTE')
      OR has_function_privilege('anon',f.oid,'EXECUTE')<>is_helper
      OR has_function_privilege('authenticated',f.oid,'EXECUTE')<>(is_helper OR f.proname='history_manage_activity')
   THEN RAISE EXCEPTION 'Unexpected app function execution privileges'; END IF;
 END LOOP;
 FOREACH t IN ARRAY ARRAY['public.history_activities','public.history_activity_photos','public.history_activity_commands'] LOOP
   IF has_table_privilege('anon',t,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
     OR has_table_privilege('authenticated',t,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
     OR has_table_privilege('service_role',t,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
   THEN RAISE EXCEPTION 'Unexpected direct table privileges'; END IF;
 END LOOP;
END $$;
-- has_* functions inspect effective grants. BYPASSRLS does not grant table/EXECUTE
-- privileges by itself; owners/superusers and other operational roles stay trusted.
-- No application worker using service_role is part of this first implementation.

-- Preconditions above are checked BEFORE any new object is created.
-- Existing Storage policy objects remain unchanged; new policies add exactly seven.
DO $postflight$
BEGIN
 IF (SELECT count(*) FROM pg_policies WHERE schemaname='storage' AND tablename='objects')<>11
 OR (SELECT count(*) FROM pg_policies WHERE schemaname='storage' AND tablename='buckets')<>0
 THEN RAISE EXCEPTION 'Unexpected Storage policy count'; END IF;
 IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname IN ('history_activity_assert_bucket','history_activity_photo_lock',
 'history_activity_validate','history_activity_is_admin','history_manage_activity','history_activity_storage_allowed'))<>6
 THEN RAISE EXCEPTION 'Unexpected function inventory'; END IF;
END $postflight$;

-- PART B: journal, original hard-closed server authority and report retained.
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
 AND byte_size BETWEEN 1 AND 4718592 AND mime_type IN ('image/jpeg','image/png','image/webp')
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
 IF p_revision IS NULL OR p_revision < 0 OR p_revision > 9007199254740991
 THEN RAISE EXCEPTION 'Invalid expected revision' USING ERRCODE='22023'; END IF;
 SELECT activity_id INTO aid FROM history_upload_private.jobs WHERE request_id=p_request AND actor_id=p_actor;
 IF NOT FOUND THEN RAISE EXCEPTION 'Job unavailable'; END IF;
 SELECT * INTO a FROM public.history_activities WHERE id=aid FOR UPDATE;
 SELECT * INTO j FROM history_upload_private.jobs WHERE request_id=p_request FOR UPDATE;
 IF j.revision IS DISTINCT FROM p_revision THEN RETURN false; END IF;
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
 HAVING count(*)<>j.expected_count OR coalesce(sum(byte_size),0)>47185920)
 OR EXISTS(SELECT 1 FROM public.history_activity_photos WHERE activity_id=aid AND state<>'deleted'
 GROUP BY activity_id HAVING count(*)>10 OR sum(byte_size)>47185920)
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

-- PART C: direct-upload permit history and independent observations.
-- ALTER applies ONLY to objects created in this candidate's own transaction.
ALTER TABLE history_upload_private.files
 ADD COLUMN content_digest text CHECK(content_digest ~ '^[a-f0-9]{64}$'),
 ADD COLUMN tracking_revision bigint NOT NULL DEFAULT 0 CHECK(tracking_revision BETWEEN 0 AND 9007199254740991),
 ADD COLUMN tombstone boolean NOT NULL DEFAULT false,
 ADD COLUMN needs_recheck boolean NOT NULL DEFAULT true;

CREATE TABLE history_upload_private.permits (
 permit_id uuid PRIMARY KEY,
 request_id uuid NOT NULL, slot integer NOT NULL,
 dispatch_id uuid NOT NULL,
 issued_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 provider_expires_at timestamptz NOT NULL,
 state text NOT NULL CHECK(state IN ('issuance_uncertain','issued','dispatch_claimed','uncertain')),
 deletion_seen_at timestamptz,
 -- No bearer token, URL, credentials or file bytes. Expiry is NOT termination.
 CHECK(provider_expires_at>issued_at),
 FOREIGN KEY(request_id,slot) REFERENCES history_upload_private.files(request_id,slot) ON DELETE RESTRICT,
 UNIQUE(request_id,slot,dispatch_id)
);
CREATE INDEX upload_permits_path_tracking ON history_upload_private.permits(request_id,slot,provider_expires_at);
CREATE TABLE history_upload_private.observations (
 observation_id uuid PRIMARY KEY,
 request_id uuid NOT NULL, slot integer NOT NULL,
 tracking_revision bigint NOT NULL,
 ticket uuid NOT NULL, dispatch_id uuid NOT NULL,
 -- Receipt is bound to the FULL immutable job/photo/path/digest through file FK
 -- and explicit append checks; generation is provider evidence, not a DB lock.
 checked_at timestamptz NOT NULL, recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 first_sample_at timestamptz NOT NULL, second_sample_at timestamptz NOT NULL,
 generation text NOT NULL CHECK(length(generation) BETWEEN 1 AND 512),
 status text NOT NULL CHECK(status IN ('content_matches','absent','mismatch')),
 termination text NOT NULL DEFAULT 'unproven' CHECK(termination='unproven'),
 downloaded_size bigint CHECK(downloaded_size BETWEEN 0 AND 9007199254740991),
 decoded_mime text, observed_digest text,
 metadata_size bigint, metadata_mime text,
 decodable boolean, archived boolean, delete_marker boolean, incomplete boolean,
 evidence_ref uuid NOT NULL,
 FOREIGN KEY(request_id,slot) REFERENCES history_upload_private.files(request_id,slot) ON DELETE RESTRICT,
 UNIQUE(request_id,slot,tracking_revision),
 CHECK(first_sample_at<=second_sample_at AND second_sample_at<=checked_at),
 CHECK(status<>'content_matches' OR
   (downloaded_size IS NOT NULL AND decoded_mime IS NOT NULL AND observed_digest IS NOT NULL AND metadata_size IS NOT NULL AND metadata_mime IS NOT NULL AND decoded_mime IN ('image/jpeg','image/png','image/webp')
   AND observed_digest ~ '^[a-f0-9]{64}$' AND metadata_size=downloaded_size
   AND metadata_mime=decoded_mime AND decodable IS TRUE AND archived IS FALSE
   AND delete_marker IS FALSE AND incomplete IS FALSE))
);
CREATE INDEX upload_observations_latest ON history_upload_private.observations(request_id,slot,recorded_at DESC,observation_id);
ALTER TABLE history_upload_private.permits ENABLE ROW LEVEL SECURITY;
ALTER TABLE history_upload_private.observations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON history_upload_private.permits,history_upload_private.observations FROM PUBLIC,anon,authenticated,service_role;

-- Batch mapping, not photo creation: original server reserve receipt must exist.
-- All mapping commits in one CAS; full receipt provenance still activation blocker.
CREATE FUNCTION history_upload_private.reserve_batch(p_actor uuid,p_request uuid,p_revision bigint,p_photos uuid[])
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j history_upload_private.jobs%ROWTYPE; aid uuid; n integer;
BEGIN
 PERFORM history_upload_private.require_server(p_actor,false);
 IF p_revision IS NULL OR p_revision < 0 OR p_revision > 9007199254740991
 THEN RAISE EXCEPTION 'Invalid expected revision' USING ERRCODE='22023'; END IF;
 SELECT activity_id INTO aid FROM history_upload_private.jobs WHERE request_id=p_request AND actor_id=p_actor;
 IF NOT FOUND THEN RAISE EXCEPTION 'Unknown request'; END IF;
 PERFORM 1 FROM public.history_activities WHERE id=aid FOR UPDATE;
 SELECT * INTO j FROM history_upload_private.jobs WHERE request_id=p_request FOR UPDATE;
 IF j.revision IS DISTINCT FROM p_revision THEN RETURN false; END IF;
 IF j.phase<>'claimed' OR j.delete_requested OR p_photos IS NULL OR cardinality(p_photos)<>j.expected_count
 OR array_ndims(p_photos) IS DISTINCT FROM 1 OR array_lower(p_photos,1)<>1
 OR EXISTS(SELECT 1 FROM unnest(p_photos) x WHERE x IS NULL)
 OR (SELECT count(DISTINCT x) FROM unnest(p_photos) x)<>j.expected_count
 OR EXISTS(SELECT 1 FROM public.history_activities WHERE id=aid AND (delete_requested_at IS NOT NULL OR lifecycle IN ('deleting','deleted')))
 OR EXISTS(SELECT 1 FROM public.history_activity_photos WHERE activity_id=aid AND state IN ('delete_wait','deleting'))
 OR EXISTS(SELECT 1 FROM history_upload_private.files WHERE request_id=p_request AND photo_id IS NOT NULL)
 THEN RAISE EXCEPTION 'Invalid/deleting batch'; END IF;
 SELECT count(*) INTO n FROM public.history_activity_photos
 WHERE activity_id=aid AND id=ANY(p_photos) AND state='pending' AND NOT upload_in_flight;
 IF n<>j.expected_count OR EXISTS(SELECT 1 FROM public.history_activity_photos WHERE activity_id=aid AND state<>'deleted'
 GROUP BY activity_id HAVING count(*)>10 OR sum(byte_size)>47185920)
 THEN RAISE EXCEPTION 'Photo/capacity mismatch'; END IF;
 UPDATE history_upload_private.files f SET photo_id=p.id,storage_path=p.storage_path,byte_size=p.byte_size,mime_type=p.mime_type
 FROM public.history_activity_photos p
 WHERE f.request_id=p_request AND p.id=p_photos[f.slot+1] AND p.activity_id=aid;
 UPDATE history_upload_private.jobs SET revision=revision+1,phase='reserved',updated_at=clock_timestamp() WHERE request_id=p_request;
 INSERT INTO history_upload_private.events(request_id,revision,kind) VALUES(p_request,j.revision+1,'reserve');
 RETURN true;
END $$;

-- New evidence append: server capability unresolved => require_server ALWAYS rejects.
-- No caller can change this with a boolean. Input evidence is not self-authenticating.
CREATE FUNCTION history_upload_private.append_observation(
 p_actor uuid,p_observation uuid,p_request uuid,p_slot integer,p_tracking_revision bigint,
 p_ticket uuid,p_dispatch uuid,p_path text,p_digest text,p_generation text,
 p_first timestamptz,p_second timestamptz,p_checked timestamptz,
 p_status text,p_evidence uuid,p_size bigint DEFAULT NULL,p_mime text DEFAULT NULL,
 p_metadata_size bigint DEFAULT NULL,p_metadata_mime text DEFAULT NULL,
 p_observed_digest text DEFAULT NULL,p_decodable boolean DEFAULT NULL,
 p_archived boolean DEFAULT NULL,p_delete_marker boolean DEFAULT NULL,p_incomplete boolean DEFAULT NULL)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j history_upload_private.jobs%ROWTYPE; f history_upload_private.files%ROWTYPE;
 aid uuid; t timestamptz;
BEGIN
 PERFORM history_upload_private.require_server(p_actor,true);
 IF p_tracking_revision IS NULL OR p_tracking_revision < 0 OR p_tracking_revision > 9007199254740991
 THEN RAISE EXCEPTION 'Invalid expected revision' USING ERRCODE='22023'; END IF;
 SELECT activity_id INTO aid FROM history_upload_private.jobs WHERE request_id=p_request AND actor_id=p_actor;
 IF NOT FOUND THEN RAISE EXCEPTION 'Unknown tracking request'; END IF;
 PERFORM 1 FROM public.history_activities WHERE id=aid FOR UPDATE;
 SELECT * INTO j FROM history_upload_private.jobs WHERE request_id=p_request FOR UPDATE;
 SELECT * INTO f FROM history_upload_private.files WHERE request_id=p_request AND slot=p_slot FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Unknown tracking path'; END IF;
 IF f.tracking_revision IS DISTINCT FROM p_tracking_revision THEN RETURN false; END IF;
 -- Refresh after ALL activity/job/file row locks: lock waits consume freshness.
 t:=clock_timestamp();
 IF f.ticket IS NULL OR f.dispatch_id IS NULL OR f.content_digest IS NULL
 OR p_ticket IS DISTINCT FROM f.ticket OR p_dispatch IS DISTINCT FROM f.dispatch_id
 OR p_path IS DISTINCT FROM f.storage_path OR p_digest IS DISTINCT FROM f.content_digest
 OR p_first IS NULL OR p_second IS NULL OR p_checked IS NULL OR p_generation IS NULL
 OR NOT pg_catalog.isfinite(p_first) OR NOT pg_catalog.isfinite(p_second) OR NOT pg_catalog.isfinite(p_checked)
 OR p_first>p_second OR p_second>p_checked OR p_checked>t OR t-p_first>interval '5 seconds'
 OR p_status IS NULL OR p_status NOT IN ('content_matches','absent','mismatch')
 THEN RAISE EXCEPTION 'Observation binding/freshness mismatch'; END IF;
 IF p_status='content_matches' AND
 (p_size IS DISTINCT FROM f.byte_size OR p_mime IS DISTINCT FROM f.mime_type
 OR p_metadata_size IS DISTINCT FROM f.byte_size OR p_metadata_mime IS DISTINCT FROM f.mime_type
 OR p_observed_digest IS DISTINCT FROM f.content_digest OR p_decodable IS DISTINCT FROM true
 OR p_archived IS DISTINCT FROM false OR p_delete_marker IS DISTINCT FROM false OR p_incomplete IS DISTINCT FROM false)
 THEN RAISE EXCEPTION 'Content evidence mismatch'; END IF;
 INSERT INTO history_upload_private.observations(observation_id,request_id,slot,tracking_revision,ticket,dispatch_id,
 checked_at,first_sample_at,second_sample_at,generation,status,evidence_ref,downloaded_size,decoded_mime,
 metadata_size,metadata_mime,observed_digest,decodable,archived,delete_marker,incomplete)
 VALUES(p_observation,p_request,p_slot,p_tracking_revision,p_ticket,p_dispatch,p_checked,p_first,p_second,p_generation,
 p_status,p_evidence,p_size,p_mime,p_metadata_size,p_metadata_mime,p_observed_digest,p_decodable,p_archived,p_delete_marker,p_incomplete);
 UPDATE history_upload_private.files SET tracking_revision=tracking_revision+1,needs_recheck=true
 WHERE request_id=p_request AND slot=p_slot;
 UPDATE history_upload_private.jobs SET recovery_required=true WHERE request_id=p_request;
 -- NEVER set completed, ready, end_confirmed, last_confirmed_at or clear tombstones.
 -- Freshness and row CAS do NOT lock external Storage generations.
 -- No SQL transaction can verify no external write occurs after these samples.
 RETURN true;
END $$;

-- Persistent scanner input: exact recorded paths ONLY. Retains deleted paths and
-- expired permits. No Storage enumeration or delete SQL/API exists in this function.
CREATE FUNCTION history_upload_private.tracked_page(p_actor uuid,p_after_request uuid DEFAULT NULL,
 p_after_slot integer DEFAULT NULL,p_limit integer DEFAULT 100)
 RETURNS SETOF history_upload_private.files LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM history_upload_private.require_server(p_actor,true);
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 OR (p_after_request IS NULL)<>(p_after_slot IS NULL)
 THEN RAISE EXCEPTION 'Invalid tracking cursor'; END IF;
 RETURN QUERY SELECT f.* FROM history_upload_private.files f JOIN history_upload_private.jobs j USING(request_id)
 WHERE j.actor_id=p_actor AND f.photo_id IS NOT NULL
 AND (p_after_request IS NULL OR (f.request_id,f.slot)>(p_after_request,p_after_slot))
 ORDER BY f.request_id,f.slot LIMIT p_limit;
 -- Repeated scans required for inserts behind cursor; no TTL or completed filter.
END $$;

-- Delete intent wrapper: journal + existing activity/photo containment in one DB
-- transaction. Does NOT terminate uploads or delete files/records. Parent first.
CREATE FUNCTION history_upload_private.request_delete(p_actor uuid,p_activity uuid,p_revision bigint)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a public.history_activities%ROWTYPE; j record; t timestamptz:=clock_timestamp();
BEGIN
 PERFORM history_upload_private.require_server(p_actor,false);
 IF p_revision IS NULL OR p_revision < 1 OR p_revision > 9007199254740991
 THEN RAISE EXCEPTION 'Invalid expected revision' USING ERRCODE='22023'; END IF;
 SELECT * INTO a FROM public.history_activities WHERE id=p_activity FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Unknown activity'; END IF;
 IF a.revision IS DISTINCT FROM p_revision THEN RETURN false; END IF;
 -- No ownership restriction: actual administrator may contain the whole activity.
 FOR j IN SELECT * FROM history_upload_private.jobs WHERE activity_id=p_activity ORDER BY request_id FOR UPDATE LOOP
   UPDATE history_upload_private.jobs SET delete_requested=true,delete_requested_at=coalesce(delete_requested_at,t),
    phase='deletion_pending',issue='deletion_requested',revision=revision+1,recovery_required=true,updated_at=t WHERE request_id=j.request_id;
   INSERT INTO history_upload_private.events(request_id,revision,kind) VALUES(j.request_id,j.revision+1,'delete');
 END LOOP;
 UPDATE history_upload_private.files SET tombstone=true,needs_recheck=true,tracking_revision=tracking_revision+1 WHERE activity_id=p_activity;
 UPDATE history_upload_private.permits SET deletion_seen_at=coalesce(deletion_seen_at,t)
 WHERE request_id IN (SELECT request_id FROM history_upload_private.jobs WHERE activity_id=p_activity);
 UPDATE public.history_activities SET is_published=false,lifecycle=CASE WHEN lifecycle='deleted' THEN 'deleted' ELSE 'deleting' END,cover_photo_id=NULL,
 delete_requested_at=coalesce(delete_requested_at,t),revision=revision+1 WHERE id=p_activity;
 UPDATE public.history_activity_photos SET state=CASE WHEN upload_in_flight THEN 'delete_wait' ELSE 'deleting' END,
 delete_requested_at=coalesce(delete_requested_at,t),cleanup_observed_at=NULL,cleanup_checks=0
 WHERE activity_id=p_activity AND state NOT IN ('deleted','delete_wait','deleting');
 RETURN true;
END $$;

-- Still unresolved: permit issuance/claim with trusted provider expiration, content
-- digest binding, completion prefix/report, role identity and generation provenance.
-- These are HARD blockers. No role/credential/EXECUTE grant or automatic cleanup.
REVOKE ALL ON ALL TABLES IN SCHEMA history_upload_private FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA history_upload_private FROM PUBLIC,anon,authenticated,service_role;
-- Definition-only sanity, not a substitute for future independent read-only ACL/FK/
-- trigger/role/policy verification or SQL compilation and concurrent execution tests.
DO $$ BEGIN
 IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='history_upload_private' AND c.relkind='r')<>5
 THEN RAISE EXCEPTION 'Unexpected private table inventory'; END IF;
END $$;
ROLLBACK;
