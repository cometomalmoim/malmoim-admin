# 6단계: 합격자 요청 준비 (독립 로컬 미리보기)

## 확인된 저장소 정의와 미확인 사항

운영 DB 조회/SQL 실행을 하지 않았다. 다음은 배포 상태가 아닌 코드/SQL 파일 정의다.
- `src/lib/applicant-validation.ts`, `supabase/010_applicant_management.sql`: management.status = received/reviewing/accepted/waitlisted/declined/withdrawn. UI는 withdrawn을 '취소'로 표시한다. 전용 합격 취소 필드/철회 사유 필드는 확인되지 않는다. manage_event_application RPC가 관리자·이벤트·revision 검사 후 상태 및 감사 기록을 변경한다. 이번에는 호출하지 않는다.
- `supabase/010_applicant_management.sql`: event_application_list는 season9/registration/manual UNION ALL, management.status가 있으면 우선, 수동 기본 received. 기수/행사 원본 상태를 관리 상태로 덮어 보이게 하는 동일 통합 구조다.
- `supabase/011_participation_history.sql`, `src/lib/participation-validation.ts`: participation.confirmation = unconfirmed/confirmed/cancelled; 신청 합격과 별개다. 참가 취소를 합격 취소로 해석하지 않는다. 참여 이력 없음도 미확정과 구별한다.
- `src/lib/recruitment.ts`: admin 권한 재확인, traffic view를 event_id로 필터, 25건 페이지 조회. `src/lib/participation.ts`: event/source/application ID로 연결한다. 전체 일괄선택은 향후 서버 페이지 전체 재조회 필요.

## 미리보기 정책 (운영 정책 승인 필요)

순수 함수 `src/lib/signing-targets.ts`는 (event_id, source, application_id)를 JSON tuple 키로 사용한다. accepted 또는 별도 confirmed 근거가 필요하다. withdrawn/cancelled/대기/불합격/미확인/불일치가 우선 제외된다. received/reviewing + confirmed는 참가 확정 근거로 포함한다. 이 조합의 운영 허용 여부는 담당자가 결정해야 한다. 전화번호 없음은 자격 대상이지만 발송/선택 불가다. 합격 취소 시험은 운영 DB 상태를 새로 발명하지 않고 selectionRevoked 가상 표식으로 별도 관리한다. TEST-PHONE-*은 전송 불가능한 비전화번호 표식이다.

같은 복합 신청자·논리 서류 ID는 버전과 관계없이 기존 요청이 있으면 차단한다. 완료/취소/만료 이력도 새 요청 생성 대신 미완료의 명시적 재발급 예정 처리로 관리한다. 완료는 변경 불가다. 재발급은 최신 자격/연락처 재검토, 세대 증가, 연락처 snapshot 교체, 이력 추가를 한다. 원래 생성 시각·서류 버전은 보존한다. 7일 기본, 1~30일 범위는 테스트 정책이다. 실제 토큰은 없다. 상태 변경으로 자격 상실 후 재합격하더라도 운영에서는 폐기된 접근 권한을 자동 복원하면 안 된다. 이번 미리보기는 변경 시 미완료 요청을 cancelled로 유지하고 명시적 재발급 전 자동 복원하지 않는다. 실제 세션은 발급하지 않는다.

## 실행과 화면

`/preview/document-admin`의 '합격자 요청 준비 · 6단계' 탭. 기존 템플릿 state를 공유하며 3/4단계 PDF 코드와 신청자 관리/문자/수료증은 수정하지 않는다. 현재 탭 메모리만 사용, 새로고침하면 초기화된다. 템플릿이 원본 없는 fixture라도 요청 UI 테스트 가능하지만 운영 요청은 게시된 검증 완료 원본/필드만 허용해야 한다. 실제 완료 상태처럼 오인하지 않도록 완료 주입 버튼/기록에 가상임을 표시하고 PDF를 생성하지 않는다.

