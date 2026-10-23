# 업로드 journal SQL 초안 검토 — 적용 금지

대상: history-activity-upload-journal.NOT-FOR-EXECUTION.sql.
별도 신규 초안이다. 기존 001·002·manifest·설계·TypeScript를 변경하지 않았다.
DB 연결, SQL 파싱/컴파일/실행, 실제 권한·동시성·Storage 검증을 수행하지 않았다.
이 문서는 현재 초안의 **구현된 부분과 의도적으로 막아 둔 부분**을 구분한다.

## 객체와 계약 매핑

- 비노출 후보 스키마 history_upload_private. jobs / files / events 3개 테이블.
- jobs는 UploadRecord의 요청/관리자/활동/지문/버전/단계/완료 수/삭제 의도와
  UploadJournalEntry의 버킷/스키마 버전/시각/마지막 확인을 보존한다.
- files의 slot 순서로 beginIds/endIds/photos/tickets/attempts를 복원한다.
  예약 전 photo 필드는 NULL, 발송 전 dispatch 필드는 NULL이다.
  attempts=NULL과 response=unknown 기본값을 구분하려면 dispatch_id 존재를 기준으로 매핑한다.
- dispatch=intent_recorded는 발송 의도, invoked는 호출 직전 저장 표시다.
  **둘 다 실제 원격 수신·실제 바이트 전송의 증명이 아니다.** 별도 sent=true 값은 만들지 않는다.
- response와 response_at/evidence, verification과 verified_at/evidence,
  end_confirmed와 ended_at/evidence를 따로 보존한다. unknown은 실패가 아니다.
- 사건 이력은 요청+revision마다 append한다. 사건/작업/사진에 직접 접근하는 정책은 없다.
- claim / cas / report / get_job / recovery_page와 내부 require_server 총 6개 함수 초안.
  전체 함수의 PUBLIC·anon·authenticated·service_role EXECUTE를 회수한다.
  SECURITY DEFINER + 빈 search_path + 완전 수식 이름을 사용한다.

## 원자성·증거

claim은 활동 잠금과 claim 간 전용 advisory lock, 전역 요청 PK,
ON CONFLICT DO NOTHING을 사용한다. 슬롯도 같은 트랜잭션으로 저장한다.
같은 관리자·활동·지문으로 재조회하면 false이며 재발송 권한이 아니다.
다른 입력의 전역 ID 충돌은 오류다. claim 간 operation ID 교차 중복을 검사한다.
기존 history_manage_activity는 이 advisory lock을 사용하지 않으므로 외부 명령과의 ID 경합까지
해결된 것은 아니다. 브라우저 직접 명령 경로와 서버 wrapper 경계 확정이 필요하다.

CAS는 활동→작업 순서로 잠그고 정확한 revision 일치 때만 +1 한다.
반환 false/응답 유실을 근거로 IO를 재발송하지 않는다. 의도·호출 직전 표시는 단방향이다.
종료·검증을 일반 CAS 인자로 입력할 수 없으며 report만을 위한 필드로 분리했다.
complete/fail은 각각 필요한 response/verification/end_confirmed 조합 없이는 거부한다.
다만 report 자체는 미구현·상시 차단이므로 **이 초안만으로 정상 완료 경로를 실행할 수 없다.**
시각 필드나 evidence UUID 자체는 증거의 진위를 증명하지 않는다.

## 의도적 실행 차단과 전제 검사 한계

1. BEGIN 직후 무조건 예외, 끝은 ROLLBACK. 자동 migration 경로에 넣지 않는다.
2. require_server는 admin_users 확인 후에도 무조건 예외. p_report=true도 우회하지 못한다.
3. report도 종료 근거 인증·영수증 대조가 구현되지 않았다는 독립 예외를 포함한다.
4. 새 역할/권한 부여/역할 전환/서버 credential 생성/Storage 변경은 포함하지 않는다.

사용자가 나중에 적용을 승인하더라도 이 파일의 예외만 지워 실행하면 안 된다.
전용 실행 절차에서 workdir project_id, 실제 컨테이너 ID, host 55422 매핑,
API 55421 프로젝트 일치, 클러스터 ID, PostgreSQL/Storage 버전, 접속/소유 역할,
스키마 CREATE·테이블 SELECT 권한, 기존 001 함수/트리거/정책/ACL 및 백업을 다시 검증해야 한다.
초안의 이름·current_database 검사만으로 환경을 확정할 수 없다.
명시적 검증값과 트랜잭션 기반 실패 중단을 갖춘 별도 테스트 migration이 필요하다.

## TypeScript·기존 설계와 남은 불일치

- TypeScript에 없는 필드: evidence 참조 ID, DB 시각별 근거, 원본 reserve/begin/end 활동 revision,
  recovery_required, 사건 이력. 현 coordinator는 활동 RPC 호출 인자를 영속 보존하지 않는다.
- 이전 설계의 dispatch_state=outcome_unknown/terminated 대신 현재 TS의
  dispatch(intent_recorded/invoked)+response+verification+endConfirmed 조합으로 정규화했다.
