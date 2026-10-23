# 활동 사진 통합 SQL 검증 준비

상태: NOT-FOR-EXECUTION / 실제 적용·업로드 활성화 승인 없음.
산출물: history-activity-integrated.NOT-FOR-EXECUTION.sql.
이 파일은 설명만이 아니라 활동/사진 DDL, journal DDL, permit/observation DDL과 RPC 본문을 포함한
독립 통합 초안이다. SQL 문법·PLpgSQL 컴파일·RLS/ACL·RPC·동시성·Storage는 DB에서 검증하지 않았다.
정적 텍스트/객체 수/차단 장치/보존 점검만 수행했으며 '정적 검토로 안전성 승인 완료'도 아니다.
기존 001·002·SQL 초안·코드·문서·manifest는 변경하지 않는다.

## 1. 구성과 기준

통합본은 신규 설치 후보다. 기존 001이나 journal이 있는 DB에 덧붙이는 migration이 아니다.
동명 객체가 있으면 중단하며 삭제해서 빈 환경에 맞추지 않는다. 자동 migrations 경로가 아니다.
초반 무조건 예외 + BEGIN, 마지막 ROLLBACK을 유지한다. 예외만 지워 적용하지 않는다.

| 구조 | 목적 |
| --- | --- |
| public.history_activities | 제목/날짜/공개/대표 사진/활동 버전/삭제 요청 |
| public.history_activity_photos | 정확한 서버 경로/크기/MIME/티켓/진행 표시/삭제 대기·영구 표식 |
| public.history_activity_commands | 기존 활동 RPC 영수증·감사. 수정 가능한 journal로 사용하지 않음 |
| history_upload_private.jobs | 전역 request PK, actor/지문/단계/CAS 버전/삭제 의도/마지막 확인 |
| history_upload_private.files | 슬롯/사진/경로/티켓/dispatch/응답/검증/종료, 관측 tracking_revision·digest·표식 |
| history_upload_private.events | 작업 버전별 사건 이력 |
| history_upload_private.permits | 발급·유효시각·dispatch·삭제 시각. bearer URL/token은 저장하지 않음 |
| history_upload_private.observations | 관측 시각·세대·크기/형식/metadata/digest·관측 근거·unproven 종료 상태 |

총 8개 테이블(public 3 + private 5). 기존 private 6개 함수와 신규 4개 함수,
public 6개 함수로 총 16개 함수 초안이다. 기존 policy/trigger/FK도 통합본에 포함한다.
정확한 함수 signature/함수 권한/트리거 수는 추후 독립 검증 SQL에서 검사해야 한다.

장당 4,718,592바이트, 활동 전체 47,185,920바이트, 최대 10장으로
버킷 설정/버킷 검증 함수/사진 행 CHECK/활동 deferred 검증/journal/예약 합산을 변경했다.
관측의 실제 다운로드 크기는 손상·초과 파일도 mismatch로 기록해야 하므로 최대 4.5MiB로 제한하지 않는다.
등록 허용 한도와 사고 관측 데이터의 표현 범위를 구분한다.
대표 사진 1장 필수는 complete/publish에 유지하고 빈 비공개 draft는 허용한다.

## 2. 신규 RPC 본문

- reserve_batch: 활동→작업 잠금, 정확한 작업 revision, 서버 예약 사진 전체 매핑을 한 번에 저장.
  슬롯 수/중복/소속/삭제 상태/활동 전체 크기를 검사하며 CAS와 reserve 사건을 한 트랜잭션으로 기록한다.
  사진 생성·실제 reserve 영수증 provenance 확인은 별도 경계이고 아직 완성되지 않았다.
- append_observation: 활동→작업→슬롯 잠금, tracking_revision, 티켓/dispatch/경로/digest를 대조한다.
  샘플 시각 순서·최대 5초 신선도를 검사하고 결과/세부 metadata와 관측 근거 ID를 append한다.
  콘텐츠 일치 결과는 예약 크기·형식·digest와 독립 검증 필드가 모두 일치해야 한다.
  관측 버전을 증가시키고 needs_recheck/recovery_required를 남긴다.
  completed/ready/end_confirmed/last_confirmed_at은 변경하지 않는다.
