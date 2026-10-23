# Sans-serif and original-ratio photo refinement

Follow-up to 9dae745, on feat/history-photo-simple-yejin.

- Removed Different Languages / Same Friends overlays and Real Stories decoration.
  Removed Comic Sans MS, Bradley Hand and cursive declarations; route text inherits
  the existing site's Arial / Apple SD Gothic Neo / Malgun Gothic / sans-serif stack.
- About representative photo: rectangular 16:9 at every tested width, object-fit cover,
  object-position center 62% to reduce ceiling crop and keep participants visible.
  Same image file; no stretching, replacement or edits to its bytes.
- History hero: three independent grid cells with 24px desktop / 16px tablet gaps,
  stacked on mobile with 20px gaps. Images use intrinsic width/height ratios,
  height:auto and object-fit:contain. No overlap, transforms or shared grid areas.
  Updated responsive sizes so the former small collage request does not blur mobile images.
- Main introduction, programs, prices, reviews, existing links and photo feature
  code remain unchanged. No database, policy or environment activation changes.

Validation: 390/768/1440px actual production rendering. About ratio 16:9 and radius
0px; all three history photos loaded, original source ratio retained, no bounding-box
overlap and no horizontal overflow. Mobile arrangement is vertical. Computed font
families are sans-serif throughout both main elements. FAQ/tabs and photo dialog
keyboard/touch regression pass at all sizes using browser-only mock responses.
Related tests: 18 passed. TypeScript, lint (0 errors / 3 existing warnings), webpack
build pass. Existing full-suite failures remain documented in the integration README;
no production DB or live Hosted write E2E was performed for this visual-only change.

Local production preview: http://127.0.0.1:3025/about and /history.
Comparison: /private/tmp/malmoim-photo-design-review/rectangular-comparison.html.
Before and after PNGs are local review artifacts, not committed assets.
No push, PR, merge or deployment performed.
