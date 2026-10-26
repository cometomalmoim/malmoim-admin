# Applicant-first messaging — 2026-10-26

- Both global and event applicant lists support page selection and a shared bulk dialog. Mixed-event selections are explicitly scoped to one event with excluded rows shown.
- Regular single-row sending and the messaging event composer share this same editor. The existing paid/refunded status notice keeps its restricted dedicated flow.
- One active saved template source per event/language; built-in starters and free text can be registered at preview time with explicit UI notice. Editing an existing saved template affects this send only.
- Message workspace adds payment, preferred class, nationality-group filters and current-page selection; selection remains across pages up to 50. Changing search/filter resets selection.
- Names and event fields render per recipient. Saved individual fee wins unless an explicit common override is entered. Unknown fees are not guessed.
- Preview groups cost, masked recipients, per-recipient text, exclusions and preparation errors. Actual paid send still requires explicit acknowledgement and click. Drafts lock editing until cancelled.
- Existing prepare_applicant_sms / sms_approve guards remain: administrator access, current template, active applicant/event, applicant revision, approved+paid final confirmation, pending/unknown/duplicate and delivered-resend acknowledgement.
- Bulk preparation shares one provider price lookup and uses at most three concurrent draft preparations. No new database migration.
- Failed preparation cancels its draft when possible. Cancellation only affects draft state; failed cancellation is reported. Ambiguous provider results are never automatically retried.

Validation: 16 input/render/action regression tests passed. Isolated existing 036/051 PGlite regression passed (RLS, immutable template versions, payment gate at prepare/approval, idempotency, pending/unknown/duplicate guards, chronology, SMS type, version conflicts). Modified-file lint and TypeScript checked. UI inspection uses no provider send and no live template save.