- tracked_page: 기록된 사진 경로만 최대 100건 keyset 조회. 삭제·만료·완료 경로도 계속 포함한다.
  bucket 목록 조회나 자동 삭제가 없다. cursor 뒤 삽입은 반복 scan이 필요하다.
- request_delete: 활동→정렬된 작업→슬롯/사진 순서로 잠근 뒤 비공개/삭제 대기,
  journal 삭제 의도/감사, tracking_revision·tombstone, permit 삭제 관측 시각을 같이 기록한다.
  SQL 티켓 종료나 실제 Storage 파일 삭제는 수행하지 않는다. 이미 deleted인 활동의 lifecycle도 되돌리지 않는다.

모든 private RPC는 상시 차단된 require_server를 호출한다. 서버 전용 인증 구현/역할/GRANT는 없다.
report는 독립적인 미구현 예외도 유지한다. 신규 관측을 기존 file_verified/termination 증거로 승격하지 않는다.

## 3. 관리자 직접 end_upload 문제와 차단

이전 001은 authenticated에게 history_manage_activity EXECUTE를 주고 관리자 여부만 검사했다.
통합본의 해당 함수는 begin_upload/end_upload/observe_cleanup/finish_*delete/finalize/publish를
관리자 세션에서도 즉시 거부한다. 나머지 활동 메타데이터 관리·비공개·삭제 준비 흐름은 원형을 보존한다.
Storage helper도 insert/delete는 false를 반환한다. 공개 조회 경로/기존 후기 버킷은 분리되어 있다.
이는 완료된 서버 전용 구현이 아니라 **활성화 방지 장치**다. 기존 함수의 숨은 분기를 직접 떼어 실행하면 안 된다.

최종 구현은 사용자 관리 동작과 서버 증거 수락·티켓 종료를 별도 함수/권한으로 분리해야 한다.
전용 로그인 역할/풀러 실제 식별/session_user 검증/EXECUTE 최소 권한이 확정되지 않으면 차단 유지.
SECURITY DEFINER 안의 current_user는 소유자이므로 서버 호출자 증명으로 쓰지 않는다.
private 스키마 비노출·RLS·PUBLIC/anon/authenticated/service_role 권한 회수는 포함하지만
소유자·superuser나 침해된 서버까지 제한했다고 주장하지 않는다. p_actor·p_report boolean도 인증이 아니다.

## 4. 재시작·직접 업로드·관측 한계

PK와 stable operation ID, CAS 버전, ticket/dispatch/시각/허가 이력은 재시작 조사에 사용한다.
발송 의도가 남은 요청은 lease/timeout만으로 재발송하지 않는다. 파일 원문이나 token은 영속 기록하지 않는다.
request와 photo의 삭제 표식/정확한 경로는 물리 삭제하지 않고, 파일이 없거나 token이 만료돼도 추적한다.
동일 path에 늦은 파일이 생기면 새 관측으로 기록하고 재확인 대상으로 남긴다. 기록 없는 경로는 자동 삭제하지 않는다.

Signed upload URL의 유효기간 동안 유출·중복 제출·삭제 후 재생성이 가능하다고 보수적으로 취급한다.
만료 직전 시작한 업로드는 만료 뒤 끝날 수 있다. expiry는 종료 증거가 아니다.
관측의 generation도 실제 Storage에서 교체/동일 바이트 재생성(ABA)을 구분할 수 있는지 미검증이다.
DB는 외부 파일 세대를 잠그지 못한다. 두 샘플·DB 관측 CAS도 이후 변경을 막지 못한다.
metadata 존재/파일 일치/부재 관측은 Storage 요청 종료나 향후 늦은 쓰기 부재의 증거가 아니다.
따라서 관측 기록만으로 공개/티켓 종료/완전 삭제 성공을 확정하지 않는다.
실제 cleanup은 별도 서버 인증·Storage API와 경로 한정·재관측 계약이 필요하다. 직접 Storage 테이블 삭제는 금지다.

## 5. TypeScript/SQL 차이 및 우선순위

