# Photo decode investigation — no production writes

Base origin/main ced0b34 (PR #172), branch fix/history-image-decoding.

## Actual reported file, inspected read-only

User supplied a local JPEG path (not copied into Git or this document). Original
2,934,459 bytes, JPEG magic and actual metadata jpeg, 4031x3024, one page, 72 DPI.
It is below both 4 MiB and 24,000,000 pixels. With the existing warning-level strict
decoder, original bytes convert to a 312,626-byte WebP. Also passed the previous
Uint8Array path and multipart encode/parse byte-equality test, native dynamic import,
and local Next webpack server bundle conversion (DB client stub throws a sentinel
only AFTER successful normalization). No source bytes/EXIF/files copied or uploaded;
original mtime unchanged. DPI is never an acceptance condition in the code.

Therefore no defect in these particular bytes, dimensions, DPI or local decoder
was reproduced. Production-only failure remains UNCONFIRMED: no authenticated
Production response/log or deployment binary was available. Do not claim a native
module failure, pixel overflow or corruption as the root cause of this file.

## Confirmed error-path defect and corrections

Previously normalizePhoto caught every exception—including sharp import failure,
24MP limit, oversized output and corrupt images—and returned INVALID_IMAGE/400.
This discarded the failure stage and blamed the image even for server failures.
Now:
- byte buffer canonicalized to Node Buffer, same strict decode and limits retained;
- original/output byte limits return distinct 413 codes;
- format, animation, pixel-limit and decode errors are distinguished;
- sharp load/conversion failures are server 503 errors rather than invalid input;
- multipart MIME/type and size failures are distinguished before normalization;
- bounded diagnostics contain only stage/code, never paths, bytes, EXIF, raw native
  messages, tokens or user identifiers. Existing bilingual safe messages retain
  the original cause through the partial-upload error wrapper.

No permissive decoder fallback, pixel/byte increase, schema, RLS, bucket or Auth
change. Production diagnosis after approved deployment: inspect only the safe
HISTORY_PHOTO_NORMALIZE stage/code and displayed HTTP code for one operator-chosen
retry. Do not bulk retry or change RLS based on an INVALID_IMAGE message.

## Residual failed albums

Code creates an unpublished album before the first upload. Normalization occurs
BEFORE photo metadata reservation and Storage upload. First decode failure thus
leaves a private empty album, with no object for that failed photo. Earlier successful
photos in a multi-file run may remain ready but unapproved in the private album.
registerPhotos skips publish on ANY upload failure. No automatic cleanup/deletion
or actual Production inventory was performed; live residual counts are unknown.
Use the existing /admin/history recovery UI to inspect deliberately, not bulk-delete.

## Special activity years

Existing gallery already uses the activity date, not upload date. Shared
activityYear now makes this calendar-date behavior explicit and tested; no separate
year input/column added. 2025-12-20 -> 2025, 2026-10-26 -> 2026; future years remain
automatically included. Both languages use the same data/filter path. Categories,
regular season choices, existing grid/slides and content unchanged.

## Verification

46 focused tests pass: actual decoder JPG/PNG/WebP, progressive/oriented camera
JPEG, generated reported dimensions/DPI, real multipart transfer into normalizer,
known 24MP rejection reproduction, distinct 400/413/503 reasons, decoder-load
failure, no reservation/storage call on decode failure, no publication after partial
failure, Auth/RLS-facing regression ports and year boundaries. Synthetic images only
in tests; no real image fixture committed. Local Chrome year filters: 6 checks pass
(ko/en, 2025/2026/2027); external network blocked. Safari/WebKit browser runtime is
not installed, so real Safari execution was NOT claimed. Standard browser File /
multipart MIME and extension-case tests passed; extension/DPI are not decode guards.
TypeScript, webpack production build and changed-file lint pass. Whole lint retains
2 unchanged main SMS test errors and 3 warnings.

No push/PR/merge/deploy/DB write performed. Review this diagnostic correction before
approving rollout. No SQL/flag change required. Roll back application version if
needed; preserve all albums/objects/policies.
