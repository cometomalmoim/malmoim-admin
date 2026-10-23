# Shared Korean / English About and History

Both /en/about and /en/history now re-export the original page components, replacing
the former generic English summaries. Section order, photos, program tabs, FAQ,
recruitment information, gallery, reviews, dialogs and CTA are shared, not duplicated.
English metadata and canonical/language alternates are defined on the English routes.

## Maintaining translations

`src/lib/i18n/about-history-en.ts` maps exact Korean source strings to friendly English.
`about-history.ts` handles numbered cohorts, filters, photo positions, counters and
contextual labels without changing their numbers or user-provided title substrings.
Add/update the English entry whenever adding/changing a Korean UI string; the coverage
test checks static UI labels and known server/photo errors for untranslated literals.
The existing Korean wording is retained in the source components. Korean render returns
the original tree without changing text; English uses a no-DOM translation adapter.

`PublicLanguageProvider` reuses the locale already passed by PublicFrame. The adapter
preserves components, event handlers, refs and Suspense streaming boundaries. It translates
text/alt/title/aria-label/placeholder and localizes supported public links, not API or
external map URLs. User-written photo/review titles, descriptions, bodies and display
names are preserved as authored; this feature does not machine-translate database content.

## Language persistence

Existing /en routes, language picker and malmoim_locale HTTP-only cookie are reused.
A real browser regression exposed prefetch responses overwriting a deliberate language
choice. The locale-cookie writes in proxy.ts now run only for explicit ?lang=en/ko
selection; background route requests do not change the preference. Supabase getClaims,
Auth refresh cookie forwarding, admin matching and all session logic are unchanged.
Both public-site lang and the document lang follow the selected language.

## Validation

390, 768, 1440px actual production rendering:
- Korean and English section order/count match (About 6 direct blocks, History 4).
- Identical image sources and order (About 5 images, History 3).
- No horizontal overflow; original 3:2 square-corner about photo and polaroids retained.
- No untranslated Korean application copy in main, all program tabs, expanded FAQ,
  history categories and login dialog. The language picker intentionally says 한국어.
- Korean → English → Korean and reload pass, plus a bare /history navigation keeps English.
- Program tabs, FAQ, disabled application controls, gallery keyboard, touch and dialog
  controls pass with browser-only mocked published photos. No Supabase writes performed.
- Korean source literal audit retained the original strings; user text is not translated.
- TypeScript, webpack production build and lint (0 errors, 3 existing warnings) pass.
- New dictionary/tree/prefetch regressions pass. Existing tests unwrap the presentation
  boundary and keep checking original Korean dialog, touch and Auth refresh behavior.
- Full suite: 477 tests, 474 pass, 3 known baseline failures. The remaining failures are the two missing PGlite modules and the App Router report
  test invariant. No claim of a newly repeated Hosted write E2E is made.

The personal preview keeps HISTORY_PHOTO_SIMPLE_TEST_ENABLED=false. No admin/photo API,
RLS, database, Storage, original checkout, production, push, PR, merge or deployment changes.

Local previews: http://127.0.0.1:3025/about, /history, /en/about, /en/history.
Korean/English screenshot pairs: /private/tmp/malmoim-photo-design-review/bilingual-comparison.html.
Screenshots are local-only artifacts, not Git assets.
