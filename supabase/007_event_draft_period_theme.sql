-- Run ONCE after 006. Draft dates can be unset; existing event data is preserved.
begin;
alter table public.recruitment_events
 alter column closes_at drop not null,
 add column visual_theme text not null default 'default' check (visual_theme in ('default','halloween')),
 add constraint event_draft_period_required check (
  (status='draft' and not applications_open) or
  (opens_at is not null and closes_at is not null and opens_at < closes_at)
 );
grant insert (visual_theme), update (visual_theme) on public.recruitment_events to authenticated;
commit;
