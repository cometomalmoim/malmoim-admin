# Registration UI correction

Base origin/main 0d3fc47, PR #171. Branch fix/history-photo-registration-ui.
No SQL/DB/RLS/Storage schema/Auth changes or production mutations.

## Confirmed code findings

The inline modal rendered the full manager (create form + every album's expanded
edit form, add-photo and approval controls). It had no registration-success close
callback. run() also awaited the admin list refresh AFTER successful publication;
a failed refresh was shown as registration failure even though publication had
succeeded. command()/upload() discarded safe API reasons, registerPhotos() discarded
the original upload cause, and the API collapsed known server errors to one code.

These defects were reproduced/corrected locally. They do NOT establish the actual
cause of any particular Production upload failure: no authenticated Production
request/response or server log was accessed. The actual live failure remains
unverified until the operator reproduces it or provides the safe displayed code.

## Changes

Public history initially renders gallery plus authorized add/edit buttons only.
Create opens a creation-only modal; existing albums never appear in the new-photo
flow. Every upload must finish before the unchanged admin publish operation.
Publication acknowledgement invokes gallery invalidation and modal close without
waiting for another admin GET. Edit opens only the selected album; forms also
collapse by default in the existing /admin/history full manager. Save closes edit.
Nonpublic/failed albums remain recoverable in /admin/history; no records auto-deleted.
Metadata editing/deletion, three categories/new season, grid and slides preserved.

Errors retain only whitelisted semantic codes and HTTP status, with Korean/English
messages for login/origin/size/image/schema/RLS/Storage/readiness failures. Unknown
raw exception text, object paths, keys, JWTs and database messages never reach UI.
A partial upload retains its safe original cause and is never published. Network
failures are labelled unconfirmed; writes are never automatically retried.

## Checks

37 focused API/server/registration/error/i18n/admin tests pass. New cases cover
safe failures, redaction, schema/RLS classification and original upload cause.
Local Chrome: 8 mocked scenarios pass: ko/en x 390/768/1440 for initial clean UI,
edit-save-close, create-only form, failed upload with original HTTP 403, duplicate
submit lock, successful publish-close and gallery refresh even when subsequent
admin GET fails; 401/403 have no add/edit controls. No external requests or real
uploads. TypeScript, production webpack build and changed-file lint pass.
Whole lint retains two existing main errors: tests/event-sms.test.mjs:6 and
 tests/sms-result-ui.test.mjs:11 (@next/next/no-assign-module-variable), plus 3 warnings.

Push/PR/merge/deploy require approval. No migration/flag change needed. After approved
deployment, an operator should verify one consented photo on Production; live E2E
has not been claimed. Roll back application version or disable existing feature
flag on trouble; preserve all albums, files and policies.
