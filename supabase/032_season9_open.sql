-- Review after 031. This file intentionally enables real season9 intake.
-- Previously confirmed: 6 sessions, KRW 50,000, privacy deletion after program completion.
begin;
do $$ begin
 if to_regprocedure('public.season9_registration_info()') is null then raise exception 'Apply 031 first'; end if;
 if not exists(select 1 from public.recruitment_events where slug='season9' and not is_test and not is_archived) then raise exception 'Actual season9 event is missing or archived'; end if;
end $$;
update public.recruitment_events set
 status='published',applications_open=true,registration_enabled=true,
 opens_at=coalesce(opens_at,clock_timestamp()),closes_at='2026-11-01 00:00:00+09',
 privacy_notice_version='season9-2026-10-14-v1',
 privacy_notice='운영 주체: 말모임. 문의: cometomalmoim@gmail.com
수집 항목: 이름, 국적, 성별, 생년월일, 연락처, 소속, 언어 수준, 신청 답변, 희망 반, 참석 여부, 납부 방식, 유입 정보와 동의 기록.
목적: 신청 확인·참여자 관리. 보유기간: 프로그램 종료 후 폐기.
필수 개인정보 수집·이용에 동의하지 않을 수 있으나, 동의하지 않으면 신청할 수 없습니다. 사진 활용 및 다음 기수 안내 동의는 선택 사항입니다.
Operator: MALMOIM. Contact: cometomalmoim@gmail.com. Collected: identity and contact details, language levels, application answers, group preference, attendance, payment preference, referral information and consent records. Purpose: application review and participant management. Retention: deleted after the program ends. Required privacy consent is necessary to apply; photo use and future updates are optional.'
where slug='season9' and not is_test and not is_archived;
do $$ begin
 if not coalesce((public.season9_registration_info()->>'open')::boolean,false) then raise exception 'Readiness check failed; no changes committed'; end if;
end $$;
commit;
select public.season9_registration_info() as season9_intake;
