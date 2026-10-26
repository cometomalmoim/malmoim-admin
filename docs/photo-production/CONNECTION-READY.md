# Production photo connection candidate — not activated

Checkout /private/tmp/malmoim-photo-production-connect
Branch feat/photo-production-connect; base origin/main b9a6c541537c2240a4bd5716dd20e75439390f3b
(includes PR #161). Existing verification/audit/original checkouts remain untouched.

Operator reports successful installation on qkhlvdctdcpfyvohhikl: 2 photo tables,
1 history-simple-photos bucket, 16 policies. No SQL was executed or reinstalled in
this task. Names/columns/path/4MiB WebP limit were compared with the installed SQL
source, not a newly fetched live catalogue. Existing getUser + admin_users checks,
shared Auth, team event/participation/session code and existing RLS unchanged.

## Prepared code

- policy.ts: production-only exact team project; default OFF. Personal project URL
  and test-mode activation path removed from this photo runtime.
- api.ts: strict same Origin; removes fixed local-port exception. No developer
  Origin workaround executes in Production or remains in this photo handler.
- simple-history-photo-ui.tsx: generic inactive message rather than personal-test copy.
- server.ts: individual deletion requires exact Storage key acknowledgement before
  deleting metadata, matching the existing safer album-delete behavior. Failed
  acknowledgement leaves metadata hidden for investigation/retry.
- Focused gate/origin/deletion and administrator-mount regression tests.

No keys, real env files, account/session/fixture data, SQL migration, broker/OIDC,
review feature change, or dependency version/lockfile change in this branch.
Existing generic shared config development support is inherited from main and
unmodified; photo gate explicitly rejects it. Old personal E2E runner in main is
not a deployment/activation procedure; personal testing remains on preserved prior
verification branches, not this production-only runtime.

## Verification

Photo/config/admin integration tests: 23/23 pass. TypeScript noEmit and webpack
production build pass. Changed-file lint passes. Whole-repository lint fails on
UNCHANGED main tests/event-sms.test.mjs:6 (@next/next/no-assign-module-variable),
plus 3 existing warnings. git diff confirms that file is identical to main. This
baseline lint failure must be resolved by its owner or explicitly acknowledged
before accepting the PR; no unrelated SMS change bundled.

The initial shared dependency folder lacked ws required by latest main. Installed
lockfile dependencies in this checkout only with npm ci; package.json/lock unchanged.
Build used disabled activation and non-production build-only placeholder config;
no real credentials supplied. No live production mutation/API E2E was performed.
Original branch main was re-fetched and remains b9a6c54 before completion.

## Approval / PR / deploy sequence (NOT performed)

1. Review this photo-only diff, baseline lint issue and operator's full policy/ACL
   verification (16 objects existing alone does not prove effective RLS).
2. Explicit approval for push and PR creation; PR target main. No review/attendance
   migration included. Merge/deployment require separate authorization.
3. Keep activation flags absent/false for initial code deployment. Existing
   NEXT_PUBLIC_SUPABASE_URL must be exact https://qkhlvdctdcpfyvohhikl.supabase.co;
   retain its existing matching publishable key. Do not use local or personal keys.
4. Only on explicit activation approval set server-only Production flags
   HISTORY_PHOTO_PRODUCTION_ENABLED=true AND HISTORY_PHOTO_PRODUCTION_REVIEWED=true
   and redeploy approved version. NODE_ENV=production / VERCEL_ENV=production must
   hold automatically; SUPABASE_LOCAL_TEST must be absent/false. Flags are not set
   in this checkout or Vercel. Setting them without deploying this code does nothing.
5. Sign in as existing administrator at /admin/history. Use one consented photo in
   a new private diagnostic album, verify image bytes, then '완료 사진 공개 승인'.
   Fresh unauthenticated /history and /en/history must render it; member writes
   denied. Unpublish and verify fresh media denial; delete ONLY diagnostic fixture
   and confirm per-key acknowledgement. Keep normal desired content afterward.

Rollback: unpublish diagnostic content; disable enabled flag and redeploy approved
configuration if needed. Do NOT delete bucket/table/legacy policies or broaden
RLS to resolve a 403/NoSuchKey. Existing board-images/people-photos/admin-resources
smoke tests remain necessary with the installed restrictive policies. No new
production checks were falsely claimed.

## Known limits / blockers

Whole-repo lint baseline above; deployment and activation still pending approval.
Without both flags and correct environment/URL endpoints return disabled/503 by
design. Production effective RLS/Storage operation behavior still needs canary.
No immediate erasure of already downloaded bytes is possible. Dynamic album title
and description remain administrator-entered original text in either locale.
No category/cohort/filter feature or review permission rollout is included.