| 우선순위 | 차이 / 차단 조건 | 후속 작업 |
| --- | --- | --- |
| P0 | 서버 executor/reporter/observer 인증 미확정, private RPC 전부 차단 | 실제 연결 신원·역할별 capability와 위조 거부 계약 확정 |
| P0 | 직접 업로드의 Storage termination 근거 없음 | 신뢰 가능한 종료 관측 검토. 불가능하면 uncertain 유지 |
| P0 | permit 발급·claim RPC/신뢰된 expiry 저장 경로 미구현 | 발급 응답 유실·삭제·재사용까지 포함한 원자적 intent 계약 |
| P0 | content_digest 저장 경로, report 증거 출처·영수증 대조 미구현 | 브라우저 digest를 검증 근거로 쓰지 않는 서버 binding |
| P0 | 완료 prefix·report 실행 본문 미구현 | 사진별 증거 원자 수락/중복 재사용 방지 및 completed 증가 |
| P0 | 기존 public 삭제 준비 경로는 새 request_delete wrapper를 사용하지 않음 | 모든 삭제 진입점의 wrapper 통합 또는 차단 계획. 현재 두 경로의 동기화를 보장하지 않음 |
| P1 | TS whole-record CAS와 SQL typed-action/batch RPC 차이 | diff/원자 매핑, 상태 전이표·불변성·진행 상태 정합성 테스트 |
| P1 | tracking_revision과 journal revision의 2개 버전 | 어댑터가 정확한 버전을 전달하고 삭제·ticket/digest 변경 시 추적 버전 증가 보장 |
| P1 | batch RPC는 기존 사진 매핑만 수행, 영수증 확인 미완성 | 원본 reserve 입력/revision·receipt와 atomic bind |
| P1 | 동일 dispatch permit 한 행, 재발급/발급 불확실 인수 미완성 | token 원문 없이 permit 실행 추적 모델 리뷰 |
| P1 | observation SQL은 상세 필드/샘플시각/evidence_ref 요구, TS FileObservation는 요약만 제공 | 서버 관측 adapter receipt 확장 |
| P1 | TS의 mock 세대 검사와 달리 SQL은 Storage 세대를 원자 재검사할 수 없음 | 동일 안전성 주장 금지. 관측만 기록/항상 재확인 |
| P1 | scanner 페이지는 files만 반환, binding/최신 permit 결합·관리자 인수 없음 | 안전한 projection 및 권한 회수 복구 설계 |
| P1 | 옛 CAS reserve/새 batch 공존 및 operation ID lock을 외부 RPC가 공유하지 않음 | 한 경로로 수렴, cross-action/다중 worker 경합 검증 |
| P1 | observed binding 전체 대조 중 actor/request/slot은 조회/FK에 의존 | 복합 제약·입력 변조와 타 작업 조합 테스트 |
| P2 | SQL CHECK는 소유자 DML에 대한 전체 전이/append-only 불변성을 구현하지 않음 | 변경 거부 trigger/허용 RPC 내부 검사 범위 리뷰 |
| P2 | 원본 001·002/옛 초안은 여전히 5MiB/50MiB | 기존 파일은 보존. 이 후보용 별도 verifier·manifest 작성 |

이 통합본은 TypeScript 어댑터를 바로 연결할 수 있는 완료된 migration이 아니다.
P0가 남은 상태로 업로드·완료·실제 Storage 삭제 테스트를 허용하지 않는다.

## 6. 적용 전 SQL 검사 목록

정적 리뷰:
- 양쪽 원형과 통합본 diff, 원형 해시/신규 SQL 해시 고정, 4718592/47185920/10 전 구간 일치.
- 모든 routine signature/생성 순서·FK/인덱스/trigger/NULL 논리·checked_at 신선도 및 clock skew.
- private 테이블 5개 + public 3개, 함수 16개, 기존 policy snapshot 4개 보존과 신규 정책 범위.
- owner/security definer/search_path/기본 EXECUTE/RLS/직접 DML 권한 회수 및 신규 객체 누락 시 실패.
- disabled action·write helper·상시 인증 차단 유지. internal boolean/GUC 우회 불가.
- binding/세대/digest/영수증 위조, 권한 회수, CAS conflict, 영구 표식 보존, 자동 TTL 없음.

별도 승인 후 독립 DB에서만:
- PG/Storage 실제 버전·스키마·policy_grants/소유권 재검증과 SQL/PLpgSQL 컴파일.
- 동시 claim/CAS/예약·삭제·관측, lock 순서/deadlock, stale revision/중복 evidence/관측 replay.
- 파일 단위 4.5MiB 경계와 전체 45MiB/10장, 11번째·예약 합산·대표 필수·비공개 복구.
- 일반 회원·anon·service_role·관리자 직접 report/end 거부, 소유자 접근 범위 점검.
- DB 검증과 실제 Storage API 테스트는 별도 단계. 실제 파일 접근은 별도 명시 승인 필요.

