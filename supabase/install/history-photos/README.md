# 활동 사진 설치 검토 패키지 — 운영 실행 미승인

이 패키지는 실행 금지 통합 초안을 사용하지 않는다. 현재 실제 브로커가
호출하는 함수 정의만 추출하고 설치 순서·소유권·ACL·Storage 정책을 새로
구성했다. **운영 설치본이나 운영 인증 준비 완료를 뜻하지 않는다.**
로컬 실행기는 신규 패키지 시험 프로젝트와 59421/59422 또는 60421/60422만
허용한다. 기존 54322/55422/56422/57422/58422는 거부한다.

## 파일과 순서

1. `objects.json`, `storage-policies.json`: 검토할 객체·함수 소유자·역할별 EXECUTE와 정책 조건.
2. `001_install.review.sql`: 4개 전용 스키마, 테이블 11개, 함수 23개,
   역할 9개, 비공개 버킷 2개, Storage 정책 5개. 기존 auth/storage 테이블은
   새로 만들거나 ALTER하지 않는다. 신규 정책/버킷/ACL만 추가한다.
3. `002_verify.read-only.sql`: 읽기 전용 트랜잭션에서 필수 객체, 함수 본문,
   소유자/search_path/SECURITY DEFINER/EXECUTE, RLS, 직접 테이블 권한,
   역할 속성·멤버십, 버킷 제한, 정책 역할/명령/조건을 검사하고 불일치 시 실패.
4. `install-local.cjs`: 컨테이너 ID/포트/볼륨·파일 해시 확인 후 설치한다.
   검증 DO 블록도 **설치 트랜잭션 안에** 실행하므로 실패하면 DDL이 롤백된다.
   이미 설치됐으면 DDL·GRANT·데이터 쓰기 없이 읽기 전용 검증만 한다.
5. `test-clean-lab.cjs`, `audit-local.cjs`: 실제 HTTPS 및 권한/경계 시험.
   원본 브로커의 실행기·어댑터·모듈을 재사용하며 로컬 대상 상수만 명시적으로
   바꾼다. UI나 공용 로그인 코드는 사용/수정하지 않는다.
6. `manifest.json`: 전달 파일 SHA-256. 설치기는 일치하지 않으면 거부한다.

실제 검증 버전은 PostgreSQL 17.11 / Storage v1.82.1이다. 로컬 실행기는
Storage v1.82.1 이미지를 확인하며 다른 버전은 별도 검토가 필요하다.
설치 전제: PostgreSQL 17, Storage의 operation 정책 helper, RLS 활성화,
기존 public.admin_users(user_id uuid)와 정상 getUser() 인증. 설치 역할은
postgres이며 CREATEROLE/BYPASSRLS 및 Storage 정책 DDL 허용이 필요하다.
운영에서 같다고 가정하지 않는다. 기존 사진 관련 이름이나 Storage 정책이
있으면 덮어쓰지 않고 중단한다. 자동 기존 정책 병합은 하지 않는다.

## 깨끗한 로컬 재현

기존 포트가 사용 중이면 재시작/삭제하지 말고 중단한다. 새 프로젝트의
Supabase 기본 임시 키와 시험 계정/역할 비밀번호만 생성한다. 실제 .env는
읽거나 변경하지 않는다. 명령에는 비밀값을 넣지 않는다.

```sh
node supabase/install/history-photos/create-clean-lab.cjs 60421
# 위 명령이 출력한 새 root 사용
node supabase/install/history-photos/test-clean-lab.cjs /private/tmp/malmoim-photo-package-XXXXXX
node supabase/install/history-photos/audit-local.cjs /private/tmp/malmoim-photo-package-XXXXXX
node supabase/install/history-photos/install-local.cjs /private/tmp/malmoim-photo-package-XXXXXX
```

서비스 실행은 `services/history-photo-broker/README.md` 참조. 이 패키지의
로컬 어댑터는 Docker/psql 및 로컬 HS256 발급자를 사용하므로 배포하지 않는다.
시험 TLS 키, DB 로그인 비밀번호, 시험 관리자 계정은 새 root의 소유자 전용
파일에만 저장된다. 초기 Auth 계정 생성에만 fixture 권한을 사용하며 브로커
DB/Storage 정상 작업에는 service_role을 전달하지 않는다.
과거 환경이나 서버를 멈추지 않는다. 실행 결과/기록과 신규 객체는 보존한다.

## 권한 경계

- authenticated: 기존 getUser/admin_users 세션으로 관리자 RPC 3개만 실행.
  일반 회원은 함수 내부에서 다시 거부한다. 전달된 user_id는 신뢰하지 않는다.
- attestor: 작업 조회·경로 capability·실제 파일 영수증 발급만.
- worker: 일회용 영수증 소비/확정 RPC 하나만. 테이블 직접 접근·관리자 RPC·소유자 역할 전환 금지.
- reader: 공개 스냅샷/메타데이터/capability만. 비공개에서는 URL 미발급.
- Storage issuer: 예약된 임시 경로의 signed upload 허가만.
- Storage finalizer: 해당 임시 경로 읽기, 정확한 불변 확정 경로 INSERT/읽기만.
- Storage public reader: 현재 공개 스냅샷의 확정 경로 SELECT만.
- 역할 모두 NOSUPERUSER/NOBYPASSRLS/NOCREATEROLE/NOINHERIT. 소유자는 NOLOGIN.
  설치 시 임시 소유자 멤버십/CREATE는 트랜잭션 종료 전에 회수한다.
