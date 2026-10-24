# Review database release review — no installation authorization

This directory is NOT an automatic Supabase CLI migrations directory. Nothing in
this PR executes schema changes. Existing event/participation/attendance tables,
RPCs and policies must not be recreated or replaced.

## Ordered manual release gates

1. Select and identify the intended team project independently. Run ONLY
   ../inspect/participation_catalog_readonly.sql and
   ../inspect/review_bridge_compatibility_readonly.sql. Review all current
   permissive/restrictive Storage policies, grants/default ACLs, owner/definer
   settings, admin self-read access and active-application view dependencies.
   No user/attendance data is exported by these catalogue checks.
2. Review ../drafts/history-review-auth-bridge-v2.sql. Its unconditional DRAFT_ONLY
   guard remains. It is the tested-body candidate, NOT an executable production
   migration. It includes existing-object collision checks, 20 base + 4 active
   application column checks, owner/search_path/default-ACL assertions, RLS/FORCE,
   narrow grants, restrictive INSERT and bucket-scoped Storage guards. Do not
   simply delete the guard and paste into production. After approval, prepare a
   target-pinned installer and exact policy postconditions in a separate change.
3. Resolve withdrawal/audit-retention FK RESTRICT policy and approval operator
   procedure before authorizing production install. Current owners can edit/delete
   existing reviews after revocation; new reviews are denied. Saved reviews are
   immediately public, with no separate review moderation state. Agree on that
   behavior explicitly; photo album approval/publication is a separate feature.
4. Review each added Storage predicate against existing policies. Ordinary
   permissive policies combine with OR; restrictive guards combine with AND.
   Review bucket guards restrict only history-review-photos and return true for
   unrelated buckets. Do not revoke global Storage ACLs, make buckets public or
   grant broad list/sign permissions. Custom roles/legacy policies need hosted
   staging negative API tests; empty-policy local success does not establish parity.
5. Only after explicit production approval, apply the separately prepared installer
   atomically. Run 02_verify_readonly.sql and exact effective ACL/predicate checks.
   Verify approved/unapproved/anonymous API paths in approved staging before
   enabling access to users. No account mapping is inferred from name/email.

## Administrator approval procedure

Existing admin_users membership is checked inside history_manage_participant.
An operator verifies a real Auth member's identity against the existing participant
outside the RPC, then supplies exact user/person/application/source IDs, current
approval revision and reason. Approval requires confirmed, non-test, attended,
non-archived evidence. User/person mapping is unique, immutable to ordinary
reapproval and audited atomically. Non-admins cannot self-approve by sending IDs.
Revoke uses the same RPC with current revision and reason; approval and review
INSERT serialize per user under READ COMMITTED. Existing attendance/archive RPCs
are unchanged; corrections racing an INSERT retain snapshot semantics.

## What must be prepared separately

Review: history_reviews, history_participant_links, history_participant_audit,
self eligibility/management RPCs, validator trigger, private 1MiB review bucket
and RLS. The bridge reads existing event_application_admin_list (016/024 chain).
No event schema SQL is shipped here for replay on production.

Administrator photo feature: history_photo_albums/items and private
history-simple-photos bucket/policies need a separate approved migration/compatibility
review. It remains hard-gated to the personal test project outside Vercel Production;
changing the URL is not an activation procedure. Existing main includes its code.

Absent review RPC/schema fails closed in the existing server/UI paths. Review list
read failures show the existing notice; static history/gallery content is retained.
No configuration enables either feature by virtue of merging this PR.

Local-only executable candidates, pinned container IDs, test account creators,
cleanup scripts, local credentials and E2E state are NOT included in this PR;
they are preserved on feat/website-final-verification. No migration on that branch
is implicitly a production authorization. Development-only 61521 opt-in is not a
production DB target/credential.

Remaining limitations: FK RESTRICT blocks linked Auth/person/approver deletion,
signed URLs remain bearer capabilities up to 3600 seconds, metadata/Storage
operations are not atomic and failed deletion can leave orphan files. Production
retention, cleanup and cache/URL-expiry procedures require approval.
