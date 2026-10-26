-- DESIGN V2 ONLY. NOT APPROVED FOR ANY DATABASE. DO NOT RUN.
-- Intended compatibility target: Production qkhlvdctdcpfyvohhikl (current full compatibility review pending).
-- No automatic project identification / deployment permission is implied.
-- The unconditional first guard prevents accidental execution of this design.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $$ BEGIN RAISE EXCEPTION 'DRAFT_ONLY: Production compatibility and explicit installation approval required'; END $$;
-- Future executable migration must be regenerated after approval, not by bypassing this guard.
DO $$
DECLARE n text;
BEGIN
 IF current_user<>'postgres' OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls)) THEN RAISE EXCEPTION 'STOP: expected existing owner permissions absent; do not widen roles'; END IF;
 FOREACH n IN ARRAY ARRAY['auth.users','public.admin_users','public.event_people','public.event_participation','public.event_sessions','public.event_session_attendance','public.recruitment_events','public.event_application_admin_list','storage.objects','storage.buckets'] LOOP
 IF to_regclass(n) IS NULL THEN RAISE EXCEPTION 'STOP: missing existing dependency %',n; END IF;
 END LOOP;
 FOREACH n IN ARRAY ARRAY['public.history_reviews','public.history_participant_links','public.history_participant_audit','public.history_participant_evidence'] LOOP
 IF to_regclass(n) IS NOT NULL THEN RAISE EXCEPTION 'STOP: existing object %; never replace/reuse blindly',n; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('history_can_create_review','history_manage_participant','validate_history_review')) THEN RAISE EXCEPTION 'STOP: function/overload collision'; END IF;
 IF EXISTS(SELECT 1 FROM storage.buckets WHERE id='history-review-photos' OR name='history-review-photos') THEN RAISE EXCEPTION 'STOP: existing bucket'; END IF;
 IF EXISTS(SELECT 1 FROM pg_policy WHERE polrelid=to_regclass('storage.objects') AND polname LIKE 'hrv2_%') THEN RAISE EXCEPTION 'STOP: policy collision'; END IF;
 IF EXISTS (WITH expected(relation,column_name,type_name) AS (VALUES
 ('auth.users','id','uuid'),('public.admin_users','user_id','uuid'),
 ('public.event_people','id','uuid'),
 ('public.event_application_admin_list','event_id','uuid'),('public.event_application_admin_list','id','uuid'),
 ('public.event_application_admin_list','source','text'),('public.event_application_admin_list','is_archived','boolean'),
 ('public.event_participation','person_id','uuid'),('public.event_participation','event_id','uuid'),
 ('public.event_participation','source','text'),('public.event_participation','application_id','uuid'),
 ('public.event_participation','confirmation','text'),('public.event_participation','attendance','text'),
 ('public.recruitment_events','id','uuid'),('public.recruitment_events','is_test','boolean'),('public.recruitment_events','starts_at','timestamp with time zone'),
 ('public.event_sessions','id','uuid'),('public.event_sessions','event_id','uuid'),('public.event_sessions','session_date','date'),
 ('public.event_session_attendance','session_id','uuid'),('public.event_session_attendance','event_id','uuid'),
 ('public.event_session_attendance','source','text'),('public.event_session_attendance','application_id','uuid'),('public.event_session_attendance','attendance','text')),
checks AS (SELECT e.*,a.atttypid,a.attname,format_type(a.atttypid,a.atttypmod) AS actual_type
 FROM expected e LEFT JOIN pg_attribute a ON a.attrelid=to_regclass(e.relation) AND a.attname=e.column_name AND a.attnum>0 AND NOT a.attisdropped)
SELECT 1 FROM checks WHERE NOT coalesce(atttypid=to_regtype(type_name),false)) THEN RAISE EXCEPTION 'STOP: dependency column/type mismatch'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid=to_regclass('storage.objects') AND relrowsecurity) THEN RAISE EXCEPTION 'STOP: existing Storage RLS required'; END IF;
 IF NOT has_schema_privilege(current_user,'public','CREATE') OR NOT has_table_privilege(current_user,'storage.buckets','INSERT') THEN
 RAISE EXCEPTION 'STOP: installer object privileges absent; do not widen roles'; END IF;
 -- BYPASSRLS alone does NOT confer CREATE POLICY. Supabase delegates policy
 -- management using supautils.policy_grants without changing table ownership.
 IF NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
 AND NOT pg_has_role(current_user,(SELECT relowner FROM pg_class WHERE oid='storage.objects'::regclass),'USAGE')
 AND NOT coalesce((nullif(current_setting('supautils.policy_grants',true),'')::jsonb->current_user) ? 'storage.objects',false) THEN
 RAISE EXCEPTION 'STOP: existing Storage policy-management authority absent'; END IF;

