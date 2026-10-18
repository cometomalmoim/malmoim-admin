# 14단계: 전자서명 운영 연동 안전성 검토

## 범위와 결론

이 문서는 설계 검토 자료이며 실행용 마이그레이션이 아니다. 실제 Supabase DB/Storage 접속, SQL 실행, 문자·OTP 발송, 개인정보 조회를 하지 않았다. 코드·SQL 정의와 실제 배포 상태를 구분한다. 기능·공통 인증·환경변수·기존 SQL을 수정하지 않았다.

Git 기준: `feat/events-yewon`, PR #59 병합 `af6c95063fd566ec8fb52cc9a59fd69441e7c395`로 fast-forward 동기화. 직전 `874dbc1`과 파일 내용 차이 없음. 충돌 없음. `supabase/.temp/cli-latest` 보존. 커밋·push·PR·main 변경 없음.

**결론: 분리된 서버 계약은 준비됐지만 운영 연결을 승인할 근거는 아직 부족하다.** 별도 테스트 환경, 실제 schema/RLS 적용 목록, 이벤트별 관리자 권한, 선정·재발급·보관 정책을 먼저 승인해야 한다. 15단계는 외부 연결 없는 계약·테스트 보완부터 진행할 수 있다.

## 1. 코드에서 확인한 기존 구조

아래 경로는 저장소 루트 기준이다. SQL 파일이 있다는 사실은 실제 DB 적용을 뜻하지 않는다.

| 대상 | 확인된 정의·사용 | 근거 |
|---|---|---|
| 이벤트 | `recruitment_events.id` UUID, slug 고유, 초안/게시/마감 및 신청 공개 상태 | `supabase/003_recruitment_applications.sql`, `src/lib/events.ts` |
| 기수 신청 | `event_applications`, event_id, name/contact/contact_type, 원본 상태·기존 동의 기록 | `supabase/003_recruitment_applications.sql` |
| 행사 신청 | `event_registration_responses`, 기본 received, 연락처 형식, 제출 ID, 개인정보 문구 스냅샷·마케팅 동의 | `supabase/009_event_registration.sql` |
| 수동 신청 | `event_manual_applications`, event_id/name/contact/contact_type/source_note | `supabase/010_applicant_management.sql` |
| 관리 상태 | `event_application_management`, PK(source,application_id), event_id/status/revision/updated_by. 상태 received/reviewing/accepted/waitlisted/declined/withdrawn | 같은 파일 |
| 참여 | `event_participation`, PK(source,application_id), event_id/person_id/confirmation/attendance/revision. confirmation은 unconfirmed/confirmed/cancelled | `supabase/011_participation_history.sql` |
| 보관 | `event_application_archives`, archived/revision. 철회나 참가 취소와 별도 구조 | `supabase/024_application_archive.sql` |
| 통합 조회 | 원본 UNION + 관리 상태를 합친 `event_application_list` → 유입 정보를 합친 `event_application_traffic_list` → 보관 정보를 합친 `event_application_admin_list` | `supabase/010_applicant_management.sql`, `supabase/016_application_attribution.sql`, `supabase/024_application_archive.sql` |
| 실제 관리자 목록 코드 | event_application_admin_list 조회, 이벤트 필터, 보관 필터, 페이지 처리. 참여 confirmation은 별도 조회 필요 | `src/lib/recruitment.ts` |

식별자는 `(event_id, source, application_id)`를 사용한다. 이름·연락처·event_people.person_id로 신청 이력을 대체하지 않는다. source는 season9/registration/manual이다. 원본 신청 상태만 읽으면 관리 테이블의 최신 합격 상태를 놓칠 수 있다. 통합 뷰는 security_invoker 정의이며 원본 접근 권한에도 의존한다. 뷰 자체에 FK를 만들 수 없다.

### 인증·RPC·RLS

