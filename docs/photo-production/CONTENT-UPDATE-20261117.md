# History gallery content update — 2026-11-17 KST

## Completed

The operator requested replacing the existing test posts with actual photo-based
activity titles and descriptions, and authorized commit/push/PR completion.

Five existing, published albums on Production project `qkhlvdctdcpfyvohhikl` had
`테스트*` titles and empty descriptions. Their existing public images were inspected;
only the five titles and descriptions were updated. The copy describes visible
scenes, without inventing named events, outcomes, participants, or testimonials.
The existing `말모임 MT` album was unchanged.

The exact before/after public metadata is recorded in
`content/2026-11-17.json`. A guarded transaction required all five target rows to
still have their original test title, empty description, and published/nondeleting
state. The update aborted if the affected count differed from five.

## Language display

New bilingual copy is stored using `Korean | English` titles and two-line
`Korean\nEnglish` descriptions. The public adapter selects the route language for
the card, dialog, and photo alt text. Only a complete Korean/English pair is split;
ordinary titles, unmarked copy, and multiline descriptions remain intact. The
administrator continues to edit the complete stored text in the existing editor.
No columns, policies, auth flows, storage files, or publication settings changed.

## Preserved and still unverified

All six albums, photo IDs/URLs, covers, activity dates, categories and cohorts
were compared before and after through the public API and remained identical.
The dates and cohorts inherited from the test posts have **not** been established
as the true activity dates/cohorts. They must be checked against original activity
records before being treated as independently verified history.

Two special-activity records display the same outdoor group photo. Both were
preserved rather than arbitrarily deleting a record or assigning a different event.
No new images or additional historical events were available for this request.

## Validation and recovery

- Public API: exactly five renamed albums with nonempty descriptions, no test
  titles remaining, six total albums, all original media/date/classification intact.
- 25 targeted API, adapter, admin integration and lightbox tests passed, including
  bilingual selection, unchanged stored input and legacy multiline-copy handling.
- TypeScript passed. Production webpack build and browser verification are recorded
  in the PR/task completion message.

To reverse the content edit, use the recorded IDs and restore only `title` and
`description` from `before`, after confirming the row still matches `after`.
Do not restore unrelated metadata, alter photo approval, or delete media.
Reverting the frontend commit restores the previous bilingual display without
changing the stored albums.
