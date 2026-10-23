# Simple photo integration review

Integration checkout: `/private/tmp/malmoim-photo-simple-integration`.
Branch: `feat/operations-juho`. Baseline: origin/main `d4b32f9`.
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
No env file or credential is included in this checkout. Basic existing Auth uses
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
The main-based integration has static/regression/build validation; its live write
E2E has not been repeated, so this is not production activation approval.

## Validation

Full main baseline: 460 tests, 457 pass, 3 fail.
Final integration: 471 tests, 468 pass, identical 3 failures:
- tests/intake-db.test.mjs: missing @electric-sql/pglite
- tests/sms-db.test.mjs: missing @electric-sql/pglite
- report workspace test: invariant expected app router to be mounted
The latter is also reproducible on unmodified current main, not a new photo regression.
TypeScript must be checked after Next generates its route/image typings.
Build passed using `npm run build -- --webpack`; lint: 0 errors, 3 existing warnings.
No framework/security dependency upgrades are bundled with this feature.

Final targeted simple-feature + main-admin integration tests: 11/11 pass.
TypeScript passed after the production build generated Next route typings.
Local production smoke at 127.0.0.1:3024: both photo read endpoints return 503
with the feature flag deliberately true and VERCEL_ENV=production; /about and
/history return 200 with no horizontal overflow at 390px. No DB credentials were
configured or production databases contacted during these checks.
Original `/about` files, existing history review/hero content, and all static image
files have no integration diff. Latest origin/main was re-fetched and remains d4b32f9.

Next review: inspect this isolated branch's diff before any push/PR. Production
schema inventory and a main-based personal write E2E are still separate gates.
