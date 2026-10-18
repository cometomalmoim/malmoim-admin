-- Review notice below, then run after 033. This enables real Halloween intake.
-- No deadline. Close manually with 035 when needed. No existing event/response is deleted.
begin;
insert into public.recruitment_events(slug,title,starts_at,ends_at,location,fee_notice,visual_theme)
values('halloween-2026','2026 말모임 할로윈 파티','2026-10-31 19:00:00+09','2026-11-01 00:00:00+09','연신내 하이브 HIVE · 서울 은평구 연서로27길 16-16 지하1층','참가비 추후 안내','halloween')
on conflict(slug) do nothing;
do $$ begin
 if not exists(select 1 from public.recruitment_events where slug='halloween-2026' and not is_test and not is_archived) then raise exception 'Actual Halloween event is missing or archived'; end if;
end $$;
update public.recruitment_events set status='published',applications_open=true,registration_enabled=true,
 opens_at=coalesce(opens_at,clock_timestamp()),closes_at=null,
 privacy_notice_version='halloween-2026-10-18-v1',marketing_notice=null,
 privacy_notice='운영 주체: 말모임. 문의: cometomalmoim@gmail.com
수집 항목: 이름, 전화번호, 말모임 참가 여부 및 참가한 기수·활동명(선택), 유입 정보와 동의 기록.
목적: 신청 확인 및 행사 운영·참가 안내. 보유기간: 행사 종료 후 폐기.
개인정보 수집·이용 동의를 거부할 수 있으나, 동의하지 않으면 신청할 수 없습니다. 참가비는 추후 안내하며, 신청 접수는 참가 확정이나 결제 완료를 의미하지 않습니다.
Operator: MALMOIM. Contact: cometomalmoim@gmail.com. Collected: name, phone number, past MALMOIM participation, optional season/activity, referral information and consent records. Purpose: reviewing applications, organizing the event and contacting participants. Retention: deleted after the event ends. You may refuse consent, but it is required to apply. The entry fee will be announced later. Submitting does not confirm participation or complete payment.'
where slug='halloween-2026' and not is_test and not is_archived;
do $$ begin
 if not coalesce((public.event_registration_info('halloween-2026',false)->>'open')::boolean,false) then raise exception 'Readiness check failed; no changes committed'; end if;
end $$;
commit;
select public.event_registration_info('halloween-2026',false)->'open' as halloween_intake_open;
