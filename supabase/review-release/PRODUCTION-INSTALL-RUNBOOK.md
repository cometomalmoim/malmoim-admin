# Production review release candidate — manual approval required

Target: qkhlvdctdcpfyvohhikl. File: `01_production_install.sql`.

Evidence: supplied `/Users/yejinnn/Downloads/production-preflight.json` confirms 24 column/type matches, absent review tables/bucket/RPCs, required Storage ACLs, 21 existing Storage policies (8 restrictive photo guards that exempt the review bucket). This local attachment is the earlier version: installer/helper values are absent in it. The user separately confirmed postgres/BYPASSRLS/public CREATE/bucket INSERT/policy delegation and foldername/operation/allow_any_operation EXECUTE privileges in chat. This is not an independent new live DB query.

The executable candidate preserves V3's tables/functions/RLS/security DDL and all column ACL checks. It additionally locks storage.objects briefly and compares the complete existing 21-policy catalogue snapshot before creating anything. A change aborts instead of overwriting. It verifies new policy scope/roles/commands, exact bucket configuration and effective column ACLs before commit. Snapshot check requires the same policy deparser format; mismatches require reinspection, never bypass. Lock timeout 5s, statement timeout 30s; the lock can briefly block Storage writes during the transaction. Existing DRAFT and V3 BLOCKED files are unchanged. No automatic migration or installation has run.

## Install / validate (only after separate approval)

1. Confirm Dashboard project qkhlvdctdcpfyvohhikl; read the entire candidate. Do not use the old draft or rerun photo/event installers. Agree that reviews are public immediately, revoked authors retain edit/delete of existing reviews, signed URLs last up to 3600s and FK RESTRICT requires a deliberate withdrawal/retention process.
2. Run the entire `01_production_install.sql` transaction once as the existing postgres installer. Never run selected statements. On any error stop; ROLLBACK the failed transaction if the editor leaves it open. Do not weaken assertions or rerun partially.
3. Run `02_verify_readonly.sql` and `00_production_preflight_readonly.sql`. Confirm 3 review tables, 2 definer RPCs + invoker trigger, exact effective ACLs, 5 review policies, 9 review Storage policies, private 1MiB bucket, and all existing policies unchanged. Counts alone are insufficient. The candidate is code/ACL tested; hosted Storage API behavior is still pending.

## One consenting member approval without admin UI

There is no src admin UI invoking history_manage_participant. Use only a reviewed operator client authenticated with an existing admin account, as described in `PRODUCTION-FINAL-GATES.md`. Do not use SQL Editor with forged JWT settings, service_role, new admin rows or copied browser tokens. A normal consenting test member must already correspond to legitimate non-test, confirmed, attended, non-archived participation. If none exists, stop; do not manufacture attendance or relax eligibility.

Verify member identity outside the RPC and use their Auth UUID, existing person UUID, existing source/application UUID, initial revision 0, identity_confirmed=true, and a meaningful reason. RPC returns revision 1 on first approval; retain it securely for revoke. No approval is automatic on event approval. Existing participant/attendance data is read only. A controlled authenticated administrator client/session is still an operational prerequisite; this change does not invent a new approval UI.

## Real website checks / recovery

After approved installation and separately approved UX deployment, check anonymous login dialog, unapproved participant dialog, approved editor, and infrastructure error distinction on /history and /en/history. Only a consenting participant submits genuine review content; no fake Production reviews. Inspect owner edit/delete only with their consent. Do not attempt destructive or concurrency fixtures on Production; those remain local tests. Review attachments require a separate consented real file, not arbitrary uploads by this agent.

Before COMMIT: any failure rolls back all additions. After COMMIT: preserve tables, bucket, reviews, links and audit; no DROP, Storage deletion or event/photo rollback. Pause approval operations. If an individual approval is incorrect, an authorized existing admin uses audited revoke with current revision through the same RPC; never edit attendance. Roll back only the separately deployed review UI code through the normal approved release process if needed. Existing issued signed URLs can remain valid for one hour. A complete feature shutdown/access revocation would require a separately reviewed change; neither UI rollback nor stopping approvals revokes all existing access. Do not claim post-commit SQL reversal is automatic.

No Production SQL, accounts, records, uploads, push, PR, merge or deployment was performed while preparing this release.