- `src/lib/supabase/server.ts`: publishable key와 서버 쿠키로 @supabase/ssr 클라이언트 생성. no-store fetch, httpOnly/sameSite 쿠키, production secure.
- `src/lib/auth.ts`: auth.getUser()와 admin_users 등록 여부를 매 접근마다 확인. 반환값에는 관리자 UUID·이벤트 범위가 없으며 이메일을 식별자로 사용하면 안 된다.
- `supabase/001_admin_users.sql`: 자신의 관리자 등록 행 SELECT만 허용, 앱 사용자 INSERT/UPDATE/DELETE 권한 없음. 관리자 자동 등록 없음.
- 관리·참여·보관 테이블은 RLS/FORCE RLS, 관리자 SELECT 정책, 제한된 RPC 쓰기를 정의한다. admin_users 존재 검사가 중심이며 전자서명 이벤트별 담당 권한은 확인되지 않았다.
- manage_event_application, link_event_person, record_event_participation, archive_event_applications RPC는 SECURITY DEFINER, 빈 search_path, 관리자 검사·revision 확인·이벤트 잠금을 사용한다. 신규 RPC도 권한 확인을 내부에서 수행해야 하며 기존 잠금 순서와 맞춰야 한다.
- RLS를 우회할 수 있는 서비스 권한을 사용하더라도 서버의 별도 권한 검증은 필수다. 기존 publishable key를 service key로 교체하지 않는다.

### 기존 비공개 파일·PDF

- `supabase/014_certificate_storage_jobs.sql`: certificate_jobs/uploads 및 비공개 certificate-downloads/staging 정의.
- `src/app/api/admin/certificates/route.ts`: 관리자 검사, 작업 시작 RPC, PDF 생성, upsert:false 업로드, 완료 RPC, 제한된 유효기간 signed URL. 최종 확정 응답이 모호하면 파일을 성급히 삭제하지 않는 처리도 참고할 수 있다.
- `supabase/020_people_photos.sql`, `src/app/api/admin/people/photos/[file]/route.ts`: people-photos 비공개 버킷과 관리자 확인 다운로드 경로.
- 위 버킷·정책은 코드와 SQL상의 정의다. 실제 생성·적용 여부는 미확인이다. 전자서명에는 별도 버킷·정책을 사용한다.

### 환경변수와 미확인 범위

`src/lib/supabase/config.ts` 기준:

| 이름 | 역할 |
|---|---|
| NEXT_PUBLIC_SUPABASE_URL | 연결 주소. 이름만으로 운영/테스트 구분 불가 |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | 공개 클라이언트 키. RLS·사용자 인증을 대체하지 않음 |
| SUPABASE_LOCAL_TEST | true일 때 development에서 정확한 로컬 주소만 허용 |
| NODE_ENV | 개발/프로덕션 동작 구분. 원격 DB의 용도를 증명하지 않음 |
| CERTIFICATES_ENABLED | 수료증 전용 기능 설정. 전자서명 활성화에 재사용하지 않음 |

현재 .env.local은 루프백 주소 분류·로컬 테스트 설정 활성화만 확인했다. 값은 문서에 기록하지 않는다. 파일 설정은 현재 서버 프로세스·배포 환경의 설정과 같다고 보장할 수 없다. HTTPS 주소 검증은 운영/테스트 프로젝트 allowlist가 아니다. 실제 연결 성공, 적용 schema/RLS, 버킷, 관리자 계정·담당 범위, 배포 환경·백업·복구 권한은 모두 미확인이다. 설정 검토 중 서버 클라이언트를 호출하지 않았다.

## 2. 13단계 서버 계약 검토

근거: `src/lib/esign-server-contracts.ts`, `src/lib/esign-preview-server.ts`, `src/lib/esign-request-repository.ts`, `src/lib/esign-demo-flow.ts`, `docs/esign-server-integration-review.md`, `docs/esign-request-storage-review.md`.

