# Official Instagram → season archive (2026-11-17)

This is the original operator request: extract official Instagram photos and group
them by season using the dates printed on recruitment posters, rather than rename
old test albums or treat Instagram publication dates as activity dates.

## Collected and published scope

- Official source: https://www.instagram.com/cometomalmoim/
- 152 observed post/reel links and captions were inventoried in the authenticated
  browser. No private Instagram endpoint, password or browser credential was exported.
- 101 publicly displayed post cover image files were downloaded from their observed
  CDN URLs. From these, 59 activity-photo covers were visually reviewed and selected.
- Nine season albums cover Seasons 1–9. Each contains 1–10 photos, each from a distinct
  source post. This is **not** an export of every carousel slide or of reel footage.
- Nine original recruitment poster images are available beside the activity photos
  as schedule evidence. See `source-manifest.json` for the exact poster captions,
  original page links, selected post captions, original dimensions and file hashes.
- `src/lib/history-instagram/data.json` contains only the compact public display
  metadata. Images are local WebP files, longest edge at most 1600px, without copied
  EXIF/GPS metadata. No expiring CDN URLs are required at runtime.

## Date policy

Poster text is transcribed visually. The public UI labels it **Poster schedule**,
never a single activity date for every photo in the album. `sortDate` is only an
ordering/year-filter anchor. The poster and individual photo post are linked from
photo detail for verification.

| Season | Displayed poster schedule |
| --- | --- |
| 1 | 2025.07.26–08.30 |
| 2 | Thursday 2025.09.11–10.16; Saturday 09.13–10.18 |
| 3 | Six weeks from the second week of November 2025 |
| 4 | 2026.01.01–02.07 |
| 5 | 2026.02.26–04.04 |
| 6 | 2026.04.16–05.21 |
| 7 | Thursday 2026.06.18–07.23; Saturday 06.20–07.25 |
| 8 | Six weeks from 2026.08.19, Wednesday/Saturday |
| 9 | Six weeks from 2026.11.05, Thursday/Saturday |

Several captions advertise different dates from the poster. Those discrepancies
are explicitly retained in the source manifest. The Season 3 poster gives a week,
not an exact day; the Season 8/9 posters give a start and duration, not a verified
end date, so no precise end date was invented. Existing Season 9 application
schedules and the current additional-recruitment offer were not changed.

## Existing records and corrections

The previous placeholder-title update did not fulfill this source-collection task.
Its five known original test albums are retained as private drafts with their
original test titles/descriptions, rather than being represented as real dated
history. Their source IDs and before/after values are preserved in
`../content/2026-11-17.json`; no media or album is deleted. The real existing MT
album and all other records are preserved. The exact operation and public API
checks are reported in the task completion.

New curated Instagram albums are versioned with the repository. Existing dynamic
administrator uploads remain independent and keep their normal controls. Imported
curated albums deliberately do not expose a database edit action for nonexistent
managed IDs.

## Checks and rollback

Targeted tests verify all nine seasons, 59 locally present source-backed photos,
local posters, language selection, slide-source links, poster-date precedence and
legacy actual-date display. Existing API authorization, lightbox and gallery
regressions are retained. TypeScript, production build and browser checks are
reported with the PR.

To revert the archive, revert the application commit; static media and source
manifest are versioned together. Do not delete existing Storage objects or change
RLS. If restoring a former placeholder's publication state is necessary, first
review its original test metadata and obtain a genuine activity/date source.