END $$;

-- Existing event_* tables/RPCs/policies are read dependencies ONLY.
-- Match the current attendance RPC's active-application boundary: archived
-- applications are not current eligibility evidence, even if old attendance remains.
CREATE TABLE public.history_participant_links (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
 person_id uuid NOT NULL UNIQUE REFERENCES public.event_people(id) ON DELETE RESTRICT,
 status text NOT NULL CHECK(status IN ('approved','revoked')),
 revision integer NOT NULL CHECK(revision>0),
 evidence_source text NOT NULL CHECK(evidence_source IN ('season9','registration','manual')),
 evidence_application uuid NOT NULL,
 updated_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE public.history_participant_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES public.history_participant_links(user_id) ON DELETE RESTRICT,
 revision integer NOT NULL CHECK(revision>0),
 action text NOT NULL CHECK(action IN ('approve','revoke')),
 actor uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 1 AND 2000),
 previous_state jsonb, next_state jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(user_id,revision)
);
ALTER TABLE public.history_participant_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.history_participant_links FORCE ROW LEVEL SECURITY;
ALTER TABLE public.history_participant_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.history_participant_audit FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.history_participant_links,public.history_participant_audit FROM PUBLIC,anon,authenticated,service_role;
-- No client SELECT/INSERT/UPDATE/DELETE policies on identity or audit records.