- 실제 관리자용 AdminSessionAdapter와 개발 fixtureAuth는 별도 계약이다. denyAdminSession 기본 거부. 실제 인증 adapter는 미구현이다.
- EsignApplicantReader는 비동기 조회 계약만 있다. 실제 원본·관리·참여·보관 데이터 조합 adapter는 없다.
- inspectSigningTarget은 UUID/source, 이벤트 권한, 조회 결과 복합 키를 검사한다. **사전 검사일 뿐 저장 권한이나 최신 상태 유지 보장이 아니다.** 쓰기 트랜잭션에서 원본 존재·상태·revision·이벤트 소속을 다시 확인해야 한다.
- signingEligibility는 accepted+없음/unconfirmed/confirmed 허용의 임시 정책이다. received/reviewing+confirmed는 보류, 대기/불합격/철회/참가 취소/불명확 상태는 제외. 보관=true는 안전상 제외하고 실제 adapter에서 보관 미확인은 보류한다. 운영 정책 승인은 별도다.
- 전화번호 형식 검사는 번호 소유나 SMS 수신 가능성을 보증하지 않는다. instagram 연락처는 SMS 대상으로 사용하지 않는다.
- AsyncRequestRepository는 비동기 계약이고 AsyncMemoryRequestRepository는 메모리 bridge다. 개별 Supabase HTTP 호출 여러 개는 트랜잭션이 아니다. RPC 또는 제한된 서버 DB 트랜잭션의 구현 전략을 먼저 정해야 한다.
- 현재 저장 타입에는 신청/참여/archive 각각의 revision, 지속 가능한 파일·제출 ID가 충분히 반영되지 않았다. 운영 DTO는 미리보기 타입과 분리해 보완한다.
- validApplicantKey는 기본 UUID 검사지만 source를 String 변환한다. 운영 입력 검증에는 source의 엄격한 문자열 타입·UUID 정규화·중복 키 정규화 및 알 수 없는 입력 처리 테스트를 보완할 필요가 있다. 이번에는 수정하지 않는다.
- DemoFlow의 render/store 주입점은 실패 시험용이며 외부 Storage adapter가 아니다. 실제 업로드 성공 뒤 DB 실패의 보상 처리는 구현되지 않았다.
- 현재 요청·토큰·세션·PDF는 단일 서버 메모리이고 참가자 코드도 개발용이다. 운영 인증·영구 보관·다중 서버 동작을 제공하지 않는다. 실제 업로드 원본 대신 생성된 테스트 문서를 쓰는 시연 경로를 운영 문서 처리에 연결하지 않는다.

## 3. 신규 테이블·컬럼 제안 — 미승인

기존 테이블의 컬럼·PK·뷰는 변경하지 않는다. 전체 기능을 한 번에 구축하기보다 요청 관리와 제출 저장을 단계별 승인한다.

| 테이블 | 주요 컬럼·관계·제약 제안 |
|---|---|
| esign_documents | UUID PK, name, active/archived, created_by(auth.users FK), timestamps |
| esign_document_versions | UUID PK, document_id FK, version_no, draft/published/retired, original_file_id, SHA-256, field_settings, consent_snapshot, 게시자/시각. UNIQUE(document_id,version_no), UNIQUE(document_id,id) |
| esign_consent_items | UUID PK, version_id FK, 항목 키·문구·필수/선택·순서. UNIQUE(version_id,item_key). 게시 후 불변 |
| esign_requests | UUID PK, event_id→recruitment_events, source, application_id, document_id/version_id, status, generation, expiry, 관리자, 최소 신청 스냅샷·관리/참여/보관 revision, 생성/완료/취소 시각·사유 |
| esign_idempotency_records | 관리자/operation/key PK, 정규화 payload hash, 결과·시각. 요청과 동일 트랜잭션으로 저장, 실패/빈 배치 보존 정책 결정 |
| esign_access_tokens | UUID PK, request_id FK, token_hash UNIQUE, generation, expiry/revoked_at/consumed_at. 토큰 원문 저장 금지 |
| esign_verification_challenges | request_id, 시도 횟수·시도 제한·expiry·verified_at·challenge hash. 실제 방식 승인 전 업체 연결 없음 |
| esign_sessions | request_id, generation, session_hash UNIQUE, 검증 수단·시각, expiry/revoked_at |
| esign_submissions | UUID PK, request_id UNIQUE(한 요청 1완료), version_id, 제출 멱등 키·payload hash, 서버 제출 시각, 서명 파일 ID, receipt hash |
| esign_consent_responses | submission_id+consent_item_id 복합 PK, 명시적 응답. 같은 게시 버전 소속 보장. 선택 항목 거절을 서명과 별도 저장 |
| esign_files | UUID PK, 요청/버전/제출 소속, kind, bucket, object_path UNIQUE(bucket,path), SHA-256, byte_size, MIME, staged/ready/orphaned/deleted, 보관·파기 시각 |
| esign_pdf_jobs | request_id/submission_id, 작업 키 UNIQUE, queued/processing/ready/failed, 재시도·lease·오류 코드, 결과 파일 ID |
| esign_audit_events | UUID PK, request/document/submission, actor UUID·종류, action, 이전/현재 상태, operation_id, 사유, 시각. 일반 사용자 UPDATE/DELETE 금지 |