기존 credential-free 미리보기 복사본 `work/pdf-fields-check`의 src를 동기화한 후 그 폴더에서 `npm run dev -- --webpack --hostname 127.0.0.1 --port 3187`. .env 파일을 복사하지 않는다. 생산 빌드에서는 해당 페이지가 404다. 원본 저장소 환경변수를 사용하여 운영 서비스를 시작하지 않는다.

## 향후 API 계약 (이번 구현에 API/SQL 추가 없음)

- POST /api/admin/esign/requests: event_id, document_version_id, applicants[{source,application_id,expected_revision}], idempotency_key. admin 인증/이벤트 scope/Origin/CSRF, 요청 크기·배치 상한, 서버 최신 신청 및 참여 상태/event 연결 검증, 연락처 서버 조회, 게시된 문서·필수 항목 검사 후 transaction. 클라이언트 name/status/phone은 권한 근거로 사용 금지. 잘못된 한 대상이 있으면 전체 거절 또는 명시적 부분 결과 정책 결정. 중복은 DB unique로 동시성 방지.
- POST /api/admin/esign/requests/:id/cancel: expected_revision, reason. row lock, 완료는 보존, 미완료 요청 취소 및 토큰·세션 폐기, 감사 로그/outbox 취소.
- POST /api/admin/esign/requests/:id/reissue: expected_revision, reason, idempotency_key. 상태·이벤트·연락처 재검증. 이전 세대 영구 폐기, 새 세대/만료 설정, 감사 로그. 완료 재서명은 별도 승인된 새 cycle 문서가 필요하며 이전 파일을 덮어쓰지 않는다.
- 참가자 GET/제출/다운로드 API도 매번 서버에서 요청과 최신 자격을 검증한다. 합격 취소/철회 이벤트 연동만 믿지 않고 submit 직전에 재검증한다. 변경 처리와 제출을 동일 잠금 순서로 직렬화한다. 연락처 변경 시 기존 토큰·세션 폐기 후 관리자 재확인. 이미 완료된 PDF 열람 정책은 별도 법적 보관/본인 확인 정책으로 결정.

## DB/RLS 제안 (문서만, 미적용)

esign_documents -> immutable esign_document_versions -> esign_requests(event_id FK, source/application_id 논리 참조, version FK, cycle, status, contact snapshot/revision, expires_at, generation) -> esign_access_tokens(hash only), esign_audit_events, esign_submissions/files/jobs, message_outbox. 통합 view에 FK를 만들 수 없으므로 좁은 서버 RPC에서 실제 원본 소속을 검증한다. unique(event_id,source,application_id,document_id,cycle) 제안. 상태/연락처 변경 및 취소 이력 보존, 요청 당시 스냅샷과 현재 판정 분리.

RLS: anon 테이블 직접 조회/수정 금지. authenticated admin_users + 승인된 이벤트 범위 조회만. 생성·취소·재발급 직접 INSERT/UPDATE 금지, 권한 재확인 RPC/server 경유. service key 우회시 서버 검증 필수. private 원본/서명/완료 PDF bucket 분리, 짧은 다운로드 서명 URL, 암호학적 token hash/OTP/session/재사용 방지/기간·파기정책은 5단계 설계에 따라 별도 승인. 이번에는 DB/Storage/OTP/SMS/영구 저장 연동 없음.

## 구현 전 결정 사항

배포된 SQL/RLS, accepted와 confirmed 조합 허용, 명시적 합격 취소 기록의 원천, 철회 주체·사유, 미확정/이력 없는 신청자 취급, 중복 cycle/새 버전 재동의, 유효기간/완료 후 재발급, 연락처 변경 재확인, 관리자 이벤트 권한, 법적 동의 문구/촬영 선택 거절, 보관·파기, 본인 인증 수준, 문자 사업자·과금·재시도 정책을 확인한다. 기존 DB 변경 없이 읽기 adapter와 서버 상태검증부터 연결하고 문자 발송은 마지막 단계에 별도 승인한다.