CREATE FUNCTION public.history_can_create_review() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT (SELECT auth.uid()) IS NOT NULL AND EXISTS (
 SELECT 1 FROM public.history_participant_links l
 WHERE l.user_id=(SELECT auth.uid()) AND l.status='approved' AND EXISTS (
 SELECT 1 FROM public.event_participation t
 JOIN public.recruitment_events e ON e.id=t.event_id
 WHERE t.person_id=l.person_id AND t.source=l.evidence_source AND t.application_id=l.evidence_application
 AND t.confirmation='confirmed' AND NOT e.is_test
 AND EXISTS(SELECT 1 FROM public.event_application_admin_list a
   WHERE a.event_id=t.event_id AND a.source=t.source AND a.id=t.application_id AND NOT a.is_archived)
 AND ((NOT EXISTS(SELECT 1 FROM public.event_sessions z WHERE z.event_id=e.id)
       AND e.starts_at IS NOT NULL AND e.starts_at<=CURRENT_TIMESTAMP AND t.attendance='attended')
      OR EXISTS(SELECT 1 FROM public.event_session_attendance d
       JOIN public.event_sessions s ON s.id=d.session_id AND s.event_id=d.event_id
       WHERE d.event_id=t.event_id AND d.source=t.source AND d.application_id=t.application_id
       AND d.attendance='attended' AND s.session_date<=(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date))
));
$$;
REVOKE ALL ON FUNCTION public.history_can_create_review() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.history_can_create_review() TO authenticated;

CREATE FUNCTION public.history_manage_participant(
 p_user uuid,p_person uuid,p_action text,p_revision integer,
 p_identity_confirmed boolean,p_source text,p_application uuid,p_reason text
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE old_row public.history_participant_links; new_row public.history_participant_links;
 caller uuid:=auth.uid();
BEGIN
 -- Check caller before looking up any submitted target IDs.
 IF caller IS NULL OR NOT EXISTS(SELECT 1 FROM public.admin_users WHERE user_id=caller) THEN
 RAISE EXCEPTION 'Administrator required' USING ERRCODE='42501'; END IF;
 IF p_user IS NULL OR p_person IS NULL OR p_action IS NULL OR p_action NOT IN ('approve','revoke')
 OR p_revision IS NULL OR p_revision<0 OR p_revision>=2147483647
 OR p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 1 AND 2000 THEN RAISE EXCEPTION 'Invalid approval request'; END IF;
 -- Serialize first approval and later revisions for this Auth account.
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user::text,0));
 SELECT * INTO old_row FROM public.history_participant_links WHERE user_id=p_user FOR UPDATE;
 IF coalesce(old_row.revision,0)<>p_revision THEN RAISE EXCEPTION 'Stale approval'; END IF;
 IF old_row.user_id IS NOT NULL AND old_row.person_id<>p_person THEN RAISE EXCEPTION 'Identity reassignment requires a separate reviewed procedure'; END IF;
 IF p_action='approve' THEN
 IF p_identity_confirmed IS DISTINCT FROM true OR p_source IS NULL OR p_application IS NULL THEN RAISE EXCEPTION 'Verified identity and attendance required'; END IF;
 IF NOT EXISTS (
 SELECT 1 FROM public.event_participation t
 JOIN public.recruitment_events e ON e.id=t.event_id
 WHERE t.person_id=p_person AND t.source=p_source AND t.application_id=p_application
 AND t.confirmation='confirmed' AND NOT e.is_test
 AND EXISTS(SELECT 1 FROM public.event_application_admin_list a
   WHERE a.event_id=t.event_id AND a.source=t.source AND a.id=t.application_id AND NOT a.is_archived)
 AND ((NOT EXISTS(SELECT 1 FROM public.event_sessions z WHERE z.event_id=e.id)
       AND e.starts_at IS NOT NULL AND e.starts_at<=CURRENT_TIMESTAMP AND t.attendance='attended')
      OR EXISTS(SELECT 1 FROM public.event_session_attendance d
       JOIN public.event_sessions s ON s.id=d.session_id AND s.event_id=d.event_id
       WHERE d.event_id=t.event_id AND d.source=t.source AND d.application_id=t.application_id
       AND d.attendance='attended' AND s.session_date<=(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date))
) THEN RAISE EXCEPTION 'No current eligible attendance'; END IF;
 INSERT INTO public.history_participant_links(user_id,person_id,status,revision,evidence_source,evidence_application,updated_by)
 VALUES(p_user,p_person,'approved',1,p_source,p_application,caller)
 ON CONFLICT(user_id) DO UPDATE SET status='approved',revision=public.history_participant_links.revision+1,
 evidence_source=excluded.evidence_source,evidence_application=excluded.evidence_application,updated_by=caller,updated_at=CURRENT_TIMESTAMP
 RETURNING * INTO new_row;
 ELSE
 IF old_row.user_id IS NULL THEN RAISE EXCEPTION 'No approval to revoke'; END IF;
 UPDATE public.history_participant_links SET status='revoked',revision=revision+1,updated_by=caller,updated_at=CURRENT_TIMESTAMP
 WHERE user_id=p_user RETURNING * INTO new_row;
 END IF;
 INSERT INTO public.history_participant_audit(user_id,revision,action,actor,reason,previous_state,next_state)
 VALUES(p_user,new_row.revision,p_action,caller,btrim(p_reason),CASE WHEN old_row.user_id IS NULL THEN NULL ELSE to_jsonb(old_row) END,to_jsonb(new_row));
 RETURN new_row.revision;
END $$;
REVOKE ALL ON FUNCTION public.history_manage_participant(uuid,uuid,text,integer,boolean,text,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.history_manage_participant(uuid,uuid,text,integer,boolean,text,uuid,text) TO authenticated;

create table public.history_reviews (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete restrict,
  display_name text not null default '익명' check (char_length(display_name) between 1 and 60),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  category text not null check (category in ('regular','special','other')),
  content text not null check (char_length(btrim(content)) between 1 and 10000),
  photo_paths text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint history_review_photo_count check (cardinality(photo_paths) <= 3 and array_position(photo_paths, null) is null)
);
create index history_reviews_order on public.history_reviews (created_at desc, id desc);
create index history_reviews_category_order on public.history_reviews (category, created_at desc, id desc);
create function public.validate_history_review() returns trigger
language plpgsql VOLATILE SECURITY INVOKER set search_path = '' as $$
declare photo text;
begin
  if TG_OP = 'UPDATE' then
    if new.author_id is distinct from old.author_id or new.id is distinct from old.id or new.created_at is distinct from old.created_at or new.display_name is distinct from old.display_name then
      raise exception 'Review identity is immutable';
    end if;
  else
    -- Caller identity first: never lock an arbitrary client-supplied author's key.
    if auth.uid() is null or new.author_id is distinct from auth.uid() then
      raise exception 'Authenticated author required' using errcode='42501';
    end if;
    -- This fresh-snapshot protocol is designed only for READ COMMITTED.
    if current_setting('transaction_isolation') <> 'read committed' then
      raise exception 'Review INSERT requires READ COMMITTED';
    end if;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text,0));
    -- Separate query AFTER acquiring the management RPC's same transaction lock.
    -- VOLATILE trigger gets a fresh query snapshot; the STABLE helper uses it.
    if not public.history_can_create_review() then
      raise exception 'Approved participation required' using errcode='42501';
    end if;
    new.created_at := now();
  end if;
  new.updated_at := now();
  foreach photo in array new.photo_paths loop
    if photo not like new.author_id::text || '/' || new.id::text || '/%' or photo !~ '^[0-9a-f-]+/[0-9a-f-]+/[0-9a-f-]+\.(jpg|png|webp)$' then
      raise exception 'Invalid photo ownership path';
    end if;
  end loop;
  return new;
