# PR draft — white public pages and verified review authorization preparation

Target: cometomalmoim/malmoim-admin main. LOCAL CANDIDATE ONLY: not pushed, no PR
created, no merge, deployment or DB execution authorized/performed by preparation.

## Problem and resulting behavior

About/history currently use large off-white surfaces and English server-rendered
body text can remain Korean in development. This change makes Korean/English
about/history surfaces white and translates the same shared element tree before
RSC serialization. Text/photos, layout order, polaroids and interactions stay.

Prepare the review authorization SQL that links an existing Auth user to the team's
existing participant/attendance evidence through administrator approval. Raw
identity writes, unapproved direct review INSERT and forged authors are denied;
archived applications are excluded. RPC owner/search_path, restrictive RLS, narrow
column ACLs and revoke/insert ordering were exercised in an isolated local lab.
No operational event/participant/session SQL is recreated or changed.

PR #142 is already on main (ac72aba). Login return, base bilingual/Season content,
Supabase Auth administrator photo upload/approve/publish/unpublish/delete and public
gallery are inherited from main, NOT duplicated in this diff. Additional regression
checks cover their preservation. No broker/OIDC/JWT issuer implementation added.

## Changes in this diff

- White scoped about/history CSS for both languages, preserving brand accents.
- Shared server/client translation traversal fixes English development rendering.
- Non-production photo origin/Host regression checks for verified local test port.
- Exact 61521 opt-in in NODE_ENV=development + SUPABASE_LOCAL_TEST=true only;
  production/test modes and normal HTTPS/key validation remain unchanged.
- Guarded review bridge draft, read-only catalogue/post-install checks and release
  procedure. Three review/identity/audit tables, self eligibility/admin approval
  RPCs, invoker validation trigger, one private review bucket and scoped RLS.
- Security regression tests. No credentials, users, fixture photographs, env files,
  signed URLs, cookies, session exports or pinned local executables included.

## Validation

On the clean latest-main-based PR candidate:
- Relevant tests: 84/84 passed.
- TypeScript noEmit passed after generated route types.
- ESLint: 0 errors, 3 existing warnings.
- npm run build -- --webpack passed; build env pinned to disabled local configuration,
  no hosted fallback or production feature activation.
- SQL/function bodies checked with offline PostgreSQL parser; draft still aborts.
- Existing operational SQL/assets/auth/login/review action files unchanged from main.

Earlier actual isolated evidence (preserved on feat/website-final-verification):
- Auth/API/Storage/revoke concurrency/FK checks and cleanup passed (34 checks).
- Korean/English actual login return, approved UI save, unapproved notice and
  anonymous dialog (10); four pages × three sizes (12); language-switch/refresh (1).
- Fixtures removed and counts restored (Auth/reviews/links/attendance/objects 0;
  original closed event retained). Credentials/session manifest removed.
- Personal-project administrator photo E2E previously passed independently.
These are source-branch actual E2E records; live writes were NOT repeated in this
PR-preparation checkout. No claim of production/hosted policy compatibility.

The full unrelated suite was not rerun here. Prior baseline had two missing-PGlite
failures and one App Router workspace invariant; those are neither claimed fixed
nor counted as new failures in the passing targeted suite.

## Database and activation — REQUIRED before production use

No migration is auto-run. See supabase/review-release/README.md for order:
1. Explicitly select/identify team project; read existing catalogue, defaults,
   columns, RPCs, admin self-read, Storage policies/ACLs and name collisions.
2. Review guarded draft; resolve participant/Auth identity verification, withdrawal
   and audit-retention FK RESTRICT procedure. Existing attendance systems unchanged.
3. Review new bucket-scoped restrictive/permissive policies against ALL existing
   Storage policies/custom roles; local empty-policy tests are insufficient.
4. Obtain separate approval; create a target-pinned executable production installer
   and exact policy postconditions. The DRAFT_ONLY file is NOT that installer.
5. Apply only after approval and run catalogue + approved/unapproved/anonymous
   API checks in approved staging. Enable operational access only after gates pass.

Admin approval: existing admin_users user verifies the member identity externally,
then calls history_manage_participant with exact Auth/person/application evidence,
expected revision and reason. Ordinary users cannot choose a person to gain access.
Revoke is audited with CAS and shared user lock; attendance correction itself uses
existing statement-snapshot semantics. Old own-review edits/deletes after revoke
remain intentionally allowed; saved review content is immediately public.

Review feature remains fail-closed for new writes if schema/RPC is absent or lookup
fails; UI gives the existing notice. Existing static content/gallery is retained.
Admin photo feature remains disabled by default, restricted to the personal test
URL and blocked in Vercel Production. Team photo schema/bucket/RLS rollout and
activation need a SEPARATE approved change; changing the URL alone is forbidden.

Remaining release risks: linked user/approver withdrawal blocked by RESTRICT FKs,
signed URLs up to 3600s cannot be immediately revoked, Storage/table operations
are non-atomic and cleanup can leave orphans, attendance-correction races and
long-lived caches require separate operational decisions/testing.

## Excluded / preserved

Original dirty feat/website-yejin checkout, ready branch, permanent backups,
feat/operations-juho and previous verification branch untouched. Local executable
SQL/account creators/cleanup/concurrency tooling and historical failed-attempt logs
stay on the verification branch, not in this PR. No hosted environment accessed.
