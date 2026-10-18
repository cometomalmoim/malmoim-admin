# 13단계 서버 경계 · 검토 전용 (미연결·미실행)

실제 DB/Storage/SMS/OTP 구현 없음. 공통 인증·기존 SQL·환경변수 변경 없음.

## 경계
- PreviewAuth/fixtureAuth는 기존 개발 시연 전용이다. 실제 인증은 별도 AdminSessionAdapter.currentAdmin() 계약으로 분리하며 기본 denyAdminSession은 항상 거부한다. 실제 세션 adapter는 미구현이다. fixture 헤더를 운영 인증에 연결하지 않는다.
- EsignApplicantReader는 복합 키를 받아 비동기로 최신 신청/관리/참여/보관 상태를 반환한다. Supabase adapter는 미구현이다. 서버의 inspectSigningTarget은 UUID·source·관리자 이벤트 범위·반환된 복합 키를 검증한다. 이 함수는 사전 검사일 뿐 저장 권한을 부여하지 않는다.
- signingEligibility는 임시 accepted 정책이다. 참가 확정만 있는 경우 보류. 보관=true는 안전상 제외, 실제 adapter에서 보관 상태 미확인은 보류한다. 운영 보관 정책은 승인 대기다. 개발 fixture에는 보관 정보를 요구하지 않아 기존 시연을 유지한다.
- AsyncRequestRepository/AsyncRequestTransaction은 향후 DB 계약이다. AsyncMemoryRequestRepository로 await/롤백/중복 경쟁을 시험한다. 기존 시연 저장 경로는 유지한다. 실제 구현은 하나의 트랜잭션/RPC로 자격 재조회·잠금·요청·감사·멱등 결과를 함께 처리해야 하며 개별 Supabase HTTP 호출을 트랜잭션처럼 사용하면 안 된다.
- DemoFlow의 PDF render/store 주입점은 실패 시험용이다. 기본은 메모리이며 Storage adapter가 아니다. 파일 업로드 성공 뒤 DB 실패는 외부 파일을 자동 롤백하지 못한다. 운영 연결 전 durable job/outbox와 고아 파일 정리, 재시도·내용 해시 비교가 필수다.

## 요청/상태 규칙
(event_id,source,application_id)로 원본 존재와 이벤트 소속을 검증한다. 통합 뷰에 직접 FK를 걸지 않는다. 관리·참여·archive revision을 저장 시 다시 검사한다. 합격 취소/철회/전화번호 변경은 미완료 세션·토큰을 폐기하되 완료 기록은 보존한다. 중복은 문서 ID 기준, 재서명 cycle은 승인 전 사용하지 않는다. 동일 멱등 키+다른 payload는 거부한다. 재발급은 기존 요청 세대를 폐기한 뒤 최신 자격·연락처 재검증과 감사 기록을 원자적으로 남긴다. 만료는 서버 시각 기준이며 worker는 미구현이다.

## SQL 검토 초안 — 실행 금지
기본 4개 테이블은 esign-request-storage-review.md를 검토한다. 아래는 추가 제안이며 실행용 migration에 등록하지 않는다.
```sql
-- Referenced esign_requests must exist in an isolated approved test schema first.
create table public.esign_idempotency_records (
 actor_user_id uuid not null references auth.users(id),
 operation text not null, idempotency_key uuid not null,
 payload_sha256 text not null check(payload_sha256 ~ '^[0-9a-f]{64}$'),
 result jsonb not null, created_at timestamptz not null default now(),
 primary key(actor_user_id, operation, idempotency_key)
);
alter table public.esign_idempotency_records enable row level security;
alter table public.esign_idempotency_records force row level security;
revoke all on public.esign_idempotency_records from public,anon,authenticated;
-- No grants/policies yet: authenticated administrators are denied too.
```

## RLS/Storage 정책 검토
- esign_* 전용 테이블은 기본 거부. 승인된 관리자+이벤트 범위 SELECT 정책과 제한된 쓰기 RPC를 별도 검토한다. admin_users 등록만으로 모든 이벤트 권한을 추정하지 않는다.
- 참가자는 테이블 직접 조회 금지. 서버가 요청 전용 인증 세션·세대·만료·취소를 검사하고 최소 필드만 반환한다. 관리자와 참가자 PDF 다운로드도 동일 경계를 거친다.
- esign-staging/originals/signatures/completed 모두 private. UUID 경로·upsert=false·MIME/크기/암호화 검사·SHA-256 기록. 버킷/정책 생성 없음.
- 원본/완료 파일은 문서 버전·제출 ID와 묶고 보관 기한·파기 승인 전 자동 삭제하지 않는다. 감사 metadata에 전화번호/토큰/서명 원문을 남기지 않는다.
- 토큰은 해시 저장, OTP는 시도 제한/만료/재발급 폐기, 세션은 요청에 귀속. 실제 업체·인증 방식·연락처 변경 정책·보관 기간은 승인 대기다.

## 다음 승인
테스트 프로젝트·키·비용, 실제 schema/RLS 적용 목록, 관리자 이벤트 범위, 선정/보관/재서명 정책, 트랜잭션 잠금 순서, 파일 복구·파기 정책 승인 후 별도 구현한다. 운영 환경변수나 참가자 정보를 테스트 환경으로 복사하지 않는다.
