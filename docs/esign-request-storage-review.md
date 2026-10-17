# 9단계 요청 저장: 검토 전용 SQL 초안 (미실행)

운영/테스트 DB 접속, SQL 실행, 마이그레이션 등록, Storage 생성 없음. 아래는 배포 가능한 완성 마이그레이션이 아닌 담당자 검토용 설계다. 기존 supabase/*.sql은 변경하지 않는다.

## 코드와 경계

- `esign-request-repository.ts`: 비동기 transaction/list/get 인터페이스. 트랜잭션은 요청과 멱등 결과를 함께 저장한다. 메모리 adapter는 복제본에서 작업하고 성공 시에만 반영, 직렬화 큐로 중복 경쟁 방지. 완료 기록 덮어쓰기 금지.
- `esign-request-service.ts`: 기존 8단계 서버 검증을 재사용하고 저장 adapter와 연결. list/detail/cancel/expire 및 이력·재발급 가능 여부 제공. 요청 생성은 서버가 가진 신청자 상태를 검사한다.
- 개발 API는 development+로컬 동일 출처+명시적 가상 관리자 역할만 허용한다. 이 역할/탭 식별자는 실제 인증이 아니다. 50개 테스트 세션 상한. 실제 DB adapter는 아직 없으며 향후 별도 승인 후 구현한다.
- 요청은 서버 메모리에만 저장한다. UI의 sessionStorage에는 탭 식별자만 있고 요청/개인정보/인증 토큰은 없다. 새로고침 후 역할 재선택 시 서버 목록 재조회. 서버 재시작·개발 HMR 모듈 교체 시 모두 사라질 수 있다. 영구 저장이 아니며 다중 프로세스 공유도 안 된다.
- 브라우저 전용 가상 상태 시험은 서버 기록을 변경하지 않는다. 서버 시험 버튼은 별도 표시. 완료 PDF, 실제 문자·링크·OTP는 없다.

## 검토용 SQL

모든 외래 키의 실제 대상 존재·타입·적용된 RLS는 DB 담당자가 별도로 확인해야 한다. 다음 SQL은 실행하지 않는다.

```sql
create table public.esign_documents (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(btrim(name)) between 1 and 100),
 status text not null default 'active' check(status in ('active','archived')),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.esign_document_versions (
 id uuid primary key default gen_random_uuid(),
 document_id uuid not null references public.esign_documents(id),
 version_no integer not null check(version_no>0),
 status text not null check(status in ('draft','published','retired')),
 original_path text, original_sha256 text,
 field_settings jsonb not null,
 consent_snapshot jsonb not null,
 created_by uuid not null references auth.users(id),
 published_by uuid references auth.users(id), published_at timestamptz,
 created_at timestamptz not null default now(),
 unique(document_id,version_no), unique(document_id,id),
 check(original_sha256 is null or original_sha256 ~ '^[0-9a-f]{64}$'),
 check(status='draft' or (original_path is not null and original_sha256 is not null
   and published_by is not null and published_at is not null))
);
create table public.esign_requests (
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.recruitment_events(id),
 source text not null check(source in ('season9','registration','manual')),
 application_id uuid not null,
 document_id uuid not null references public.esign_documents(id),
 version_id uuid not null,
 cycle integer not null default 1 check(cycle>0),
 status text not null default 'pending'
   check(status in ('pending','processing','completed','declined','expired','cancelled')),
 applicant_snapshot jsonb not null, -- approved minimal fields; contact encrypted separately
 application_revision integer not null check(application_revision>=0),
 participation_revision integer check(participation_revision>=0),
 generation integer not null default 1 check(generation>0),
 revision integer not null default 1 check(revision>0),
 idempotency_key uuid not null, batch_payload_sha256 text not null,
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(), expires_at timestamptz not null,
 completed_at timestamptz, cancelled_at timestamptz, cancel_reason text,
 foreign key(document_id,version_id)
   references public.esign_document_versions(document_id,id),
 unique(event_id,source,application_id,document_id,cycle),
 unique(created_by,idempotency_key,event_id,source,application_id),
 check(expires_at>created_at),
 check(batch_payload_sha256 ~ '^[0-9a-f]{64}$'),
 check((status='completed')=(completed_at is not null)),
 check(status<>'cancelled' or (cancelled_at is not null and cancel_reason is not null))
);
create table public.esign_audit_events (
 id uuid primary key default gen_random_uuid(),
 request_id uuid references public.esign_requests(id),
 document_id uuid references public.esign_documents(id),
 actor_user_id uuid references auth.users(id),
 actor_kind text not null check(actor_kind in ('admin','participant','worker')),
 action text not null, previous_status text, current_status text,
 reason_code text, operation_id uuid not null,
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 check(request_id is not null or document_id is not null)
);
create index esign_requests_event_status on public.esign_requests(event_id,status,created_at desc,id);
create index esign_requests_applicant on public.esign_requests(event_id,source,application_id);
create index esign_requests_expiry on public.esign_requests(expires_at) where status='pending';
create index esign_requests_batch on public.esign_requests(created_by,idempotency_key);
create index esign_audit_request on public.esign_audit_events(request_id,created_at,id);
create index esign_versions_document on public.esign_document_versions(document_id,status);

alter table public.esign_documents enable row level security;
alter table public.esign_documents force row level security;
alter table public.esign_document_versions enable row level security;
alter table public.esign_document_versions force row level security;
alter table public.esign_requests enable row level security;
alter table public.esign_requests force row level security;
alter table public.esign_audit_events enable row level security;
alter table public.esign_audit_events force row level security;
revoke all on public.esign_documents,public.esign_document_versions,
 public.esign_requests,public.esign_audit_events from public,anon,authenticated;
-- No policies/grants yet: default deny, including authenticated admins.
-- After approval: limited admin/event-scope SELECT; writes only through reviewed server/RPC.
```

## SQL 외에 보장해야 할 사항

- 통합 신청자 목록은 뷰라 FK를 걸 수 없다. source별 실제 원본의 `(event_id,source,application_id)` 소속을 서버에서 검증한다. 신청자 테이블은 변경하지 않는다. 관리 상태와 참여 revision을 동일 잠금 순서로 재검증한다.
- 위 네 테이블은 초기 요청 관리용 초안이다. 동의 항목/제출/파일/작업/토큰 테이블은 별도 승인 후 확장한다. original_path는 이번에 Storage 접근이나 파일 저장을 수행했다는 뜻이 아니다.
- 게시된 버전의 원본/좌표/동의 문구 변경, 완료 요청 덮어쓰기, 감사 UPDATE/DELETE를 서버/RPC와 제한된 DB 역할로 금지해야 한다. CHECK만으로 전후 상태 전이를 검증할 수 없으므로 별도 검토된 함수/트리거가 필요하다. 이번 문서에는 실행 함수가 없다.
- 원자적 요청 생성 함수는 관리자·이벤트 권한·최신 선정 정책·연락처·게시 버전을 확인하고 요청/감사/멱등 결과를 함께 기록해야 한다. RLS 우회 service 권한 사용 시에도 별도 서버 검증이 필요하다.
- 멱등 배치: `(actor,idempotency_key)` 잠금 후 정규화된 payload hash를 비교한다. 같은 키+다른 payload는 거부한다. 위 UNIQUE만으로 서로 다른 대상 집합의 키 재사용을 막을 수 없으므로 별도 ledger 테이블 또는 트랜잭션 advisory lock+기존 배치 조회가 필요하다. 실패/빈 배치까지 멱등 처리하려면 별도 ledger가 권장된다. 메모리 adapter는 멱등 결과를 트랜잭션 내 map으로 보관한다.
- 현재 미리보기는 동일 문서에 기존 이력이 있으면 버전과 무관하게 새 생성 차단. cycle 증가 및 재서명은 아직 허용하지 않는다. 취소/만료의 재발급 가능 판정은 ‘최신 자격/연락처 재검토 필요’일 뿐 실제 재발급 승인이 아니다. 완료는 재발급 불가.
- 만료는 서버 시각으로 조회/작업 시 처리하고 이력은 1회만 추가한다. 운영은 별도 worker 필요. 취소/만료 기록과 완료 기록의 보관·파기 정책은 별도 승인해야 한다.
- 관리자별 이벤트 범위/문서 범위 데이터는 기존 DB에서 미확인이다. 위 초안은 모든 접근 기본 거부이며, 담당자 승인 전 관리자 SELECT 정책도 열지 않는다.

## 테스트 DB 연결 전 승인

테스트 프로젝트·신규 키·비용, 실제 기존 schema/RLS와 migration 순서, 이벤트 관리자 권한, 선정 조합 정책, 취소·재발급·cycle, 멱등 ledger, 보관·파기, 작업자/서비스 역할을 승인받아야 한다. 운영 환경변수/실제 개인정보 복사 금지. SQL은 docs의 fenced block에만 있으며 실행용 migration 폴더에 등록하지 않았다.
