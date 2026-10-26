# Album-based history feed

Base origin/main a2fba1f (PR #174). Branch fix/history-album-grid.

Removed photo flattening from the feed only. One HistoryPhoto/album produces one
card, uses its first ordered slide photo as cover, and opens the unchanged album
lightbox at index zero. No cross-album concatenation. Original-ratio contain,
keyboard/swipe/wrapping/ESC/focus return remain in the existing dialog. Existing
three-column square CSS is unchanged. Pagination/counts now use posts; initial
page supports 12 posts (9 = 3x3, 12 = 3x4), then loads 12 at a time.

Admin registration/optimization/publication APIs, DB, Storage, Auth and RLS are
untouched. A managed album now has one edit button, not one per contained photo.
Non-admin controls remain hidden. Three categories/seasons/year filters unchanged.
No real MT album/photos read, deleted, re-uploaded or otherwise modified.

Validation: 52 focused component/API/server/optimizer/registration/i18n/admin tests
pass. Added actual component rendering checks for 3/10 photos -> one card, first
cover, 9/12 albums -> exact card counts and visitor/admin edit visibility.
Six Chrome mocked scenarios pass (ko/en x 390/768/1440): 9 cards 3x3, 12 cards 3x4,
square covers, first-photo cover, 3-photo/10-photo slides isolated, cyclic keyboard
navigation, contain in modal, no visitor controls, admin selected-album editor,
editor hidden after close, no horizontal overflow. No production requests/writes.
TypeScript, webpack build, changed-file lint pass. Full lint retains two unchanged
main SMS test errors and three warnings. Actual Production verification remains
operator-driven after approved deployment. No migration/flag change needed.

Review local commit, then approve push/PR/merge/deploy separately. Reverting this
presentation change needs no data rollback. Existing MT photos stay in place.