end $$;
revoke all on function public.validate_history_review() from PUBLIC,anon,authenticated,service_role;
create trigger validate_history_review before insert or update on public.history_reviews for each row execute function public.validate_history_review();
revoke all on public.history_reviews from PUBLIC, anon, authenticated, service_role;
grant select on public.history_reviews to anon, authenticated;
grant insert (id,author_id,display_name,title,category,content,photo_paths) on public.history_reviews to authenticated;
grant update (title,category,content,photo_paths) on public.history_reviews to authenticated;
grant delete on public.history_reviews to authenticated;
alter table public.history_reviews enable row level security;
alter table public.history_reviews force row level security;
create policy history_reviews_read on public.history_reviews for select to anon, authenticated using (true);
create policy history_reviews_create on public.history_reviews for insert to authenticated with check ((select auth.uid()) = author_id);
create policy history_reviews_edit on public.history_reviews for update to authenticated using ((select auth.uid()) = author_id) with check ((select auth.uid()) = author_id);
create policy history_reviews_delete on public.history_reviews for delete to authenticated using ((select auth.uid()) = author_id);


-- Restrictive guard survives a separate permissive owner INSERT rule.
CREATE POLICY hrv2_review_insert_guard ON public.history_reviews AS RESTRICTIVE FOR INSERT TO PUBLIC
 WITH CHECK(CASE WHEN (SELECT auth.uid()) IS NULL THEN false ELSE author_id=(SELECT auth.uid()) AND (SELECT public.history_can_create_review()) END);

