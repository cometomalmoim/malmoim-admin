# About / History brand design review

Branch: feat/history-photo-simple-yejin. Design-only follow-up to 7b6280d.
Local preview: http://127.0.0.1:3025/about and http://127.0.0.1:3025/history.
The preview serves the production build with the photo feature disabled.

## Changes

- Route-scoped editorial CSS layers using #F5F6F4, #FFFFFF, #07838D, #FFBF20.
- About: larger typographic hero, original activity photo, circular yellow caption,
  clearer program hierarchy/stages, location composition, recruitment information,
  two-column FAQ heading/content layout, and existing disabled application controls.
- History: original three-photo collage with photographic borders, archive heading,
  a visual line connecting existing cohort filters, asymmetric published-photo grid,
  review presentation, and a new closing link to the existing about recruitment anchor.
- Existing text, images, programs, fees, dates, links and their disabled states are
  retained. No invented cohort history, events, reviews or care guarantees added.
  The current main contains cohort filters rather than a separate dated timeline;
  those real filters are restyled without inventing records.
- Hover/entry motion respects reduced-motion preference. Focus outlines, tabs,
  native FAQ details, slide controls and touch handlers remain in place.

## Validation

Production screenshots at 390, 768 and 1440 px: both routes render with no horizontal
scroll. About tabs/FAQ/disabled CTA and history gallery/dialog keyboard/touch events
passed in all three sizes. Published photos were supplied by a browser-only mocked
API response, not by writing fixture data to Supabase. No Auth/API/RLS/Storage or
admin code changed in this design commit; the real Hosted E2E from 7b6280d remains
prior evidence, not a new Hosted write E2E.
Related simple-photo/admin/dialog tests: 18 passed. Full suite: 472 tests, 469 pass,
the same three main-baseline failures (2 missing PGlite, 1 App Router test invariant).
TypeScript and webpack production build passed. Lint: 0 errors, 3 existing warnings.
The existing review-storage-unavailable state is visible in this personal preview;
no fabricated reviews were substituted and no review DB configuration was changed.

## Review artifacts

Before/after screenshots (12 PNGs) and a side-by-side index are local-only under
/private/tmp/malmoim-photo-design-review/. They are not tracked in Git.
Each route has about-390.png / about-768.png / about-1440.png (and history equivalents)
in before/ and after/. The after screenshots use the production build, reduced motion,
and load lazy images before capture. No login fields or credentials are captured.

No push, PR, merge, deployment, or Supabase DB operation was performed.
