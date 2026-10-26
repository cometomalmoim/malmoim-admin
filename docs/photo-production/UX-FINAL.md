# Photo UX final candidate

Branch feat/history-photo-ux-final, latest-main base 679076f (PR #169).
Only registration, gallery thumbnails and existing lightbox changed.
No SQL, Storage policy, Auth, categories, timeline, reviews or event code changed.

Registration: one 사진 등록 action validates metadata/files before creating a
private album; sequential uploads must all acknowledge success before existing
admin-only publish API is called. Server still independently checks ready rows
and updates approved/published using existing RLS. Any upload failure skips publish,
retains the private album for operator inspection and shows an error. There is no
automatic write retry. Publication response failures are explicitly unconfirmed,
since a lost response cannot establish whether the publish succeeded. Ref lock
blocks repeated submissions synchronously; disabled UI gives progress feedback.
Existing metadata editing, manual approval/recovery, unpublish, add-photo and
acknowledged Storage deletion remain available. Added photos to existing albums
retain the previous private-upload/explicit-approval workflow.

Gallery: 9 photo thumbnails per initial page, all viewport widths use three square
columns. Each thumbnail opens its exact index inside that album's existing
slidePhotos list; an album with 9 photos produces 9 tiles, not a single cover tile.
Original bytes untouched; only thumbnails use cover cropping. Detail uses contain,
wraps consistently at either end, and preserves keyboard/swipe/close behavior.
Scroll and focus return after closing. Only the existing approved-public API data
enters the gallery; private media route authorization remains unchanged.

Checks: 32 focused API/server/registration/i18n/admin tests pass. Registration
success ordering, partial failure, invalid/duplicate files, publication uncertainty,
non-admin/CSRF denial, categories/seasons, metadata edit and deletion regressions.
Chrome mocked API scenarios: 6 passed (ko/en x 390/768/1440): nine square tiles / three
columns, clicked third image opens 3/9, arrows/keyboard/swipe, first/last wrap,
original-ratio contain, ESC/focus return, no page horizontal overflow, duplicate
submit creates/uploads/publishes once, second upload failure never publishes.
All browser external requests blocked; synthetic image bytes only to mocked routes.
No real account, database change or actual Supabase upload performed.
TypeScript, webpack build, changed-file lint and diff whitespace checks pass.
Whole lint still fails on unchanged main tests/event-sms.test.mjs:6
@next/next/no-assign-module-variable with 3 existing warnings.

Before production: review automatic-publication behavior with the operator; only
select photos with public-use consent. Approve push/PR/merge/deploy separately.
No migration or activation flag change is needed for the currently enabled feature.
Live Production canary remains operator-driven after approval. Failed partial
albums may remain private for manual inspection/removal; never bulk-delete them.
Rollback application deployment to previous version restores explicit approval UX;
no DB rollback required. Emergency shutdown remains the existing feature flag.