- SQL의 UUID·정확한 경로·photo FK·지문 제약은 현재 일부 mock fixture보다 엄격하다.
  mock의 단순 문자열 ID를 그대로 실제 어댑터 입력으로 사용할 수 없다.
- 현 compareAndSwap(nextRecord)는 전체 스냅샷 계약이다. 초안 CAS는 action별 typed 변경이다.
  어댑터 diff 검증/원자 묶음/확인 RPC 경계가 아직 필요하며 drop-in 구현이 아니다.
- reserve는 슬롯별 CAS로 기술되어 여러 버전이 필요하고, 현재 coordinator는 photos 배열을
  한 번에 저장한다. 향후 batch reserve CAS로 원자 묶음을 설계해야 한다.
- completed는 현 coordinator에서 사진마다 증가한다. 이 초안은 complete에서 전체를 설정하며,
  report의 연속 완료 prefix 업데이트는 주석으로만 설계했다. 다중 사진 정상 경로는 아직 미완성이다.
- last_confirmed_at의 일반 CAS 갱신을 금지했다. 현 mock은 파일 검증 CAS에서 이를 갱신하므로
  향후 전용 report/confirm으로 원자 매핑이 필요하다. reservation/ticket에 대한 confirm RPC도 후속 대상이다.
- report에는 증거 필드 저장·DB 영수증 및 티켓 대조·서버 신원 인증의 실행 본문이 없다.
  종료 보고를 관리자 권한 boolean으로 대체하거나 service_role로 우회하지 않는다.
- recovery_page는 job 목록만 반환한다. 파일은 get_job에서 얻고 TS envelope로 변환해야 한다.
  created_at 상한/100건 keyset은 장기 snapshot이 아니다. cursor 뒤에서 바뀐 상태는 반복 scan으로 회수한다.
- 권한 회수 후 다른 관리자의 인수는 아직 없다. 기존 actor를 바꾸지 않고 별도 승인/감사 설계가 필요하다.
- 전체 상태 전이표·불변 필드·사건 append-only의 직접 소유자 변경 방지 trigger는 미구현이다.
  현재 일반 역할은 RLS/ACL로 차단되나 DB 소유자·superuser까지 제한했다고 주장하지 않는다.

## 삭제 및 기존 기능과의 경계

CAS delete는 journal의 삭제 의도·시각·복구 플래그만 설정한다. 기존 SQL의
begin_delete/begin_photo_delete를 호출하거나 사진 표식을 변경하지 않는다.
활동/사진의 삭제 상태가 있으면 새 intent/invoked를 거부한다. 이미 발송 허가된 원격 작업의
늦은 완료를 취소할 수는 없다. 기존 upload_in_flight/delete_wait/deleting/deleted와 scanner가 필요하다.
원자적인 기존 삭제 준비+journal 변경 wrapper는 후속 설계이며 이번 초안에서 구현하지 않았다.
uncertain·삭제 의도·미완료 기록은 복구 조회에 포함하고 시간만으로 완료/실패/티켓 종료하지 않는다.

기존 후기 테이블·버킷·정책·관리자 로그인·001 함수는 변경하지 않는다.
10장·장당 5MiB·합계 50MiB는 journal 슬롯과 기존 활동 전체를 대조한다.
대표 사진/공개 검증은 기존 finalize/publish가 담당하며 이 초안에는 공개 기능이 없다.
파일 삭제는 Storage API만 허용하고 경로·표식·감사는 유지한다. 자동 down/drop/cascade/TTL 정리는 없다.
DB rollback은 외부 파일 작업을 되돌리지 못하며 실제 종료 근거가 없으면 차단 상태를 보존한다.

## 다음 단계와 향후 검증

다음 한 단계: **서버 전용 호출·종료 보고의 인증 및 증거 출처 계약 확정**.
그 뒤 batch CAS/완료 prefix/원본 명령 보존을 보완하고 별도 정적 리뷰한다.
현재 파일의 존재는 SQL 적용·업로드 활성화 승인이 아니다.

추후 승인된 독립 DB에서만 확인할 항목:
- SQL/PLpgSQL 컴파일, deferred FK/실제 기본 권한/RLS/소유권, NULL·경계·부정 증거 입력.
- 동일 ID/다른 actor·활동 claim 경합, operation ID 교차 충돌, CAS·삭제 lock 순서/deadlock.
- 발송 의도 뒤 crash, 호출 전 crash, 응답 유실, timeout 뒤 늦은 저장, 증거 없는 완료/실패 거부.
- 관리자 권한 회수/일반 회원/anon/service_role 직접 접근·보고 거부.
- 10/11장, 5MiB/50MiB, 대표 사진 유지, 복구 페이지 재스캔 및 정확한 경로만 scanner 정리.
- 백업·실행 전후 기존 후기/계정/Storage 자료 보존 및 commit 결과 불명 시 재실행 중단.