후속 문자 연동 승인 시 esign_message_outbox/attempts를 별도 추가한다. 이벤트 권한용 esign_event_admin_scopes(event_id,user_id,can_read,can_create,can_cancel,can_manage_documents)도 제안하되 기존 팀 권한 모델이 있으면 중복 생성하지 않는다. scope 부여 API는 일반 관리자에게 자동 개방하지 않는다.

요청 상태 제안은 pending/processing/completed/declined/expired/cancelled. 참가자 UI의 verified/signing은 요청 완료와 다른 세션 단계로 관리한다. CHECK만으로 전후 상태 전이를 보장할 수 없으므로 전용 쓰기 함수가 필요하다.

문서 ID와 버전 ID는 복합 FK로 같은 문서임을 보장한다. 신청자 뷰에는 FK 불가: source별 원본과 event_id 소속을 RPC에서 검증한다. 필요하면 원본 참조 무결성 전략을 담당자가 별도 승인한다. application_id 하나로 여러 원본 중 어느 테이블인지 자동 판정하지 않는다.

동일 신청자·동일 문서 중복 방지는 버전과 무관하게 유지한다. cycle 추가 허용 전에는 동일 복합 키+문서 UNIQUE가 안전하다. 기존 초안의 cycle 증가로 중복을 우회하지 않는다. 재발급은 요청 generation 교체이며 완료 문서 재서명과 구분한다. 완료 기록은 갱신·덮어쓰기하지 않는다.

## 4. RLS·Storage 보안 정책 초안

모두 설계이며 정책 생성·SQL 실행 없음.

| 주체 | 허용 제안 | 거부·재검증 |
|---|---|---|
| 익명·일반 사용자 | 전자서명 테이블 직접 접근 없음 | 토큰만으로 다른 요청 목록 조회 금지 |
| 관리자 | 검증된 auth UID+이벤트 scope+동작별 권한에 따른 조회/생성/취소 | 브라우저 role/event 목록 신뢰 금지. UUID만 바꾼 타 이벤트 접근 차단 |
| 참가자 | 인증된 요청 세션으로 자기 게시 원본·동의·제출·완료 PDF만 서버 경유 | 최신 generation/expiry/취소/자격·연락처 변경 확인, 타 요청 세션 거부 |
| 작업자 | 전용 PDF 작업·파일 확정/정리 권한만 | 무제한 전체 신청자 조회 권한 부여 금지 |

테이블 RLS/FORCE RLS+권한 회수로 기본 거부부터 시작한다. 읽기 정책과 쓰기 RPC 권한은 함께 검토한다. SECURITY DEFINER는 빈 search_path, 명시적 스키마, 내부 auth UID·scope 검사, public/anon EXECUTE 회수, 제한된 grant가 필요하다. service 권한 사용은 별도 승인하고 브라우저로 전달하지 않는다.

버킷 제안: esign-staging(검증 전 임시), esign-originals(게시 원본), esign-signatures(별도 보관 승인 시), esign-completed(완료본). 전부 private. 기존 certificate-* 및 people-photos 정책을 변경하지 않는다.

객체 경로에는 UUID만 사용, 이름/전화번호/토큰 금지. 서버 검증된 경로만 사용하고 upsert=false. 확장자뿐 아니라 MIME·PDF 구조·암호화·크기·페이지 수·필드 좌표·회전 검증을 수행한다. 게시 시 원본 hash·필드·문구를 고정한다.

서버 프록시 다운로드를 우선 검토한다. signed URL은 짧은 만료라도 발급 후 즉시 취소를 보장하지 않으므로 철회 요구와 비교해 승인한다. private/no-store, 적절한 Content-Disposition/Content-Type, Referrer-Policy를 적용하고 토큰·서명 원문을 로그에 남기지 않는다. 발급 로그와 실제 다운로드 접근 로그를 구분한다.

## 5. 링크·동의·보관·장애 처리

