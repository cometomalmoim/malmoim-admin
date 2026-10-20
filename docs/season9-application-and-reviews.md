# Season 9 application UI and administrator-managed reviews

## Scope confirmed by the organizer

- Replace the email button in the landing contact section with Instagram: https://www.instagram.com/cometomalmoim/?hl=ko . Keep the inquiry form/private reply workflow intact.
- Manage event landing reviews from `/admin/events/[slug]/reviews`, linked from the event home. Editors control display name (defaults to anonymous), original language/body, order and publication. Source notes stay private. Existing `history_reviews` is not modified.
- The public Season 9 carousel reads only approved published records. Without any published review it retains the factual introduction slides; no invented participant testimonials are seeded.
- Application UI changes 1–6 were approved: single-language toggle, existing five-step flow, group cards, contact-specific guidance, compact optional questions and a final editable summary. The English route renders English directly. Switching language does not navigate away or unmount input fields.

## Compatibility

All original submission field names, required fields, consent names, submission ID and UTM capture remain. Bilingual stored values for gender, language levels, referral sources and payment preferences remain identical to the original form. Both introduction questions remain separate optional fields; no response field was deleted. No registration deadline, privacy retention policy, server submission or SMS worker was changed.

The final review screen shows name/contact/group/fee, links back to edit and requires the same privacy and fee confirmations as before. Optional photo and future-season permissions remain separate and unchecked. Server errors preserve the mounted input and selection controls.

## Database and checks

`040_event_landing_reviews.sql` adds one admin-only RLS table and two RPCs. Anonymous users may only read the published projection. Edits require a registered admin and matching revision. Publication requires confirmation of real source material and permission. The public projection excludes source notes and admin IDs. Nothing is seeded or automatically published.

`supabase/tests/event_landing_reviews.sql` exercises draft privacy, confirmation requirement, public projection, unpublishing, stale revision, table-write denial and anonymous/nonadmin access, with every synthetic write rolled back. Browser verification uses a private disposable draft only. No fake review is committed as public content, and no application is submitted or real SMS sent during UI verification.
