# Production review installation gate — not approved for execution

Target: qkhlvdctdcpfyvohhikl. User reports existing event/admin tables and absence of all history review tables/bucket. The full returned catalogue (24 column types, active-application view, installer attributes, existing Storage policies/ACLs) has not been supplied here. No live DB access or SQL execution was performed.

## Final SQL review

`01_production_install_candidate_DRAFT.sql` remains unchanged. The separate `01_production_install_candidate_v3_BLOCKED.sql` retains an unconditional DRAFT_ONLY guard and is NOT a finalized executable installer.

The previous final ACL condition is correct: `has_table_privilege` rejects table-wide INSERT/UPDATE; intended column-level grants are separately allowed/required. `has_any_column_privilege` is used only for anon denial. Do not replace the authenticated table check with has_any_column_privilege: that would reject the legitimate grants. Reference: https://www.postgresql.org/docs/current/functions-info.html#FUNCTIONS-INFO-ACCESS-TABLE

V3 adds existing Storage schema/helper/SELECT/INSERT/DELETE privilege preconditions (no grants), plus exact effective authenticated column checks, including inherited privileges and grant options. Allowed INSERT columns remain id/author_id/display_name/title/category/content/photo_paths; allowed UPDATE columns remain title/category/content/photo_paths. No existing policies, review DDL or permissions were weakened. All Storage policy predicates remain byte-for-byte identical to V2.

Two definer functions use empty search_path, postgres ownership asserted, authenticated EXECUTE only, internal auth.uid and admin_users checks. Trigger is invoker, direct API EXECUTE revoked. Auth/person unique mapping, confirmed/non-test/non-archived completed attendance evidence and per-user approval/INSERT locks are retained. Cross-bucket guards return true for other buckets, but compatibility also depends on their existing restrictive policies. Photos and recruitment reviews are untouched.

Remaining gates: complete catalogue compatibility; compare existing Storage predicates against the new bucket; confirm installer policy delegation; review schema/default grants; agree FK RESTRICT retention (linked users/persons/admin actors cannot simply be deleted), one-hour signed URL validity and snapshot behavior during concurrent attendance corrections. Then prepare exact policy/ACL postconditions in the executable release. Counts alone are not proof. Local in-memory ACL tests are not hosted Supabase Storage API E2E.

## Administrator operator procedure (no new UI)

There is currently NO administrator UI calling history_manage_participant in src. Installing SQL does not create an approval screen or automatically approve existing event participants. The existing event approval screen cannot be assumed to perform this Auth identity mapping.

A designated existing admin must first verify the real Auth user's identity against an existing event_people participant and a valid application/source. Use an approved authenticated Supabase client with that admin's actual session, not anon/service_role credentials and not SQL Editor postgres without auth context. Never paste access tokens in chat or logs.

Exact RPC call shape (illustrative placeholders, not runnable test records):

```ts
const { data: nextRevision, error } = await authenticatedAdminClient.rpc('history_manage_participant', {
  p_user: verifiedAuthUserId,
  p_person: existingParticipantId,
  p_action: 'approve',
  p_revision: 0, // first link only; subsequent calls use last returned revision
  p_identity_confirmed: true,
  p_source: existingApplicationSource, // season9 | registration | manual
  p_application: existingApplicationId,
  p_reason: verifiedIdentityReason,
});
```

For revoke: same user/person, p_action='revoke', current returned revision, meaningful reason. Identity confirmation/evidence are not used to revoke; supply existing source/application as appropriate. Do not retry stale approvals blindly. Retain returned revision in the controlled operator record; recovery requires an approved privileged lookup, not granting direct client SELECT on links/audit. RPC rejects non-admins, missing attendance, archived applications, identity reassignment and revision conflicts.

A secure operator client/workflow with an existing admin session is a prerequisite for manual approval. No such UI or credentials are created by this change. If operators require a UI, it needs separate scope/approval; this audit does not add it.

## Minimum rollout

1. Supply complete current readonly preflight JSON from the confirmed Dashboard project (catalogue only, no credentials/user rows).
2. Resolve the gates above; approve the final executable transaction separately. Do not run either blocked file or just strip its guard.
3. After approved install, run 02_verify_readonly.sql plus exact effective ACL/predicate comparison. No original event migrations or photo installer rerun.
4. Through the approved admin operator workflow, approve one consenting real participant with existing legitimate attendance; verify self-RPC true, then voluntarily create a genuine review in Korean/English. Unapproved/anonymous calls must fail; no fake Production review or participant data.

No Production SQL, data changes, pushes or deployments have been performed.

## Validation performed

46 tests passed (44 existing review/UI/security tests and 2 V3 checks). A fresh in-memory PGlite PostgreSQL instance, with no connections to existing DBs, accepted the intended column-only grants and rejected all six excess privilege fixtures (table-wide INSERT, created_at INSERT, grant option, anon INSERT, inherited created_at UPDATE, column REFERENCES). All review-release SQL files parsed with pglast; changed test file ESLint and git diff checks passed. No app/UI code changed in this follow-up; the previous TypeScript/build result remains applicable. This is not an executed Supabase installation or Production E2E.
