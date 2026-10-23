# Simple photo integration review

Integration checkout: `/private/tmp/malmoim-photo-simple-integration`.
Branch: `feat/history-photo-simple-yejin`. Baseline: origin/main `d4b32f9`.
No push, PR, production deployment, or database execution is authorized by this change.

## Scope and preservation

Only `src/lib/history-simple`, simple admin UI, three photo API routes,
public gallery adapter, the personal E2E script, and the sharp dependency are
extracted. The original dirty checkout and old isolated implementation are untouched.
The original personal branch `feat/website-yejin` is at `2f64ee4`;
the old integration branch is at `868c287`. Neither branch is merged wholesale:
they include obsolete broker work and omit newer main changes.
No broker, OIDC, JWT issuer, restricted DB account, production secrets or diagnostic
trace helper is imported. No shared login, Auth, Proxy, or Supabase client is changed.
No `/about` file, history hero/review content, CSS, or static image is changed.
`/history` only adds the published gallery wrapper and uncached private media support.

## Runtime and database boundary

Default is disabled. `HISTORY_PHOTO_SIMPLE_TEST_ENABLED=true` is accepted ONLY for
`https://zjwazisdfjhaysvyifxd.supabase.co`, and never Vercel Production.
No env file or credential is tracked in Git. An ignored, mode-0600 `.env.local` contains only the personal Project URL, publishable key and disabled feature flag for local E2E. Basic existing Auth uses
NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.
No service-role key, DB password, broker or signing secret is needed.
Absent/disabled/mismatched configuration fails closed, and the original static gallery remains.
The feature must NOT be enabled for the team project merely by changing its URL.
A separate, approved production schema review/migration and activation change is required.

| Component | Personal test (reported and E2E verified) | Team production |
|---|---|---|
| admin_users | Existing self-read policy and user_id SELECT | Used by main Auth; actual live ACL not inspected |
| history_photo_albums/items | Both installed with RLS and 4 policies | Not present in main's migrations; live existence unverified |
| history-simple-photos | Private, 4 MiB, WebP | Live bucket unverified |
| Storage SELECT | Specific get_authenticated and get_authenticated_info; admin condition / approved published condition | Live policies unverified; do not replace blindly |
| Trace function | Removed; user verified cleanup | Not required or shipped |

`production-schema-readonly.sql` is an OPTIONAL non-mutating inventory for future
explicitly selected production review. It has NOT been executed. Catalogue checks
alone cannot establish effective RLS safety; ordinary-member and anonymous API
negative checks remain required before production authorization.

## E2E evidence

On the original isolated simple implementation, the personal test passed:
admin login, upload/path and fullPath checks, normalized WebP download, approval,
publication, anonymous `/history` real-image rendering, unpublish (404), deletion.
The user confirmed album, item, storage object absence and trace removal (4 true).
The main-based integration has now also passed the personal Hosted write E2E described below. This is not production activation approval.

## Validation

Full main baseline: 460 tests, 457 pass, 3 fail.
Final integration: 472 tests, 469 pass, identical 3 failures:
- tests/intake-db.test.mjs: missing @electric-sql/pglite
- tests/sms-db.test.mjs: missing @electric-sql/pglite
- report workspace test: invariant expected app router to be mounted
The latter is also reproducible on unmodified current main, not a new photo regression.
TypeScript must be checked after Next generates its route/image typings.
Build passed using `npm run build -- --webpack`; lint: 0 errors, 3 existing warnings.
No framework/security dependency upgrades are bundled with this feature.

Final targeted simple-feature + main-admin integration tests: 12/12 pass.
TypeScript passed after the production build generated Next route typings.
Local production smoke at 127.0.0.1:3024: both photo read endpoints return 503
with the feature flag deliberately true and VERCEL_ENV=production; /about and
/history return 200 with no horizontal overflow at 390px. No DB credentials were
configured or production databases contacted during these checks.
Original `/about` files, existing history review/hero content, and all static image
files have no integration diff. Latest origin/main was re-fetched and remains d4b32f9.

Next review: inspect this isolated branch's diff before any push/PR. Production
schema inventory, ordinary-member API negative checks and production activation remain separate gates.

## Personal-branch Hosted E2E completed (2026-10-24 KST)

Created `feat/history-photo-simple-yejin` from b7282d2, without moving/deleting the
existing local `feat/operations-juho` ref or changing any remote branch. The remote
operations branch already has previous PR history under a shared Malmoim author;
individual ownership cannot be established from that author identity alone.
The original repository and earlier isolated copy remain untouched.

Only the personal project zjwazisdfjhaysvyifxd was connected. The existing
operator-authenticated isolated Chrome session was reused; each admin request
verified getUser and admin_users. No password, JWT or cookie was exported.
No SQL, schema/policy reinstallation, or production DB request was performed.

Final actual E2E result: PASSED, seven checks:
1. Server getUser and administrator allowlist.
2. Existing /about responds normally.
3. A generated PNG uploaded through /admin/history, normalized to WebP, with
   upload path/fullPath checks, ready metadata and administrator image download.
4. Anonymous private image/list access denied and administrator mutation returns 401.
5. Explicit approval/publication; anonymous /history renders actual image bytes and slide dialog.
6. Unpublish removes the album from the anonymous list and returns image 404.
7. Delete succeeds; every expected key appears in the Storage remove acknowledgement
   before album metadata is deleted; subsequent administrator image request is 404.

A final administrator catalogue read found **0 remaining test albums**.
Storage's successful per-key deletion acknowledgement was checked; no independent
SQL catalogue/backend inspection was performed in this second E2E. The earlier
retained-fixture cleanup was independently confirmed by the user via SQL.

During test development, native confirm handling over existing CDP sessions caused
an automation failure. Partial fixtures were cleaned. The runner now uses a fresh
tab and explicitly approves only the expected test deletion confirmation text.
The final full run passed. This changes only test automation, not application Auth/RLS.
A regression test now rejects successful-but-empty Storage deletion responses so
metadata cannot conceal an unacknowledged object deletion.

The local write-test server was stopped afterward. `.env.local` remains disabled;
Vercel Production remains blocked by the hard gate. No push, PR or merge was performed.
