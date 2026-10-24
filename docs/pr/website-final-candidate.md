# Final local PR candidate

Checkout: /private/tmp/malmoim-final-pr-yejin
Branch: feat/website-final-pr-yejin
Base: origin/main ac72aba62bef83e71638f2d551c6a17c006f2334 (PR #142 included).
Source: feat/website-final-verification 4056d07, preserved untouched.

Created clean worktree directly from latest fetched main, selectively copied only
runtime deltas, focused tests and guarded release material. No wholesale merge or
history replay, no conflict, no duplicate #142 code. Upstream deliberately unset
so GitHub Desktop should Publish this branch, not push to origin/main.

PR description prepared in website-final-description.md. Do not publish until user
authorizes push/PR. In GitHub Desktop: File → Add local repository → choose this
checkout; confirm branch feat/website-final-pr-yejin and clean Changes. Review
History/diff against main first. Keep the original dirty repository open separately;
do not switch/stash/overwrite its work. Publishing is a later authorized action.

PR inclusion matrix:
- Existing main: login return, base bilingual/Season, photo admin/gallery, review UI
  permission checking and missing-schema fail-closed behavior.
- New: white CSS, English dev RSC fix, dev-only local configuration and regression,
  reviewed approval/attendance SQL and deployment conditions (guarded, not executed).
- Excluded: local executables, account/fixture state, credentials/env, old brokers,
  OIDC, issuer, team event SQL changes and obsolete investigative histories.

SQL draft/inspect/review-release directories are review-only and outside any
CLI migrations directory; nothing auto-applies. New PR is code preparation, not
production schema/feature activation approval. Photos stay production-disabled.

No live DB was contacted while assembling this checkout. Earlier actual E2E results
are source-branch evidence; targeted tests/build/typecheck were repeated here.

Final verification: 19 changed files versus main; targeted tests 84/84, TypeScript
noEmit and webpack production build passed; lint 0 errors/3 baseline warnings.
Staged credential/scope scan passed: no real publishable/secret key, JWT, DB
credential URL, private key, env/session file, local executable or team numbered
SQL mutation. Offline SQL/function parser passed. Re-fetched main before commit
and it remains ac72aba. Worktree will be committed locally; no remote write.
