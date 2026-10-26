# Compact history feed and participant review cards

Branch style/history-compact-feed-reviews, base origin/main a2fba1f. Reuses local
album-grid change 3138b2c because it is not yet in fetched main; no wholesale branch
merge. Production database, original/backup worktrees and team event code untouched.

Photo feed: one card per album, first ordered photo cover, 3 square columns and
maximum grid width 780px centered. 9 posts -> 3x3; 12 -> 3x4. Album detail uses the
existing isolated slide list; contain/keyboard/swipe remain. Admin edit controls
are once per album; existing optimization/register/edit/delete/Auth unchanged.

Participant review display only: card padding 16px (14px mobile), no fixed-height
empty title/body rows, 3-line preview and visible Read more text inside the existing
card button. Full original text remains in the existing detail dialog. Supported
cover attachments are 64px square thumbnails; clicking opens the existing full
review including all already supported images. Author/category/date retained;
review schema has no separate season field, so no fabricated season metadata added.
PC 3 columns, tablet 2, mobile 1. No review actions, eligibility, approval, query,
server action, recruitment/landing review module, or actual data change.

Validation: 54 focused tests pass, including actual card/detail renders in ko/en,
full text/author/date preservation, existing attachment cover vs full detail images,
visitor action absence, album counts and photo/Auth/optimization regressions.
Chrome photo mocked checks 6 pass (ko/en x 390/768/1440): 1 album/1 tile, 9/12 row
counts, max width, square covers, album slide isolation, admin controls/editor.
Existing development-only review preview (unchanged pre-existing fixtures): 3 browser
checks pass (390/768/1440), computed 3-line clamp, expanded full text via Read more,
64px thumbnail to full photo, close/ESC and 1/2/3 columns. For this preview-only test,
the actual brand stylesheet was injected by the test because the existing preview
route imports only base CSS; Production history imports the same brand stylesheet
normally. No new preview route or fixture was added. English review translations
verified with actual localized component rendering; no live Production reviews read.
No browser external requests or DB writes. No original photos copied/deleted.

TypeScript and production webpack build pass. Changed-file lint passes. Full lint
retains two existing main SMS test errors and three warnings. Review current local
diff before approving push/PR/merge/deployment separately. No SQL, credentials,
feature flag or production data operation is needed. Rollback is application-only.
