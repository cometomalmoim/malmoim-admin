# Production history review readiness

Target confirmed by user: `qkhlvdctdcpfyvohhikl`. No Production connection or SQL execution was performed in this audit. Latest main reviewed: `403ee41`.

## Confirmed code paths / unconfirmed live cause

- List: `review-store.ts` selects nine columns from `history_reviews`. Missing table/columns or denied SELECT produce the displayed list error. Attachment signing failure alone does not hide the review text.
- Eligibility: authenticated users call `history_can_create_review()` with no caller-supplied identity. RPC error or non-boolean result fails closed. `false` is ordinary unapproved status, not an infrastructure error.
- The retry label was displayed only for permission `error`; healthy connections already showed the normal create button. The button now always uses the normal create label and still revalidates on every click. Error notices remain; no permission bypass.
- New server logs expose only bounded stage/error codes: 42P01/PGRST205 missing relation; 42703/PGRST204 column/schema mismatch; 42883/PGRST202 missing/signature mismatch RPC; 42501 denied privileges; UNKNOWN needs further investigation. No records, credentials or raw database messages are logged.
- Previous reports that Production has no `history_reviews` support missing installation as the likely explanation. Current live absence is NOT established by the UI messages alone. Auth/config/network errors remain possible.

## Next inspection (user runs read-only SQL)

Select the confirmed Dashboard project and run `00_production_preflight_readonly.sql`. It checks 24 existing dependency columns, new object collisions, actual RPC definitions/ACLs, Auth/person foreign keys, RLS and all Storage policies without reading personal records. A database name cannot prove hosted project identity.

## Minimum installation path, pending inspection and explicit approval

Reuse `../drafts/history-review-auth-bridge-v2.sql`; do not execute it now or remove its DRAFT_ONLY guard. Its header refers to old project `qtjpudqurkocmlnaaxaz`, whose catalogue is not evidence for this Production project. Generate a target-reviewed installer only after the new catalogue confirms compatibility and any existing Auth/person mapping has been evaluated.

The existing tested design adds only three tables (`history_reviews`, `history_participant_links`, `history_participant_audit`), two callable RPCs (`history_can_create_review`, `history_manage_participant`), one trigger function (`validate_history_review`), review RLS and a private `history-review-photos` bucket with scoped policies. There is no new event/participation/attendance system. Existing `link_event_person` links an application to `event_people`, not to an Auth member. The bridge supplies only a verified Auth/person identity link; it reuses existing confirmed, non-test, non-archived attendance evidence. Never substitute recruitment-page review tables/RPCs.

Installation is blocked if these dependencies, owner permissions, existing restrictive Storage policies, ACLs, helper operations or names conflict. Do not change existing policies or grant global access to get past a failure. Keep photos and `event_landing_reviews` untouched. Execute the approved target installer as one transaction, then `02_verify_readonly.sql`; compare pre/post existing object definitions. Current draft is the minimum migration source, NOT an executable Production migration candidate.

Approval/revocation uses existing administrator identity, verified Auth/person identities, expected revision and audit reason. No client-selected person ID can grant access. Withdrawal FKs use RESTRICT; retention/deletion procedures need team agreement. Existing saved reviews stay visible after revocation; only new creation loses eligibility. Signed review-photo URLs last up to one hour after issuance, so immediate revocation of already issued URLs is not guaranteed.

## Actual Production test prerequisites

After approved installation and catalogue verification, use consented real member identities and existing legitimate attendance evidence. Do not create fake Production reviews or change participant records. Administrator verifies identity and approves the link; an approved participant voluntarily posts real content through /history and /en/history. Verify unapproved member and anonymous attempts cannot insert (including direct API), cannot self-approve or edit another author, and do not see the editor. Verify eligibility denial after approved revocation; coordinate it with the member. Concurrency, withdrawal FK, expired URL and destructive cases belong in the isolated local stack, not Production. Historical local E2E remains separate from these currently unexecuted Production checks.

## Local validation

Nine review readiness/SQL boundary/compact-card tests passed. Changed-file ESLint, TypeScript, SQL parser and production webpack build passed using non-routable build-only Supabase placeholders. No live Production E2E or database inspection was executed. Photo code, SQL designs and recruitment review code are unchanged.

## User-confirmed Production inventory / click-only UI (follow-up)

User confirms event_people, event_participation, event_sessions, event_session_attendance and admin_users exist; all four history review/bridge names and the review bucket are absent. This explains missing review storage. Exact RPC installation/ACLs and remaining 24-column compatibility must still be checked, including recruitment_events and event_application_admin_list. Existing participation approval is reused; only the missing Auth/person verified identity link is added, not another event approval system.

`01_production_install_candidate_DRAFT.sql` reuses the reviewed migration body unchanged, updates the intended target and retains an unconditional DRAFT_ONLY stop. It is a separate, non-executable candidate, not authorization to install. No original design, production DB or photo objects were modified. Finish the read-only preflight, review existing Storage restrictive policies and any current identity mapping, then prepare/approve the executable transaction. Run `02_verify_readonly.sql` after approved installation; administrator verifies a real member identity and legitimate attendance before linking. Start real voluntary review testing only then.

The default UI now shows only the normal create button (besides list/filter content). Every click rechecks server access: anonymous opens login, unapproved opens the participation notice, approved opens the editor, errors open a distinct error dialog. Initial permission errors are not shown as unsolicited participation notices. Server save checks and SQL/RLS enforcement are unchanged.
