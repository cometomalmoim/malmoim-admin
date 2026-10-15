-- Event fee settings only. Prepared for review; do not run automatically.
-- Uses the existing event row, without a second fee table or seeded amounts.
-- Independent of 011_event_payment_refunds.sql; do not run that combined draft.
begin;

alter table public.recruitment_events
  add column if not exists fee_amount_krw integer
    check (fee_amount_krw is null or fee_amount_krw >= 0);

alter table public.recruitment_events
  add column if not exists payment_method text not null default ''
    check (char_length(payment_method)<=80),
  add column if not exists payment_bank_name text not null default ''
    check (char_length(payment_bank_name)<=100),
  add column if not exists payment_account_number text not null default ''
    check (char_length(payment_account_number)<=100),
  add column if not exists payment_account_holder text not null default ''
    check (char_length(payment_account_holder)<=100),
  add column if not exists payment_due_at timestamptz,
  add column if not exists payment_notice text not null default ''
    check (char_length(payment_notice)<=2000);

-- Extend the existing administrator-only column grants; do not relax table RLS.
grant insert (fee_amount_krw,payment_method,payment_bank_name,payment_account_number,
  payment_account_holder,payment_due_at,payment_notice)
  on public.recruitment_events to authenticated;
grant update (fee_amount_krw,payment_method,payment_bank_name,payment_account_number,
  payment_account_holder,payment_due_at,payment_notice)
  on public.recruitment_events to authenticated;

commit;