## 7. 독립 테스트 적용 준비 순서 — 지금 실행하지 않음

1. 다음 작업: 통합본 P0/P1 항목과 권한·경합에 대한 **정밀 정적 리뷰**. 해결 전 새 migration 작성/적용 보류.
2. 승인된 조사에서 전용 malmoim-review-auth-lab workdir·DB 컨테이너 ID·host 55422 매핑·API 55421를 다시 검증한다.
   예전 컨테이너/cluster/version 값이 일치하지 않으면 수정해서 통과시키지 말고 중단한다.
3. 검증 대상에 활동/journal 객체가 이미 있으면 이 fresh 후보는 적용하지 않는다. 별도 증분안 리뷰가 필요하다.
4. 기존 계정·후기·Storage/승인/정책 자료의 보호 백업과 수량+내용 비교 기준 및 복원 방법을 확보한다.
   공유55422 전체 초기화·전체 복원으로 맞추지 않는다. 54322/운영은 접속 대상이 아니다.
5. 정밀 리뷰를 거친 별도 테스트용 migration/읽기 전용 verifier/manifest/정확한 객체별 복구안을 작성한다.
   스키마만 검증하는 단계라면 write/report 차단은 유지하고 파일·계정은 만들지 않는다.
6. 파일 해시·DDL 목록·보존·복구 범위를 제시해 별도 실행 승인을 받는다.
7. 승인된 runner만 단일 트랜잭션+첫 오류 중단으로 적용. 실패는 rollback, commit 결과 불명은 조회 전 재실행 금지.
8. 읽기 전용 verifier에서 owner/ACL/RLS/FK/trigger/index/RPC inventory 및 기존 보존 기준을 자동 비교한다.
9. 모의 DB 권한/동시성 테스트 다음에 별도 승인된 실제 Storage 단계로 진행한다. 화면/3001/3002 연결은 또 별도 단계다.

파일 정리는 Storage API로 해당 실행의 확인된 정확한 path만 대상으로 한다. 다른 버킷·기존 후기·
기록 없는 파일은 삭제하지 않는다. 표식·작업·관측 감사는 보존한다. CASCADE/down/reset은 기본 복구가 아니다.

## 한정 수정: CAS 기대 버전 및 관측 신선도

통합본의 cas/reserve_batch/append_observation은 기대 버전 0..9007199254740991,
request_delete는 활동 기대 버전 1..9007199254740991을 요구한다.
NULL/음수/범위 초과는 22023 예외, 잠금 이후 실제 버전과 IS DISTINCT FROM이면 false로 무변경 반환한다.
인자·반환형·잠금 순서는 유지한다. 유효한 최신 버전도 서버 인증 차단을 우회할 수 없다.

append_observation은 activity/job/file 행 잠금 획득 뒤 clock_timestamp()를 새로 얻는다.
NULL·비유한 시각·미래 시각·역순 샘플·최초 샘플로부터 5초 초과를 거부한다.
잠금 대기로 신선도 창을 넘긴 관측도 거부한다. 외부 Storage 변경을 막는 검사는 아니다.

추가 검색 결과 public.history_manage_activity의 기존 `a.revision<>p_revision` 비교는
앞서 p_revision IS NULL을 명시 거부하므로 같은 NULL 우회는 없다. 다만 이 기존 경로의
JS-safe 버전 범위 통일과 cas의 p_activity_revision(기대 journal 버전이 아닌 RPC 참조값) 상한 검사는
이번 수정 범위에서 변경하지 않았다. report는 아직 본문/버전 CAS가 없는 상시 차단 stub이다.

정적 회귀: `node --test supabase/tests/static/activity-integrated-guards.test.mjs`.
검사는 SQL 소스의 조건·순서·차단 장치와 JS 숫자/시각 모델만 확인한다.
PostgreSQL 구문 분석/컴파일/실행/NULL 평가/실제 잠금·동시성 검증이 아니다.
운영·로컬 DB와 Storage에 접근하지 않는다. 기존 P0·다른 P1 차단 조건은 그대로 남는다.
