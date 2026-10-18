-- Optional operational notice update. Does not change application status/deadline or historical consent snapshots.
begin;
update public.recruitment_events set
 fee_notice='얼리버드: 10월 25일까지 25,000원 / 일반 참가: 10월 26~31일 30,000원',
 privacy_notice=replace(replace(privacy_notice,
  '참가비는 추후 안내하며, 신청 접수는 참가 확정이나 결제 완료를 의미하지 않습니다.',
  '얼리버드: 10월 25일까지 25,000원. 일반 참가: 10월 26~31일 30,000원. 신청 접수는 참가 확정이나 결제 완료를 의미하지 않습니다.'),
  'The entry fee will be announced later.',
  'Early bird: KRW 25,000 through October 25. Regular admission: KRW 30,000 from October 26–31.'),
 privacy_notice_version=case when privacy_notice_version='halloween-2026-10-18-v1' then 'halloween-2026-10-18-fees-v2' else privacy_notice_version end
where slug='halloween-2026' and not is_test;
commit;
