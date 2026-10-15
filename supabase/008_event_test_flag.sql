-- Run ONCE. A data flag avoids inferring operational status from event titles.
begin;
alter table public.recruitment_events add column is_test boolean not null default false;
-- No new client write grants. Test flags are maintained by the DB operator.
commit;
