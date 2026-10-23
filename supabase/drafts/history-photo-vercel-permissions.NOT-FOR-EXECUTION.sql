-- NOT-FOR-EXECUTION. Review scaffold only; no deployment approval.
-- No connection, parsing or policy creation has been tested against PostgreSQL.
-- This is NOT the existing integrated migration or an executable replacement.
BEGIN;
DO $$ BEGIN RAISE EXCEPTION 'BLOCKED: workload authentication, RPC signatures, ownership and Storage identity are unverified'; END $$;
-- After separate approval: inspect actual target/project and existing grants first.
-- Conflicting existing roles/schema MUST stop application, never overwrite them.
CREATE ROLE history_photo_rpc_owner NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
-- Login credential provision belongs to deployment owner, not this script.
CREATE ROLE history_photo_worker NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
CREATE SCHEMA history_photo_internal AUTHORIZATION history_photo_rpc_owner;
REVOKE ALL ON SCHEMA history_photo_internal FROM PUBLIC,anon,authenticated,service_role;
GRANT USAGE ON SCHEMA history_photo_internal TO history_photo_worker;
ALTER DEFAULT PRIVILEGES FOR ROLE history_photo_rpc_owner IN SCHEMA history_photo_internal REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC,anon,authenticated,service_role;
-- No EXECUTE granted yet. Exact typed signatures and implementation review required.
-- Administrator session RPC: create_activity, reserve_photos, set_layout,
-- unpublish_activity. Must use auth.uid(), getUser verification at app boundary,
-- admin_users recheck in SQL, request receipt + locked CAS + aggregate limits.
-- Server-only RPC: claim_finalization, record_permit, record_observation,
-- commit_finalization, inspect_recovery, commit_publication.
-- Public-only DTO function: read_public_manifest (no journal/temp paths).
-- All DEFINER functions: owner NOLOGIN, search_path='', qualified names, no
-- dynamic identifiers, explicit EXECUTE revoke on each function (default ACL
-- alone is insufficient), no worker membership in owner role or table rights.
-- Current server-db ROLE_AUDIT_SQL allows ONLY claim_finalization. Expanded
-- grants MUST NOT be installed until that audit and exact allowlist agree.
-- Required new tables: activities/photos, request receipts, permits, finalize
-- jobs, verified observations, immutable final bindings and deletion tombstones.
-- Constraints: <=10, each <=4718592, sum<=47185920; locks serialize reservations;
-- unique receipt, CAS nonnull >=0; exact membership, one cover, all-final publish.
-- No production table DDL invented here: signatures/state machine remain blocked.
-- Storage (separate owner/identity review; DB worker is NOT Storage identity):
-- private history-activity-photos / history-activity-final-photos only.
-- issuer: exact reserved temp path signed upload, upsert=false; no final writes.
-- finalizer: exact temp SELECT + final INSERT/SELECT, no UPDATE/DELETE.
-- reader: exact current published final SELECT only; broker fixed URL TTL=60.
-- Restrictive bucket fences must cover ALL existing permissive policies;
-- helper RPCs must validate actor/request/photo/path and current DB state.
-- No policies added until custom-role issuer and path binding are proven.
-- Never GRANT service_role, table DML, BYPASSRLS or role membership as a workaround.
-- Existing review tables/buckets/policies are outside this scope.
ROLLBACK;