-- Separate review bucket; does not activate or alter history-simple-photos.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 VALUES('history-review-photos','history-review-photos',false,1048576,ARRAY['image/jpeg','image/png','image/webp']);
CREATE POLICY hrv2_storage_read ON storage.objects FOR SELECT TO anon,authenticated USING(
 bucket_id='history-review-photos' AND ((storage.foldername(name))[1]=(SELECT auth.uid())::text OR EXISTS(SELECT 1 FROM public.history_reviews r WHERE storage.objects.name=ANY(r.photo_paths))));
CREATE POLICY hrv2_storage_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(
 bucket_id='history-review-photos' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text);
CREATE POLICY hrv2_storage_delete ON storage.objects FOR DELETE TO authenticated USING(
 bucket_id='history-review-photos' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text);
-- Existing bucket privileges/policies remain unchanged. All guards return true elsewhere.
-- PUBLIC guards contain no authenticated-only RPC or new-table subquery.
-- This avoids permission checks on unreachable CASE branches affecting other roles.
CREATE POLICY hrv2_storage_role_guard ON storage.objects AS RESTRICTIVE FOR ALL TO PUBLIC
 USING(bucket_id<>'history-review-photos' OR current_user IN ('anon','authenticated'))
 WITH CHECK(bucket_id<>'history-review-photos' OR current_user IN ('anon','authenticated'));
CREATE POLICY hrv2_storage_identity_guard ON storage.objects AS RESTRICTIVE FOR INSERT TO PUBLIC WITH CHECK(
 CASE WHEN bucket_id<>'history-review-photos' THEN true ELSE
 current_user='authenticated' AND (SELECT auth.uid()) IS NOT NULL
 AND (storage.foldername(name))[1]=(SELECT auth.uid())::text
 AND name ~ '^[0-9a-f-]+/[0-9a-f-]+/[0-9a-f-]+\.(jpg|png|webp)$' END);
CREATE POLICY hrv2_storage_approval_guard ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(
 CASE WHEN bucket_id<>'history-review-photos' THEN true ELSE
 (SELECT public.history_can_create_review()) OR EXISTS(SELECT 1 FROM public.history_reviews r WHERE r.author_id=(SELECT auth.uid()) AND r.id::text=(storage.foldername(name))[2]) END);
CREATE POLICY hrv2_storage_read_guard ON storage.objects AS RESTRICTIVE FOR SELECT TO anon,authenticated USING(
 bucket_id<>'history-review-photos' OR ((storage.foldername(name))[1]=(SELECT auth.uid())::text OR EXISTS(SELECT 1 FROM public.history_reviews r WHERE storage.objects.name=ANY(r.photo_paths))));
CREATE POLICY hrv2_storage_delete_guard ON storage.objects AS RESTRICTIVE FOR DELETE TO PUBLIC USING(
 bucket_id<>'history-review-photos' OR (current_user='authenticated' AND (SELECT auth.uid()) IS NOT NULL AND (storage.foldername(name))[1]=(SELECT auth.uid())::text));
CREATE POLICY hrv2_storage_update_guard ON storage.objects AS RESTRICTIVE FOR UPDATE TO PUBLIC
 USING(bucket_id<>'history-review-photos') WITH CHECK(bucket_id<>'history-review-photos');