링크는 충분한 난수 토큰으로 발급하고 DB에는 hash만 저장한다. 최초 교환 뒤 요청 전용 짧은 인증 세션으로 전환하고 URL 노출·로그·리퍼러 유출을 줄인다. OTP 실패 횟수·재시도 간격·만료·재발급 폐기·연락처 변경 시 무효화가 필요하다. 문자 링크나 현재 개발 코드만으로 실제 본인 확인이 충분하다고 간주하지 않는다.

최종 제출 시 필수 응답, 선택 항목의 명시적 동의/거절, 이름·서명 구조, 원본 버전·hash를 서버 검증한다. 요청/세션 상태를 PDF 생성 전후에 재검증한다. 서명 PNG 또는 벡터 표현 중 무엇을 보관할지 승인하고, 별도 이미지가 필요 없다면 중복 보관을 최소화한다. 현재 활동 규칙·환불·촬영 문구를 개인정보 수집 목적·항목·기간·거부 안내가 승인된 문구와 동일시하지 않는다.

파일·DB는 단일 트랜잭션이 아니다. 작업 예약 → 파일 생성/불변 업로드 → hash/크기 확인 → 요청/제출/응답/감사/파일 ready 원자 확정 순서를 제안한다. 확정 응답 유실 시 동일 작업 상태를 재조회하고 이미 확정된 파일은 삭제하지 않는다. 업로드 실패는 완료 표시 금지. 업로드 성공 후 취소/DB 실패는 pending 또는 실패 작업 기록과 고아 객체를 추적하고 보존 정책에 맞게 정리한다. 중복 worker는 lease/작업 키/최종 CAS로 차단한다.

보관 기간은 미정이다. 원본·완료 PDF·동의·서명·감사·실패 객체·백업별 기간, 파기 주체, 분쟁 보존 예외를 승인받는다. 기존 행사 신청의 retention_review_at(검토 예정일)을 전자서명 파일 자동 파기일로 복사하지 않는다. hash는 변경 탐지 수단이며 그 자체가 신원 증명이나 변경 불가능한 감사 저장을 보장하지 않는다.

## 6. 필요한 RPC·API 목록 — 이름 제안, 미구현

| 영역 | RPC/서버 작업 제안 | API 제안 |
|---|---|---|
| 서류 | esign_register_document / publish_document_version: 원본·필드·문구 고정 | 관리자 POST /api/admin/esign/documents, /versions/:id/publish |
| 대상 | 최신 신청/관리/참여/보관+scope 조회, 페이지 처리 | GET /api/admin/esign/targets |
| 요청 | esign_create_requests: 자격/연락처/버전/멱등/중복/감사를 원자 처리 | POST /api/admin/esign/requests |
| 조회 | scope 제한 목록·상세 | GET /api/admin/esign/requests, /:id |
| 취소·재발급 | esign_cancel_request / reissue_request: 세대·세션 폐기, 최신 상태 재확인 | POST /:id/cancel, /:id/reissue |
| 참가자 | 토큰 교환·인증 challenge·세션 검증 | POST /api/esign/access, /verify |
| 원문·제출 | 원문 권한 검증, esign_accept_submission 예약, PDF job 확정 | GET /api/esign/document, POST /api/esign/submit |
| PDF | 본인/관리자 권한 및 파일 ready 검증 | GET /api/esign/pdf, GET /api/admin/esign/requests/:id/pdf |
| 작업자 | esign_claim_pdf_job / finalize_pdf_job / fail_pdf_job / expire_requests | 일반 브라우저 공개 API 없음 |

모든 쓰기는 서버 입력 한도·형식·동일 출처/CSRF·속도 제한, 동작별 권한, 복합 식별자·버전 검증을 적용한다. 멱등 키+정규화 payload hash는 같은 트랜잭션으로 보장한다. 권한 거부·미존재·보류·중복·취소·만료·충돌·재시도 가능 오류를 구분하되 참가자에게 타인의 존재를 노출하지 않는다. 기존 개발 API를 운영에서 단순 활성화하지 않는다.

## 7. 적용 순서와 복구 계획 — 승인 후에만 실행

