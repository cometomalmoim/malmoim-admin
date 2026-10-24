# Hero photo balance / polaroid refinement

Follow-up to 5b80755 on feat/history-photo-simple-yejin.
Only the about representative photo and history hero photo group are changed.

About: 3:2 landscape instead of 16:9, zero corner radius, object-fit cover,
center 55% position. The original source is close to this ratio, reducing cropping
while adding height to balance the full existing introduction. Copy, font sizes,
controls and other sections are unchanged.

History: original three photos and their order retained. Intrinsic photo ratios,
white frames with extra lower padding, subtle shadows, rotations -3/+2/-2 degrees
(desktop). Shallow frame-edge overlap and staggered vertical positions. Mobile
uses alternating left/right large polaroids, -3/+3/-2 degree rotations and only
10px row overlap, buffered by 32px lower white space. No handwritten typography
or decorative text is restored. Responsive sizes matches the larger mobile frames.

Actual production rendering: 390, 768, 1440px, no horizontal overflow, all frames
inside the viewport, original photo ratios retained, white frames/lower padding
and rotations verified. Nine interior points per image were hit-tested and none
were occluded at any width; screenshots also visually reviewed. About image ratio
is 3:2 and computed radius is 0px at all three widths.

FAQ/tabs/gallery/dialog keyboard and touch regressions passed in all three widths
using browser-only mocked photo responses (no DB writes). Related tests: 18 pass.
TypeScript, webpack build and lint pass (0 lint errors, 3 pre-existing warnings).
No admin, Auth, API, RLS, database, image files, or other section styles changed.
No push, PR, merge, or deployment performed.

Local production preview: http://127.0.0.1:3025/about and /history.
Before/after comparisons: /private/tmp/malmoim-photo-design-review/polaroid-comparison.html.
New section-only crops are in polaroid-after/{about,history}-hero-{390,768,1440}.png.
Screenshots are local-only artifacts and are not tracked in Git.
