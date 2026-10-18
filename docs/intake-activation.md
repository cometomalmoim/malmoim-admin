# 9기·할로윈 실접수 연결

## 구조
- 9기: `/season9`·`/season9/en` → 통합 `/season9/apply` → `submitSeason9` → `submit_season9_application` → `event_applications`.
- 할로윈: `/2026halloweenparty`·`/2026halloweenparty/en` → 기존 `EventRegistrationForm` → `registerEvent` → `submit_event_registration_attributed` → `event_registration_responses`.
- 기존 관리자 전용 `event_application_admin_list`에서 두 종류를 통합 조회한다. `/admin/events/season9/applicants`, `/admin/events/halloween-2026/applicants`, 전체 `/admin/recruitment`.
- 관리자 데이터 경계의 getAdminAccess와 DB RLS는 그대로 유지한다. 비회원에게 테이블 조회/수정 권한을 추가하지 않는다.

## 한 번에 실행
`supabase/manual/open_season9_halloween.sql`은 아래 031~034를 하나의 transaction으로 묶었다. 개인정보 안내를 검토하고 이 파일 하나를 SQL Editor에서 실행하면 된다. 두 이벤트 중 하나라도 준비 상태 검사가 실패하면 모두 rollback된다. 성공 결과는 두 open 값이 true다.

## SQL 순서
1. 기존 이벤트 migration(003, 006~010, 관리자 통합 목록·유입·보관 관련 최신 migration)이 이미 적용되어 있는지 확인한다. 전체 SQL을 무조건 재실행하지 않는다.
2. `031_season9_intake_gate.sql`: 9기 상태 조회 RPC, 서버 상태 검사, 동의 문구 snapshot, 중복 안내. 이 파일은 접수를 열지 않는다.
3. 배포 후 `032_season9_open.sql`: 확정된 기존 9기 조건으로 실제 접수를 연다. 마감은 10월31일 23:59까지, DB exclusive cutoff 11월1일 00:00 KST.
4. `033_halloween_optional_deadline.sql`: 할로윈만 마감 일시 없이 받을 수 있도록 기간 검사를 수정한다.
5. `034_halloween_open.sql`: 개인정보 안내 검토 후 접수 활성화. 마감 없음, 참가비 추후 안내. 9기의 상세 개인정보 항목을 할로윈에 복사하지 않는다.
6. `035_halloween_close.manual.sql`은 지금 실행하지 않는다. 운영진이 접수를 닫을 때만 수동 실행한다.

004는 과거 초안이다. 031 적용 후 004를 다시 실행하면 강화된 검사를 덮어쓰므로 사용하지 않는다.
SQL은 검토용이며 운영 DB에 자동 실행하지 않았다. 실패하면 transaction 전체가 rollback된다.

## 검증
- 실접수 상태를 확인하지 못하면 입력을 허용하지 않는다. 화면 열림과 서버 저장 허용을 둘 다 검사한다.
- 9기 제출 식별자 재시도는 동일 신청의 일반 접수 확인만 반환한다. 다른 식별자로 같은 연락처 제출 시 중복을 안내한다.
- 마감/접수중지/동의 버전 불일치/일별·분당 제한은 DB 함수에서 거부한다.
- 할로윈 기존 원자적 마감·중복·정원·속도 제한·동의 snapshot을 재사용한다.
- 테스트는 전용 테스트 환경 또는 rollback transaction에서만 가상 데이터를 사용한다. 운영 신청자에 가짜 데이터를 남기지 않는다.
- 실제 저장·관리자 조회·실패·중복·마감·DB RLS 통합 검사는 SQL 반영 전 미검증이다.
- 개인정보 폐기는 기존 합의대로 자동화 미구현. 운영진의 종료 후 실제 폐기 절차가 필요하다.

검증: 격리된 PGlite PostgreSQL에서 저장·재시도·중복·마감·동의·필수값·snapshot·정원·할로윈 무마감/수동종료 및 비회원/일반회원 차단·관리자 조회 통과. registration/attribution 단위 검사 6개 통과. 실제 Supabase·관리자 브라우저 통합은 SQL 실행 전 미검증.
