# Photo categories — local candidate, not installed or deployed

Branch feat/history-photo-categories, based on origin/main 9ab7275.

Five categories: regular, special, event, study, other. For regular activities only,
cohort is a required positive integer (1–32767). Others require NULL. Existing
albums retain special / NULL. No image, object path, approval/publication flags,
Storage ACL/policy or existing event/Auth/admin object changes.

Shared HISTORY_COHORTS contains the former 9–1 filter choices. Both gallery and
manager reuse it. Administrators can choose a new numeric season; public filters
include all seasons present in loaded photos. Existing regular timeline remains
unchanged. Both locales use the same category IDs with English gallery labels.

## Required rollout order — approval required

1. Review supabase/photo-production/03_album_categories.sql against the current
   Production catalogue. The latest live schema was NOT accessed in this task;
   baseline is the user-confirmed installation and checked-in installer contract.
2. In the confirmed qkhlvdctdcpfyvohhikl Dashboard, execute only that new migration
   after approval. It adds category text NOT NULL DEFAULT special and cohort
   smallint plus category/cohort consistency checks, inside one transaction.
   It aborts on column collisions, missing photo tables/private bucket/album RLS.
   Do not rerun the original photo installer. Existing albums/images preserved.
3. Execute 04_verify_categories_readonly.sql: two columns and two constraints
   expected. No row data returned. If migration fails, transaction rolls back;
   inspect the error without dropping existing objects or rerunning blindly.
4. Approve code push/PR/merge/deploy separately. Deploy only AFTER schema update.
   Missing columns cause album queries to fail closed (no fabricated success).
   Existing deployed code remains compatible with the additive migration.
5. In /history choose + 사진 등록 → 활동 유형 → regular activities require 기수
   (choose existing season or 새 기수 직접 입력). Enter activity details/photos,
   save privately, inspect, then approve publication. Existing album forms also
   allow changing category/season using 정보 저장. Both locales show the selected
   category. Regular activities use Season N filters. Max 10 photos stays intact.
6. Operator must verify real admin/member/anonymous authorization and one consented
   canary before routine production use. This task performs no actual DB upload.

Rollback: redeploy previous application version; leave additive columns and data
in place. For emergency feature shutdown, set HISTORY_PHOTO_PRODUCTION_ENABLED
false and redeploy. Do not drop category columns, images, tables or Storage policies.
Previous UI displays all albums as special until the new version is restored.

## Verification

27 API/server/translation/gate/admin tests passed with mocked DB ports, including
all five classifications, regular season 10/11, invalid input and non-admin denial,
category edits preserving publication, real image decoder, publication recheck and
Storage deletion acknowledgement safeguards. Both SQL files parse with pglast.
TypeScript and webpack build pass; changed-file ESLint passes. Whole lint has the
unchanged main SMS test error tests/event-sms.test.mjs:6 and 3 existing warnings.
Actual migration constraints and live Production E2E remain unexecuted by design.

Final local Chrome checks: 6 mocked scenarios passed (ko/en × 390/768/1440).
Checked category selector, regular-only season input/new season, edit request with
nonregular NULL cohort, all five localized gallery tabs and no horizontal overflow.
External requests blocked; actual database writes 0. Initial browser run found
ambiguous implicit select labels; explicit accessible labels added and rerun passed.