- 일부 고정 helper는 검증된 기존 구조대로 postgres 소유다. 본문·EXECUTE를
  고정 검증하지만 **운영에서는 이 소유자의 넓은 권한도 보스 보안 검토 대상**이다.
  runtime 역할에 그 권한이나 멤버십을 부여하지 않는다.

사진 10장, 개별 4,718,592바이트, 합계 47,185,920바이트를 DB/버킷/서버에서
검사한다. 공개 URL TTL 60초는 브로커가 강제한다. Storage 자체는 발급자에게
더 긴 TTL을 금지하지 못하므로 제한 토큰/읽기 자격증명을 클라이언트에 주면 안 된다.
기존 signed URL은 비공개 전환 뒤에도 만료 전까지 유효할 수 있다.
임시 업로드 종료는 증명하지 않으며 확정 경로의 별도 불변 저장으로 격리한다.
실제 파일 삭제·자동 정리는 포함하지 않는다.

## 실패·복구 및 보스 결정

- 사전 백업: 기존 관리자 인증 구조/역할/정책 카탈로그와 DB 백업, Storage
  객체 목록을 별도로 보존한다. 이 패키지는 자동 백업/자동 복원을 수행하지 않는다.
- 설치 실패: 연결 종료/예외 시 트랜잭션 롤백. 부분 객체를 자동 삭제하지 않는다.
- 재설치 검증 실패: DDL로 덮어쓰거나 GRANT를 넓히지 말고 브로커 시작을 중단한다.
- 설치 후 문제: 해당 새 서비스만 연결 차단하고 DB/Storage 기록을 보존한다.
  파일과 테이블을 일괄 DROP/DELETE하는 롤백 명령은 제공하지 않는다.
  데이터가 생겼다면 의존성·영수증·파일 상태를 확인한 별도 승인 복구가 필요하다.
- 운영 결정: 실제 Vercel issuer/JWKS/audience/project/environment,
  브로커 호스팅/TLS/리전/연결 풀, 제한 DB 자격증명 보관·갱신,
  Storage 제한 토큰 발급 주체/키 관리, 운영 admin_users 호환성,
  기존 Storage 정책과 충돌, helper 소유권을 확인해야 한다.
- 기존 연결 변수 이름은 HISTORY_PHOTO_WORKER_DATABASE_URL,
  HISTORY_PHOTO_BROKER_ORIGIN, HISTORY_PHOTO_BROKER_AUDIENCE. 보스가 비밀 관리
  시스템에서 설정할 대상이며 이번 작업에서는 설정하지 않는다. 변수만 넣어도
  운영 기능이 켜지지 않으며 조립 adapter는 구현됐지만 실제 운영 bootstrap/OIDC/token issuer 주입은 미완성이다.

첫 59421/59422 설치 시험에서 권한/검증 경계 오류를 발견해 보완했다. 해당 새
시험 환경도 삭제하지 않았다. 수정된 설치 SQL은 기존 사진 객체가 전혀 없는
두 번째 신규 60421/60422 환경에 **한 트랜잭션으로 실제 설치·검증**했다.
운영 Supabase/Vercel 및 기존 환경에는 적용하지 않았다.

## 최신 overlay를 포함한 전달 순서

검토 순서는 **001 → 002 → 003 → 004 → 005 → 006 → 007 → 008**이다.
- `owner-hardening/003_owner-hardening.review.sql` 및 `004_verify.read-only.sql`:
  helper 7개를 최소 권한 NOLOGIN 소유자로 전환한다. postgres 소유 helper 6개는
  `owner-hardening/contract.json`에 남아 있으며 운영 보안 검토 대상이다.
- `receipt-lookup/005_receipt-lookup.review.sql` 및 `006_verify.read-only.sql`:
  최소 권한 attestor 조회와 잠금 후 5분 만료 확인을 포함한다.
- `receipt-generations/007_generations.local-approved.sql` 및 `008_verify.read-only.sql`:
  기존 영수증을 보존하고 명시적 재다운로드·디코딩·해시/권한 재검증 후 새 세대를 연결한다.
  기존 영수증 수명 연장·자동 재발급은 하지 않는다.

최신 검증 대상은 테이블 12개·함수 27개·역할 11개이며 Storage 정책 5개는 유지한다.
`objects.json`은 최초 baseline 목록이다. 최신 전체 카탈로그는 overlay 계약과 008까지 확인한다.
최초 `install-local.cjs` 실행은 001/002만 적용한다. 기존 설치에서는 감지된 overlay에
맞는 검증기를 선택하지만 overlay를 자동 설치하지 않는다. 각 단계의 검증을 생략하지 않는다.
로컬 apply/검증 스크립트와 대상 고정 SQL은 운영 실행기로 사용할 수 없다.
운영용 대상 검사·프로비저닝·적용 실행기는 별도 검토/승인 필요하다.

브로커 조립 코드와 모의 HTTPS 검증은 완료됐지만 실제 운영 의존성은 미주입이다.
실제 Vercel OIDC, 제한 토큰 발급자/키 회전·영속 재사용 방지, 역할별 로그인 자격증명,
TLS·풀러·호스팅을 확정해야 한다. 상세 인수인계는
`supabase/drafts/HISTORY-PHOTO-VERCEL-HANDOFF.md` 참조.
이번 문서 갱신은 DB 설치·재시험·운영 승인을 수행하지 않았다.