-- Final assertions affect only new objects; unexpected defaults abort everything.
DO $$
DECLARE target oid; expected_owner oid:='postgres'::regrole::oid;
BEGIN
 IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relname IN ('history_reviews','history_participant_links','history_participant_audit')
 AND c.relkind='r' AND c.relowner=expected_owner AND c.relrowsecurity AND c.relforcerowsecurity)<>3 THEN
 RAISE EXCEPTION 'STOP: new table ownership/RLS mismatch'; END IF;
 IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
 WHERE n.nspname='public' AND c.relname IN ('history_participant_links','history_participant_audit')
 AND a.grantee<>expected_owner) THEN RAISE EXCEPTION 'STOP: unexpected approval/audit table ACL'; END IF;
 IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
 WHERE n.nspname='public' AND c.relname='history_reviews' AND a.grantee<>expected_owner
 AND NOT ((a.grantee='anon'::regrole AND a.privilege_type='SELECT' AND NOT a.is_grantable)
 OR (a.grantee='authenticated'::regrole AND a.privilege_type IN ('SELECT','DELETE') AND NOT a.is_grantable))) THEN RAISE EXCEPTION 'STOP: unexpected review table ACL'; END IF;
 FOREACH target IN ARRAY ARRAY[
 'public.history_can_create_review()'::regprocedure::oid,
 'public.history_manage_participant(uuid,uuid,text,integer,boolean,text,uuid,text)'::regprocedure::oid,
 'public.validate_history_review()'::regprocedure::oid] LOOP
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=target AND proowner=expected_owner
 AND prokind='f' AND 'search_path=""'=ANY(coalesce(proconfig,ARRAY[]::text[]))
 AND prosecdef=(target<>'public.validate_history_review()'::regprocedure::oid)) THEN
 RAISE EXCEPTION 'STOP: function owner/definer/search_path mismatch'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
 WHERE p.oid=target AND a.grantee<>expected_owner AND
 (target='public.validate_history_review()'::regprocedure::oid OR a.grantee<>'authenticated'::regrole OR a.is_grantable)) THEN
 RAISE EXCEPTION 'STOP: unexpected function EXECUTE ACL'; END IF;
 IF has_function_privilege('anon',target,'EXECUTE') OR has_function_privilege('service_role',target,'EXECUTE') THEN
 RAISE EXCEPTION 'STOP: unexpected inherited function EXECUTE'; END IF;
 IF target<>'public.validate_history_review()'::regprocedure::oid AND NOT has_function_privilege('authenticated',target,'EXECUTE') THEN
 RAISE EXCEPTION 'STOP: authenticated RPC EXECUTE missing'; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM pg_attribute c
 CROSS JOIN LATERAL aclexplode(CASE WHEN cardinality(c.attacl)>0 THEN c.attacl ELSE NULL::aclitem[] END) a
 WHERE c.attrelid='public.history_reviews'::regclass AND c.attnum>0 AND NOT c.attisdropped
 AND a.grantee<>expected_owner AND NOT (a.grantee='authenticated'::regrole AND NOT a.is_grantable AND
 ((a.privilege_type='INSERT' AND c.attname=ANY(ARRAY['id','author_id','display_name','title','category','content','photo_paths']))
 OR (a.privilege_type='UPDATE' AND c.attname=ANY(ARRAY['title','category','content','photo_paths']))))) THEN
 RAISE EXCEPTION 'STOP: unexpected review column ACL'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(ARRAY['id','author_id','display_name','title','category','content','photo_paths']) x(name)
 WHERE NOT has_column_privilege('authenticated','public.history_reviews',x.name,'INSERT'))
 OR EXISTS(SELECT 1 FROM unnest(ARRAY['title','category','content','photo_paths']) x(name)
 WHERE NOT has_column_privilege('authenticated','public.history_reviews',x.name,'UPDATE')) THEN
 RAISE EXCEPTION 'STOP: required review column ACL missing'; END IF;
 IF has_function_privilege('authenticated','public.validate_history_review()','EXECUTE') THEN
 RAISE EXCEPTION 'STOP: trigger function must not be directly callable by API roles'; END IF;
 IF has_table_privilege('authenticated','public.history_reviews','INSERT,UPDATE,TRUNCATE,REFERENCES,TRIGGER')
 OR has_table_privilege('anon','public.history_reviews','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
 OR has_any_column_privilege('anon','public.history_reviews','INSERT,UPDATE,REFERENCES') THEN
 RAISE EXCEPTION 'STOP: review write ACL wider than intended'; END IF;
END $$;

-- Future executable migration must also verify exact policy bodies and column ACL lists.
-- No grants/revokes on storage.objects, no role changes, no existing event_* mutation.
COMMIT;
