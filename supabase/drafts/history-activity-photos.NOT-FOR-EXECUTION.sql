-- DESIGN DRAFT ONLY / 실행 금지 / 운영 마이그레이션 아님.
-- Security/RPC design draft; statically reviewed ONLY, never applied or DB-tested.
-- Do not put in migrations or run through db push. Deliberately fails immediately.
BEGIN;
DO $$ BEGIN RAISE EXCEPTION 'Unapproved design draft: DO NOT EXECUTE'; END $$;

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
   AND lifecycle_configuration_generation IS NULL AND file_size_limit=5242880
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
 lifecycle text NOT NULL DEFAULT 'draft' CHECK(lifecycle IN ('draft','complete','deleting')),
 CHECK(NOT is_published OR lifecycle='complete'),
 cover_photo_id uuid,
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
 position integer NOT NULL CHECK (position BETWEEN 0 AND 9),
 byte_size bigint NOT NULL CHECK (byte_size BETWEEN 1 AND 5242880),
 mime_type text NOT NULL CHECK (mime_type IN ('image/jpeg','image/png','image/webp')),
 state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','ready','deleting')),
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
DECLARE aid uuid; a public.history_activities%ROWTYPE; n bigint; total bigint;
BEGIN
 IF TG_TABLE_NAME='history_activities' THEN aid:=NEW.id;
 ELSIF TG_OP='DELETE' THEN aid:=OLD.activity_id;
 ELSE aid:=NEW.activity_id; END IF;
 SELECT * INTO a FROM public.history_activities WHERE id=aid FOR UPDATE;
 IF NOT FOUND THEN RETURN NULL; END IF;
 PERFORM public.history_activity_assert_bucket();
 SELECT count(*),coalesce(sum(byte_size),0) INTO n,total
 FROM public.history_activity_photos WHERE activity_id=aid;
 IF n>10 OR total>52428800 THEN RAISE EXCEPTION 'Activity photo limit exceeded'; END IF;
 IF EXISTS (SELECT 1 FROM public.history_activity_photos p WHERE p.activity_id=aid AND p.state='ready'
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
 IF (a.lifecycle='complete' OR a.is_published) AND EXISTS (SELECT 1 FROM public.history_activity_photos WHERE activity_id=aid AND state<>'ready')
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
 PERFORM public.history_activity_assert_bucket();
 IF p_request IS NULL OR p_payload IS NULL OR jsonb_typeof(p_payload)<>'object'
 OR p_action IS NULL OR p_action NOT IN ('create','edit','reserve','finalize','layout','publish','unpublish',
 'begin_photo_delete','finish_photo_delete','begin_delete','finish_delete')
 THEN RAISE EXCEPTION 'Invalid command'; END IF;
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
   IF a.lifecycle='deleting' AND p_action NOT IN ('begin_delete','finish_delete')
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
     IF EXISTS(SELECT 1 FROM public.history_activity_photos WHERE activity_id=a.id AND state='deleting')
     THEN RAISE EXCEPTION 'Finish pending deletion first'; END IF;
     SELECT count(*) INTO old_count FROM public.history_activity_photos WHERE activity_id=a.id;
     IF old_count+jsonb_array_length(p_payload->'photos')>10 THEN RAISE EXCEPTION 'Maximum 10 photos'; END IF;
     UPDATE public.history_activities SET lifecycle='draft' WHERE id=a.id;
     FOR item IN SELECT value FROM jsonb_array_elements(p_payload->'photos') LOOP
       photo:=gen_random_uuid(); bytes:=(item->>'bytes')::bigint; mime:=item->>'mime';
       INSERT INTO public.history_activity_photos(id,activity_id,storage_path,alt,position,byte_size,mime_type)
       VALUES(photo,a.id,a.id::text||'/'||photo::text||CASE mime WHEN 'image/jpeg' THEN '.jpg' WHEN 'image/png' THEN '.png' ELSE '.webp' END,
         btrim(item->>'alt'),(SELECT min(i) FROM generate_series(0,9) AS free(i) WHERE NOT EXISTS
           (SELECT 1 FROM public.history_activity_photos WHERE activity_id=a.id AND position=i)),bytes,mime);
     END LOOP;
   ELSIF p_action IN ('finalize','layout') THEN
     IF jsonb_typeof(p_payload->'order') IS DISTINCT FROM 'array'
     THEN RAISE EXCEPTION 'Full ordered photo IDs required'; END IF;
     SELECT array_agg(value::uuid ORDER BY ord) INTO ids
       FROM jsonb_array_elements_text(p_payload->'order') WITH ORDINALITY AS x(value,ord);
     SELECT count(*) INTO old_count FROM public.history_activity_photos WHERE activity_id=a.id;
     IF coalesce(cardinality(ids),0) NOT BETWEEN 1 AND 10 OR cardinality(ids)<>old_count
       OR (SELECT count(DISTINCT x) FROM unnest(ids) AS x)<>old_count
       OR EXISTS(SELECT 1 FROM public.history_activity_photos WHERE activity_id=a.id AND (state='deleting' OR NOT(id=ANY(ids))))
       OR EXISTS(SELECT 1 FROM unnest(ids) AS x WHERE NOT EXISTS
         (SELECT 1 FROM public.history_activity_photos p WHERE p.activity_id=a.id AND p.id=x))
     THEN RAISE EXCEPTION 'Order must contain each current photo exactly once'; END IF;
     cover:=(p_payload->>'cover')::uuid;
     IF cover IS NULL OR NOT(cover=ANY(ids)) THEN RAISE EXCEPTION 'One representative required'; END IF;
     IF p_action='layout' AND EXISTS(SELECT 1 FROM public.history_activity_photos WHERE activity_id=a.id AND state<>'ready')
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
     IF NOT EXISTS(SELECT 1 FROM public.history_activity_photos WHERE activity_id=a.id AND id=photo)
     THEN RAISE EXCEPTION 'Photo unavailable'; END IF;
     UPDATE public.history_activities SET lifecycle='draft',cover_photo_id=CASE WHEN cover_photo_id=photo THEN NULL ELSE cover_photo_id END WHERE id=a.id;
     UPDATE public.history_activity_photos SET state='deleting' WHERE activity_id=a.id AND id=photo;
   ELSIF p_action='finish_photo_delete' THEN
     photo:=(p_payload->>'photo')::uuid;
     IF NOT EXISTS(SELECT 1 FROM public.history_activity_photos WHERE activity_id=a.id AND id=photo AND state='deleting')
     THEN RAISE EXCEPTION 'Prepare deletion first'; END IF;
     IF EXISTS(SELECT 1 FROM storage.objects o JOIN public.history_activity_photos p ON p.storage_path=o.name
       WHERE p.activity_id=a.id AND p.id=photo AND o.bucket_id='history-activity-photos')
     THEN RAISE EXCEPTION 'Storage object still present'; END IF;
     DELETE FROM public.history_activity_photos WHERE activity_id=a.id AND id=photo AND state='deleting';
   ELSIF p_action='begin_delete' THEN
     UPDATE public.history_activities SET is_published=false,lifecycle='deleting',cover_photo_id=NULL WHERE id=a.id;
     UPDATE public.history_activity_photos SET state='deleting' WHERE activity_id=a.id;
   ELSIF p_action='finish_delete' THEN
     IF a.lifecycle<>'deleting' THEN RAISE EXCEPTION 'Prepare activity deletion first'; END IF;
     IF EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='history-activity-photos' AND split_part(name,'/',1)=a.id::text)
     THEN RAISE EXCEPTION 'Storage cleanup incomplete'; END IF;
     DELETE FROM public.history_activity_photos WHERE activity_id=a.id;
     DELETE FROM public.history_activities WHERE id=a.id;
   END IF;
   IF p_action<>'finish_delete' THEN
     UPDATE public.history_activities SET revision=revision+1 WHERE id=a.id RETURNING * INTO a;
   END IF;
 END IF;
 aid:=a.id; next_revision:=a.revision;
 answer:=jsonb_build_object('activity_id',aid,'revision',next_revision,'deleted',p_action='finish_delete');
 IF p_action IN ('reserve','begin_photo_delete','begin_delete') THEN
   answer:=answer||jsonb_build_object('photos',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'path',storage_path,'state',state) ORDER BY position),'[]'::jsonb)
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
-- Default VOLATILE: upload/delete checks hold parent share lock until Storage's SQL
-- transaction ends, serializing them against RPC parent FOR UPDATE. No external IO.
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
 IF p_mode NOT IN ('insert','delete') OR NOT public.history_activity_is_admin() THEN RETURN false; END IF;
 SELECT activity_id INTO aid FROM public.history_activity_photos WHERE storage_path=p_path;
 IF NOT FOUND THEN RETURN false; END IF;
 PERFORM 1 FROM public.history_activities WHERE id=aid FOR SHARE;
 SELECT EXISTS(SELECT 1 FROM public.history_activity_photos p JOIN public.history_activities a ON a.id=p.activity_id
   WHERE p.storage_path=p_path AND NOT a.is_published AND
     ((p_mode='insert' AND p.state='pending' AND a.lifecycle='draft') OR
      (p_mode='delete' AND p.state='deleting'))) INTO allowed;
 RETURN allowed;
END $$;
REVOKE ALL ON FUNCTION public.history_activity_storage_allowed(text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.history_activity_storage_allowed(text,text) TO anon,authenticated;
-- STORAGE POLICY BLOCK: same preferred postgres executor via existing policy_grants.
-- Table owner remains supabase_storage_admin; policies have no independent owner.
-- Do not change schema/table owners, role memberships or global default privileges.
-- postgres public CREATE + Storage bucket INSERT + policy_grants are separate rights.
INSERT INTO storage.buckets(id,name,public,type,versioning_status,file_size_limit,allowed_mime_types)
 VALUES('history-activity-photos','history-activity-photos',false,'STANDARD','DISABLED',5242880,
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
ROLLBACK;
