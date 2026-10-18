# 이벤트 운영 목록과 복원

- 예정된 이벤트: 현재 시각부터 30일 이내 시작, 시작일 오름차순, 최대 5개. 테스트·삭제·종료 제외. 더 먼 일정은 이벤트 관리에 유지.
- 종료: 모집 상태가 아니라 행사 종료 시각이 현재 이하일 때. 종료일 미정은 자동 종료하지 않음. 별도의 작은 회색 목록.
- D-DAY: 모집 마감일 기준, 한국 날짜 차이. 3일 이내 빨간색, 시각이 지나면 ‘마감 지남’, 미정은 ‘마감 미정’.
- 삭제: 관리자만 RPC로 보관 처리, 새 접수 차단. 신청·출석·개인 참여 이력·수료증 기록 보존. 삭제 목록에서 복원 가능. 복원 후 접수는 자동으로 열리지 않음.
- 기존 신청자 조회·이력은 유지. 신규 수동 신청/메시징 이벤트 선택에서는 삭제 이벤트 제외.
- 상태 변경은 이벤트 행 잠금·revision 검사·감사 기록과 한 트랜잭션. 공개/관리자 테스트 접수 모두 보관 중 차단.

## 검증

`node --experimental-strip-types --test tests/event-lifecycle.test.mjs tests/events.test.mjs tests/registration.test.mjs tests/participation.test.mjs tests/session-attendance.test.mjs`

DB: `030_event_archive.sql`의 마지막 COMMIT을 제외하고 `supabase/tests/event_archive.sql`을 이어 실행. 지정된 is_test 이벤트만 사용하고 모든 테스트/DDL을 ROLLBACK. 관리자 삭제·복원, 접수 차단, 신청 수 보존, 충돌/중복, 비관리자·익명 권한, 감사 실패 롤백 확인. 다중 연결 동시 실행은 별도 미검증.

실제 적용은 테스트 통과 후 030 파일 단독 1회 실행. 기존 012~015 참가비/환불 보류 작업은 이 변경에 포함하지 않음.
