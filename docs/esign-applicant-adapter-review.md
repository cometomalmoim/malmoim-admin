# 16단계 전자서명 신청자 조회 Adapter

## 실제 호출 없음
EsignApplicantReader는 주입된 EsignSnapshotSource/EsignSnapshotQuery만 호출한다. Supabase 클라이언트·키·네트워크 import가 없으며 운영 API·기존 시연에는 연결하지 않았다. 실제 source 구현은 승인 후 별도 작업이다. 가상 테스트도 DB/Storage/SMS/OTP를 사용하지 않는다.

## 조회 정의와 근거
- recruitment_events: UUID 이벤트 존재 확인 (`supabase/003_recruitment_applications.sql`).
- event_application_admin_list: event_id/source/id 세 조건으로 조회. name/contact/contact_type/status/revision/is_archived/archive_revision만 선택한다 (`src/lib/recruitment.ts`).
- 기수 event_applications, 행사 event_registration_responses, 수동 event_manual_applications는 event_application_list에서 UNION된다. event_application_management.status가 원본 상태보다 우선한다 (`supabase/010_applicant_management.sql`). 원본만 읽어 최신 관리 상태를 놓치는 경로를 만들지 않는다.
- event_application_traffic_list를 거쳐 event_application_admin_list가 event_application_archives의 archived/revision을 반영한다 (`supabase/016_application_attribution.sql`, `supabase/024_application_archive.sql`).
- event_participation은 별도 event_id/source/application_id 조회로 confirmation/revision을 얻는다 (`supabase/011_participation_history.sql`). 성공적으로 조회한 null만 참여 이력 없음이다. 실패·중복 행·형식 오류를 이력 없음으로 대체하지 않는다.
- 별도 운영 합격 취소 boolean은 확인되지 않았다. selectionRevoked는 만들어 추정하지 않고 최신 effective status로 합격 여부를 판단한다. 실제 합격 취소 업무 규칙은 승인 대기다.

## 일관성과 차단
Source.read는 하나의 일관된 서버 스냅샷/RPC에서 모든 조회를 수행해야 한다. 독립된 여러 Supabase HTTP SELECT를 이 계약으로 포장하면 안 된다. 실제 구현 전 DB 담당자가 권한·격리·원자 조회를 검토한다. application/participation/archive revision을 반환하지만 이력 조회만으로 저장 직전 변경 경쟁을 막지는 못한다. 요청 생성 RPC에서 같은 잠금 순서로 상태·이벤트·revision·연락처·버전·중복을 재검증해야 한다.

복합 UUID와 source를 정규화해 조회하고 반환 행 소속도 검사한다. 조회 실패는 APPLICANT_LOOKUP_FAILED로 차단해 내부 오류 내용을 노출하지 않는다. 데이터 불일치·알 수 없는 상태·revision 형식 오류는 예외로 차단한다. 보관 값 null/누락은 실제 상태 확인 실패이므로 기존 선정 함수에서 ARCHIVE_POLICY_HOLD로 보류한다. accepted만 다른 조건 충족 시 허용하고, received/reviewing+confirmed는 POLICY_HOLD, waitlisted/declined/withdrawn 및 cancelled는 차단한다. 정책을 새로 허용하지 않는다.

관리자 권한은 별도 AdminSessionAdapter/inspectSigningTarget 경계에서 확인한다. 이 reader 자체는 인증 API가 아니며 직접 공개하면 안 된다. 공통 인증은 변경하지 않았다. 이름·전화번호로 역검색하지 않는다. 인스타그램 연락처는 phone으로 전달하지 않는다.

## 검증 및 한계
가상 source로 이벤트·신청 경로 분리, 최신 관리 상태 변경, 참여 취소·철회·보관·미확인, 중복 행·조회 실패·잘못된 소속·동시 중복 예약을 시험한다. 기존 관리자/참가자/PDF 시연 테스트는 그대로 실행한다. 동시 예약 테스트의 메모리 UNIQUE는 실제 DB 동시성 보장이 아니며 운영 쓰기 트랜잭션을 대체하지 않는다.

실제 DB schema/RLS 적용 현황·이벤트 관리자 scope·일관된 조회 RPC·운영 상태 매핑·보관/재발급 정책·별도 테스트 프로젝트/키·파일 보관 정책 승인이 필요하다. 실제 source 구현·실세션 인증·DB 요청 저장·마이그레이션·버킷·SMS/OTP 연결은 미구현이다.

## 작업 보존
PR #61의 origin/main(84fbef4)을 fast-forward 반영했다. 기존 CSS의 드롭다운 변경과 supabase/.temp/cli-latest는 해시 일치로 보존 확인했다. main에 포함된 설문 기능 파일은 동기화로 가져왔으며 직접 수정하지 않았다. 커밋/push/PR/main 병합 없음.
