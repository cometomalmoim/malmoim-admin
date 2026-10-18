-- Correct the current event notice only; preserve historical consent snapshots.
-- Run in Supabase SQL Editor. Does not change intake status or deadlines.
begin;
update public.recruitment_events
set fee_notice=replace(fee_notice,'10월 25~31일','10월 26~31일'),
    privacy_notice=replace(replace(privacy_notice,'10월 25~31일','10월 26~31일'),'October 25–31','October 26–31'),
    privacy_notice_version=case
      when privacy_notice like '%10월 25~31일%' or privacy_notice like '%October 25–31%'
      then privacy_notice_version || '-regular-oct26'
      else privacy_notice_version end
where slug='halloween-2026' and not is_test;
commit;
