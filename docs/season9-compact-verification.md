# Season 9 inline compact application — 2026-10-26

- New: name, nationality, contact, birth year, preferred group.
- Returning: name, contact, preferred group. Returning is self-reported; no lookup or automatic identity merge.
- Privacy, fee and photo consent remain explicit and required. No profile defaults are invented.
- SQL 052 adds nullable year/type columns and a separate submission RPC. Legacy intake and stored responses remain intact. Existing intake switches and administrator RLS are reused.
- Year-only values appear in the administrator list; full date of birth stays NULL.
- Old application URLs preserve language and UTM and redirect to the landing page application anchor.

## Checks

- 17 compact input / Meta conversion / legacy regression tests passed.
- TypeScript and modified-file ESLint passed.
- Disposable PGlite: new/returning saves, idempotent retry, canonical duplicate contact, consent/input rejection, anonymous read denial, year-only storage, admin view, closed/archived intake rejection passed.
- SQL 052 applied in the existing Supabase SQL Editor. Intake still open.
- In one transaction under anon role, two fictitious Instagram applicants were accepted. Both rows were present and uncollected profile fields remained NULL. Entire transaction rolled back; a subsequent query confirmed zero remaining fixture rows. No SMS was sent.
- Fixture submission IDs: ac261026-0000-4000-8000-000000000001, ac261026-0000-4000-8000-000000000002.

Public UI deployment and responsive checks are recorded in the PR.
