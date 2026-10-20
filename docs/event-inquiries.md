# Event inquiries — 2026-10-19

## Flow

- Season 9 KO/EN contact section → `/inquiries/new?event=season9&lang=ko|en`.
- Visitors enter a name/nickname, subject and message with consent. No phone number is requested. No application, payment or SMS operation is invoked.
- Successful database storage produces a private receipt link. Its 256-bit cryptographically random token is in the URL fragment, not the HTTP path/query. The visitor must save it; there is no identity recovery flow.
- `/admin/inquiries`: all-event inbox; event/status/name/subject filters and 20-row pagination.
- `/admin/events/[slug]/inquiries`: the same records scoped to that event. Linked from the event home and global sidebar. Reply history is append-only; administrators can add a correction as a new reply.
- Visitors refresh their private link to see replies. There is no automatic email or SMS notification.
- Messaging has an eighth template, `문의 답변 완료`, and a dedicated `{답변링크}` field. It accepts a link to an answered inquiry in the same selected event and requires exactly one normalized recipient before preparing a message. The existing paid-send confirmation remains mandatory. No actual SMS is sent during this verification.

## Database

Apply `supabase/039_event_inquiries.sql` once after the existing event schema. Two new RLS-protected tables are readable only by registered admins. App roles cannot directly insert/update/delete. Public security-definer RPCs provide event title lookup, bounded submission and exact-token receipt lookup. They expose no list endpoint. Reply RPC checks administrator identity and row revision under a lock. Two replies to the same revision cannot both save.

Receipt tokens are stored in the admin-only inquiry table so organizers can copy the private link for the requester. Treat them as access credentials. Public receipt responses omit admin IDs and other inquiries. Inquiry pages use noindex and no-referrer; the existing Meta Pixel allowlist excludes these routes. Submission is capped at 60 per event per hour, serialized on the event row. This cap is not a per-person anti-bot identity check.

Submission to draft, test or archived events is blocked. Published/closed events can receive inquiries independently of the application deadline. Existing application, fee, attendance and archive settings are unchanged. This migration does not add a retention/deletion scheduler.

## Checks

- 24 inquiry/template/message unit and mocked-provider regression tests passed. Provider mocks never contact SOLAPI.
- `supabase/tests/event_inquiries.sql` ran against the approved project: anonymous submission, idempotent retry, token isolation, anonymous table/reply denial, authenticated nonadmin denial, admin replies, stale revision, append-only reply history and direct-write denial passed; fake writes rolled back.
- A browser-created fake inquiry confirmed form → real storage → global/event-scoped admin inbox → admin reply → private receipt display on production. The designated fake inquiry and reply were then removed. No actual SMS was sent. Status filtering and the new messaging template were also checked in the production UI.
- Targeted ESLint and Webpack production build run before merge. Genuine simultaneous sessions, real SMS delivery and conversion impact are separate from these checks.

## Landing visuals

The supplied logo asset is unchanged; the Season 9 header blends its white canvas into the landing background. Banner piles now layer 36 leaves per side with varied shape/angle/size and soft edges. The first-timer paragraph aligns with the headline. The new auto-advancing KO/EN program-introduction slider is explicitly not presented as actual participant feedback; it pauses on hover/focus and has manual/pause controls and reduced-motion support.
