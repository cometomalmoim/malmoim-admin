# Inline history photo management — prepared, not activated

Checkout: `/private/tmp/malmoim-history-inline-photos`.
Branch: `feat/history-inline-photo-manager`. Base: origin/main `d2766b4`.
Reuses production connection candidate c57fab8. No static-photo changes imported.

## Behavior and schema

Both `/history` and `/en/history` show the add-photo control only after the
existing admin API verifies getUser/admin_users, activation and a successful album
read. A native modal reuses the existing upload/edit/approve/unpublish/delete UI.
Escape/close and native modal focus containment are supported. On successful
mutation the public gallery reloads without navigating or deploying again.
Anonymous/member/disabled responses hide controls; UI hiding never grants access.
Every API request retains independent server authorization and database RLS.

Contracts match the operator-installed SQL: history_photo_albums
(id/title/date/description/published/deleting/created_at), history_photo_items
(id/album_id/object_path/position/ready/approved), private history-simple-photos,
4 MiB per image, position 0–9, path album UUID/photo UUID.webp. Upload normalizes
JPG/PNG/WebP to WebP. Client also checks remaining album capacity. Uploaded albums
remain Special Activities; this schema has no season/category field. Select that
tab to view published albums. English shares the same photos; administrator-entered
titles/descriptions are displayed as entered rather than automatically translated.
Private reads use same-origin media endpoints, fresh RLS reads, and no-store;
publication is checked again after download. No public bucket or signed URL.

## Validation (2026-10-26)

- Photo API/server/config/admin regression tests: 23 passed (mock database ports;
  real image decoder). Includes non-admin denial, CSRF, invalid input, publication
  recheck, unacknowledged deletion safety, activation target/flags.
- Local Chrome: 9 mocked-response browser checks passed: ko/en at 390/768/1440,
  open/form/close/no horizontal overflow; 401/403/503 never show add-photo controls.
  External browser requests blocked. No real upload/account/session used.
- TypeScript and production webpack build pass. Changed-file lint passes.
- Whole lint: existing main tests/event-sms.test.mjs:6 error
  @next/next/no-assign-module-variable; 3 existing warnings. File unchanged.
- Production installation/counts supplied by operator; effective Production
  admin/member/anonymous Auth + Storage E2E NOT repeated. No DB SQL executed.

## Approval and rollout

No push, PR, merge, deployment, actual uploads or activation performed.
Approve code push/PR and deployment separately. For approved Production activation,
retain the matching existing publishable key and exact Supabase URL
https://qkhlvdctdcpfyvohhikl.supabase.co. Set server-only flags
HISTORY_PHOTO_PRODUCTION_ENABLED=true and HISTORY_PHOTO_PRODUCTION_REVIEWED=true;
NODE_ENV and VERCEL_ENV must be production, SUPABASE_LOCAL_TEST absent/false.
Deploy that approved configuration. No DB reinstall is required.

Sign in as an existing admin, open /history, choose + 사진 등록, fill activity
name/date/description and at most 10 consented files, then 비공개로 등록.
Check thumbnails, choose 완료 사진 공개 승인. Check Special Activities on both
public locale pages in a signed-out browser. Verify private albums cannot be read,
ordinary members cannot mutate, and existing board/people/resource Storage still
works before routine use. Then verify unpublish and delete only an explicitly
chosen disposable canary; never delete existing desired content as a test.

Emergency rollback: set HISTORY_PHOTO_PRODUCTION_ENABLED=false and redeploy.
This disables reads and mutations through the feature; preserve DB/bucket/policies.
Unpublish a specific album first if possible. Already downloaded bytes cannot be
recalled. A failed deletion acknowledgement preserves hidden metadata for retry.
Do not weaken RLS to resolve 403/NoSuchKey. Database presence alone is not proof of
effective Storage authorization, and the baseline lint failure remains a PR caveat.
