# GitHub integration candidate — review DB installation deferred

Checkout: /private/tmp/malmoim-website-yejin-github-ready
Branch: feat/website-yejin-ready
Baseline: GitHub main d4b32f9, fetched 2026-10-24; no newer main commits at this check.

Extracted from verified 1ca58a3 plus the eleven runtime/test files selected from integrate/website-yejin-simple. No merge of 2ec0063 or the original personal branch: legacy broker/OIDC/JWT issuer, experimental auth/lab routes and local validation scripts are excluded. Deferred review installer candidates and SQL experiments stay in the older isolated checkout, not this candidate. Existing documentation describing previous checkouts is historical; this file defines the new candidate's scope.

## Ready for code review, not production feature activation

Shared Korean/English about/history design, hero/polaroid images, Season labels, language preference and allowlisted localized history login return are preserved. Existing review listing/attachment signing and text-on-Storage-error behavior are preserved independently of the approval lookup. New review requests recheck actual getUser/approval and fail closed on absent/failed RPC; owner editing/deleting existing reviews remains subject to existing server/RLS checks. The missing installation error currently uses friendly permission retry guidance, never raw DB errors. This is application fail-closed behavior, NOT proof that an existing production DB prevents direct writes.

Personal preflight confirmed five missing dependencies: event_people, event_participation, event_sessions, event_session_attendance, recruitment_events. Review installation is DEFERRED. No new event/attendance schemas, SQL execution or automatic migrations. No claim of personal Hosted review authorization E2E. Actual production review schema and direct API RLS enforcement remain unverified; do not activate new review authoring there until separately approved.

Photo admin/public dynamic gallery remains disabled by default and always rejected on Vercel Production, even with its test flag set. Only the exact personal URL is eligible for explicitly authorized local tests. No env file, key, DB password or session is included. Do not widen gates for production. Design/static content can be reviewed independently; deployment still requires separate authorization.

## Validation

- Candidate: 523 tests, 520 pass, 3 existing baseline failures (intake/sms missing PGlite; report workspace App Router invariant).
- Original isolated integration: 83 selected review/photo/i18n tests pass; fresh webpack build, TypeScript and lint pass (0 errors, 3 existing warnings).
- Candidate webpack build and TypeScript pass, lint 0 errors/3 existing warnings.
- Real browser without backend credentials: /about, /history, /en/about, /en/history 200; Season labels, language roundtrip/reload, both permission-error/retry dialogs and no editor on failure. Photo read API 503 while disabled.
- Mock tests prove missing/failed RPC prevents new-review persistence and preserve existing published review text/photos; no live review records read or changed during this final readiness check.
- Changed-path/secret-pattern audit: no tracked env, private keys, real JWT/secret keys, legacy broker paths or fixture image uploads. Test fixtures are mock-only in test code; test browser state is not exported.
- Original 51 changed files match their backup hashes and original status; permanent backup files unchanged. No push/PR/main merge/DB/Storage/deployment action.

## GitHub Desktop next step

File > Add Local Repository > choose this candidate checkout. Inspect Changes/History and the branch name; origin is cometomalmoim/malmoim-admin. Do not click Publish branch or Push origin yet. Do not merge into the original dirty feat/website-yejin. Keep its changes and backup intact. A later approved PR should use this clean branch directly against main, rather than bringing legacy commits back through the dirty branch. Re-fetch/review main immediately before an authorized push; this check is point-in-time.
