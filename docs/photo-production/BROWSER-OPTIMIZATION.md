# Browser photo optimization — local candidate

Base origin/main 5600ee5, branch fix/history-browser-photo-optimization.
No DB/Storage/RLS/Auth/server pixel-limit changes and no real uploads.

## Flow and bounds

The source JPEG/PNG/WebP is inspected in the browser before decoding: maximum
20 MiB, 60 million pixels, 16384px on either side, still images only. Headers are
checked against actual bytes (JPEG SOF, PNG IHDR/APNG, WebP variants), not extensions.
These bounds accommodate common 48MP photos while limiting browser decode memory.
Images process sequentially. ImageBitmap is closed, object URLs revoked and canvas
buffers cleared. Decode/encode steps have 25-second limits; late bitmaps are closed.
HTMLImageElement.decode provides an API-absence fallback; failed optimization never
falls back to sending the original file. Full Safari/WebKit execution not available.

Canvas preserves aspect ratio/orientation, never upscales, and caps the long edge at
2000px. WebP quality .86 (bounded .78/.68 retries); explicit JPEG encoding fallback
if WebP is not supported. Optimized output must be <=4 MiB. Browser encode failure,
corruption, source size/pixels and timeout each have clear bilingual errors.

All files must optimize before a new private album is created. Progress shows
optimizing i/n then uploading i/n. Existing synchronous submission lock prevents
duplicate clicks. Uploads remain sequential; existing server decode/format/size/
24MP checks still run and any failed upload prevents publication. Existing album
photo addition also uses optimization; its prior explicit publication behavior
remains unchanged. Original files are never overwritten or sent as a fallback.

## Prerender clock boundary

No direct render-time Date.now() exists in owned history/photo code; native File
creation and browser work only happen on submission, with deterministic lastModified.
The reported Vercel clock stack was not provided, so attributing it to a specific
SDK statement remains unverified. History ReviewBoard now awaits Next connection()
before initializing request-dependent Auth/Storage work, inside existing Suspense.
This preserves the static hero/gallery shell and shared authentication behavior.
English reuses this same boundary. Final production build succeeds for both routes.

## Evidence

48 unit/API/server/i18n/admin/regression tests pass. Includes original source bounds,
real 27MP JPEG/PNG/WebP headers, prior partial-upload no-publish, byte/pixel/server
limits and three-category/year tests. TypeScript/webpack build and changed-file lint
pass. Whole lint: two existing main SMS test errors and three warnings unchanged.

Chrome: 4 final mocked scenarios (ko/en success + corrupt-second-file failure),
including ImageBitmap and HTMLImageElement fallback. Real synthetic 48MP JPEG and
27MP PNG/WebP all reproduce PHOTO_PIXEL_LIMIT with the original server normalizer.
Actual browser optimization yields 2000x1500 WebP; captured multipart bytes pass
that same real server normalizer. Three files upload once and publish once despite
double submit; progress captured. A corrupt second source creates no album/uploads.
The uniform synthetic test fixtures produced 5914-byte output, not a guarantee of
real-photo file size. No production API or database contacted; no raw image fixtures,
credentials, original user photos or session files committed.

## Rollout

Code review then approved push/PR/merge/deployment. No SQL or flag change required.
After deployment operator may register consented originals directly; Production
E2E remains pending. Do not remove failed existing albums automatically. Roll back
application version or disable the existing feature flag if needed; preserve DB.