1. DB 담당자가 실제 schema/RLS/RPC/Storage 적용 목록과 백업·복구 권한을 확인한다. 동일 숫자 SQL 파일도 있어 파일 번호만 보고 일괄 실행하지 않는다.
2. 운영과 분리된 테스트 프로젝트·새 계정·키·가상 데이터·테스트 PDF를 승인한다. 운영 환경변수·개인정보를 복사하지 않는다.
3. 기존 이벤트/신청자 최소 schema 의존성을 검증하고 테스트 환경에만 필요한 순서대로 준비한다. 이번 문서에는 적용 명령이 없다.
4. 문서·버전·요청·감사·멱등 테이블을 의존 순서로 추가하고 즉시 기본 거부한다. 제한된 관리자 scope와 RPC를 함께 검토한다.
5. 제출·응답·토큰·세션·파일·작업 테이블을 추가한다. 버전↔파일 등 순환 FK는 테이블 생성 후 제약을 추가하는 순서로 설계한다.
6. 비공개 버킷·최소 정책·서버 adapter를 테스트 환경에만 연결한다. 정책의 정상/거부 사례와 다중 프로세스·동시 변경·실패 복구 시험을 통과시킨다.
7. 운영 적용은 별도 승인·배포 창·점검표·관찰 기간을 정하고, 전자서명 전용 활성화 설정을 기본 꺼짐으로 둔 뒤 순차 공개한다. SMS/OTP 연결은 별도 승인한다.

복구: 문제가 나면 신규 요청·작업자·발송을 중지하고 전자서명 기능을 비활성화한다. 이미 접수된 서명·완료 PDF·감사를 삭제하거나 기존 신청자 테이블을 되돌리지 않는다. 스키마 즉시 DROP보다 권한 회수·기능 차단·전진 수정으로 복구한다. 테스트의 폐기 가능한 데이터만 승인 후 정리한다. 실제 증적의 복원은 담당자의 승인된 백업·PITR 절차를 사용하되 파일과 DB의 복원 시점 불일치를 대조·정합성 확인한다. 복구 훈련 없이는 운영 전환하지 않는다.

## 8. 영향 범위·승인·15단계 권장 범위

충돌 위험: 공통 auth의 반환 타입 변경, 전체 앱 환경변수 교체, 신청자 뷰 수정, 기존 RPC 잠금 순서와 충돌, 수료증 버킷/정리 worker 재사용, 참가자 링크 경로의 proxy 인증 강제 여부. 신규 전자서명 전용 모듈·버킷·정책·API로 분리하고 기존 기능의 조회/저장·회귀 테스트를 유지한다. 이번 단계는 문서만 추가했다.

팀장/DB 담당자 승인 필요:
- 테스트 프로젝트·비용·담당자·키 취급·실제 schema/RLS 적용 현황.
- 관리자별 이벤트/문서 범위와 scope 부여·회수 주체.
- accepted/confirmed 조합, 합격 취소 근거, 보관·연락처 변경·재발급·재서명 정책.
- 개인정보 문구·필수/선택 구분, 인증 수단·OTP 업체·발신번호·비용.
- 원본/서명/동의/완료본/감사/백업 보관·파기·접근 로그 정책.
- RPC 트랜잭션·잠금 순서·Storage 보상 처리·운영 배포·복구 계획.

15단계에서 DB 연결 없이 먼저 할 수 있는 작업(별도 구현 승인 후):
1. 운영 DTO/매핑의 명시적 source·UUID·revision·archive 검증 및 가상 adapter 테스트.
2. 실제 세션 adapter용 공급자 인터페이스·기본 거부·이벤트 권한 테스트. 공통 인증은 변경하지 않음.
3. 다중 프로세스용 원자적 RPC 입력/결과 계약과 멱등 정규화, 취소/만료/재발급 상태 머신 시험.
4. 가상 파일 저장 adapter·durable job 계약, 업로드 성공/확정 실패·응답 유실·취소 경쟁·고아 객체 복구 시험.
5. 적용되지 않는 SQL/RLS/Storage 초안과 승인 체크리스트 보완. 실제 DB adapter 활성화·환경 생성은 제외.

운영 연결 전 통과 기준: 미승인 관리자·타 이벤트·타 참가자 접근 거부, 상태 변경 재검증, 선택 동의 거절 허용, 중복·동시 제출 차단, 원본 hash/버전 일치, 파일 실패 시 완료 금지, 확정 응답 유실 복구, 접근/파기 감사, 개발 인증·API 운영 차단.
