-- MANUAL OPERATION ONLY: do not include this file in the opening sequence.
-- Use when the organizer wants to stop intake. Existing responses remain intact.
begin;
update public.recruitment_events set applications_open=false,registration_enabled=false where slug='halloween-2026';
commit;
select public.event_registration_info('halloween-2026',false)->'open' as halloween_intake_open;
