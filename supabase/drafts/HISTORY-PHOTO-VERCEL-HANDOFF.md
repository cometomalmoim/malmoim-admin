# 활동 히스토리 사진 — 최종 인수인계 (2026-10-23)

**운영 연결·배포 미승인 / 기능 비활성.** 이 문서는 최신 조립 코드 기준이다.
전체 879개 테스트, TypeScript·브로커 빌드 통과, lint 오류 0·기존 경고 2는
직전 검증 결과이며 이번 문서 정리에서 재실행하지 않았다.

## 전달 파일과 검증 수준

| 범위 | 구현 / 검증 | 남은 경계 |
| --- | --- | --- |
| 관리자 등록·확정·대표/순서·공개/비공개, 사용자 /history·슬라이드 | 독립 로컬 DB/Storage와 실제 브라우저 검증 | 운영 UI/인증 연결은 비활성 |
| HTTPS 브로커·제한 DB·Storage·영수증·복구 | 독립 환경 실제 호출 검증 | 실제 운영 연결 없음 |
| createPorts 조립·종료·실패 처리 | 모의 포트 + 실제 로컬 HTTPS/자식 프로세스 시험 | 운영 의존성 bootstrap 미주입 |
| Vercel OIDC 전송 / JWT·JWKS 검증 | SDK 및 로컬 모의 발급자 검증 | 실제 Vercel 토큰·프로젝트 설정 미검증 |
| 제한 Storage 토큰 발급 어댑터 | 모의 발급자·서명/범위/회전 거부 시험 | 운영 발급자·신뢰 키·재사용 저장소 미연결 |
| 설치 패키지·owner-hardening·세대 복구 | 깨끗한 독립 설치 및 후속 overlay 실제 검증 | 운영 카탈로그·TLS·권한 미검증 |

주요 전달 파일:
- `services/history-photo-broker/README.md`, `main.cjs`, `runtime.cjs`, `build.cjs`, `operational-adapter.cjs`.
- `src/lib/history-activities/broker-composition.ts`, `service-handler.ts`, `broker-oidc.ts`, `broker-https.ts`.
- 같은 디렉터리의 `vercel-connection.ts`, `vercel-oidc-transport.ts`, `vercel-admin-session.ts`,
  `postgres-worker.ts`, `server-db.ts`, `server-receipts.ts`, `receipt-generations.ts`,
  `verified-finalization.ts`, `limited-storage.ts`, `storage-token-issuer.ts`와 관련 테스트.
- `services/history-photo-broker/postgres-driver.cjs`, `receipt-source.cjs`, `generation-source.cjs`, `vercel-token.cjs`.
- `supabase/install/history-photos/` 전체 패키지·manifest·overlay·검증 SQL.

브라우저는 예약한 임시 경로에 직접 업로드한다. 서버는 실제 다운로드·디코딩·크기/형식/해시 검증,
별도 불변 확정 저장·재다운로드 해시 확인, 일회용 영수증, 제한 worker 확정을 수행한다.
최대 10장·개별 4,718,592바이트·총 47,185,920바이트. 공개는 현재 공개 스냅샷의
확정 사진만 대상으로 읽기 URL을 최대 60초 발급한다. 임시 업로드의 모든 요청 종료는
증명하지 못하며 늦은 쓰기는 임시 영역에 격리한다. 실제 삭제는 지원하지 않는다.

## 운영 bootstrap에서 주입할 사항

`operational-adapter.cjs`는 `createOperationalPhotoBroker(dependencies)`를 재사용한다.
현재 `main.cjs`는 adapter에 modules/configPath만 전달한다. 따라서 adapter 선택이나
환경변수 설정만으로 실제 기능이 켜지지 않는다. 신뢰된 운영 wrapper가 아래 의존성을
명시적으로 만들어 주입해야 한다. 미설정·인증 실패는 차단하며 로컬 발급자로 대체하지 않는다.

- **워크로드:** 실제 Vercel issuer/JWKS/audience/project/owner/environment/subject,
  RS256·발급/만료/not-before 검증. SDK `@vercel/oidc@4.0.2`의 서버 요청별 토큰 획득.
  현재 Vercel 어댑터의 probe/관리자 경계 검사와 전체 /v1 작업 전송 연결은 구분한다.
- **관리자:** 기존 공용 getUser()/admin_users 검사를 변경 없이 재사용하는 독립 어댑터.
  OIDC는 서버 주체만 증명한다. 브라우저 user_id/role/영수증을 신뢰하지 않는다.
- **DB:** 역할별 별도 서버 자격증명, 실제 로그인/ACL 감사, 검증 TLS·CA·호스트,
  Supabase transaction pooler와 연결 한도/리전. worker는 `photo_finish_worker`의
  `photo_finish_v2.commit(jsonb)`만 실행한다. 입력은 jobId/requestId/revision/receiptId/seal.
  기본 설치 역할은 NOLOGIN이며 로그인 프로비저닝·회전은 별도 승인 대상이다.
- **영수증:** 최소 권한 attestor 조회·발급과 실제 파일 검증 연결. 세대 복구는 명시적 서버
  revalidateGeneration/resumeGeneration 작업이며 HTTP recover가 자동 재발급하지 않는다.
- **Storage 발급자:** HTTPS 서버 간 인증, 신뢰된 응답 서명 키/JWKS·회전,
  DB capability 원자 등록과 영속 재사용 방지. 임시 허가/확정 신규 저장/공개 읽기 역할 분리.
  발급 자격증명 상한 120초와 공개 URL 60초, signed upload 허가 수명은 서로 다르다.
  마스터 서명키를 Next.js에 넣거나 service_role로 우회하지 않는다.
- **실행:** Node.js 22+, TLS 인증서/갱신·비밀 보관, HTTPS agent/DB pool 종료,
  감독·상태 점검·rate limit·리소스/요청 timeout. 응답 유실은 불확실 상태이며 자동 재전송 금지.

설정 이름(값 없음): `HISTORY_PHOTO_WORKER_DATABASE_URL`, `HISTORY_PHOTO_BROKER_ORIGIN`,
`HISTORY_PHOTO_BROKER_AUDIENCE`. 현재 자동 env 로딩/활성화 스위치가 아니다.
기존 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`는 공용 인증 담당과 확인한다.
attestor/reader/발급자/TLS의 추가 비밀 이름·주입 방식은 보스/인프라 담당이 확정한다.
현재 127.0.0.1:3004 개발 경로·Unix 소켓 연결을 운영 연결로 간주하지 않는다.

## 설치 및 보안 검토 순서

1. 대상 식별, 백업/객체 목록, 기존 admin_users·정책·default ACL·Storage 버전/권한 충돌 확인.
2. `001_install.review.sql` → `002_verify.read-only.sql`.
3. `owner-hardening/003_owner-hardening.review.sql` → `004_verify.read-only.sql`.
4. `receipt-lookup/005_receipt-lookup.review.sql` → `006_verify.read-only.sql`.
5. `receipt-generations/007_generations.local-approved.sql` → `008_verify.read-only.sql`.

이는 **검토할 의존 순서**이며 운영 실행 승인이 아니다. 로컬 실행기/SQL 대상 검사는 로컬 전용이다.
`install-local.cjs`의 최초 설치는 001/002만 수행하므로 overlay를 자동 포함한다고 가정하지 않는다.
objects.json은 baseline 목록이고 최신 전체 상태는 overlay 계약과 008 검증까지 함께 본다.
기존 NOT-FOR-EXECUTION 초안을 실행하거나 운영 migration으로 그대로 사용하지 않는다.
실패 시 중단·트랜잭션 롤백, 설치 후 문제는 서비스 연결 차단·기록 보존 후 별도 승인 복구.
DROP/DELETE나 광범위 GRANT로 복구하지 않는다.

owner-hardening 후에도 postgres 소유 SECURITY DEFINER 6개가 남는다:
- `photo_finish_v2.actor()` / `photo_finish_v2.admin(uuid)`
- `photo_scope_v3.current_actor()` / `photo_scope_v3.allowed(text,text)`
- `photo_service_v4.actor()` / `scope_private.allowed(text,text)`

고정 search_path·EXECUTE 검증만으로 소유자의 넓은 권한/RLS 우회 위험이 사라지지 않는다.
실제 본문·호출 관계·공유 인증 참조를 검토하고 제한 소유자 전환 또는 위험 수용을 보스가 결정한다.
공유 auth/storage/admin_users 권한을 임의로 변경하지 않는다.

## Git 공유 범위 — 작성자 확정 아님

현재 브랜치는 `feat/website-yejin`이며 미커밋 변경이 섞여 있다. Git 상태만으로 다른 팀원의
작성 여부를 확정할 수 없어 다음은 **경로별 검토 분류**다. 브랜치 이동·커밋·push는 수행하지 않는다.

| 분류 | 경로 | 공유 방법 |
| --- | --- | --- |
| 사진 전용 후보 | services/history-photo-broker/**, src/lib/history-activities/**, src/app/admin/history-photos/**, src/app/api/admin/history/**, src/app/photo-management-preview/**, 사진 전용 drafts/install/tests | 파일별 검토 목록으로 공유; 로컬 실험 어댑터/SQL과 운영 후보 분리 |
| 공용 통합 변경 | /history 페이지·갤러리·슬라이드·manage-preview, src/app/admin/history/**, src/components/admin/admin-view.tsx, package.json/lock, eslint.config.mjs | 기존 변경과 사진 변경 hunk를 팀원과 대조; 파일 전체 덮어쓰기 금지 |
| 소유자 별도 확인 / 기본 제외 | auth/login, actions/auth.ts, member-login 컴포넌트, supabase/server.ts, proxy.ts, 후기 관련 TS/SQL/참가 승인 시험, about/hero 이미지, Supabase 로컬 설정 | 기존/타 작업이 포함될 수 있음. 담당자 확인 없이 사진 패키지에 일괄 포함하지 않음 |

`services/`·`supabase/local/`·`supabase/tests/static/` 전체를 사진 운영 코드라고 일괄 선택하지 않는다.
안전한 공유는 명시적 파일 allowlist와 공용 파일의 검토된 diff로 구성한다. 설치 패키지는
manifest/overlay와 함께 전달하고 로컬 전용 파일은 표시한다. `git add .`나 작업 폴더 전체 압축은 피한다.
.env, .vercel, node_modules, .next, 개인 설정, 로그, 임시 fixture, 인증서/개인키/토큰은 제외한다.
실제 staging/커밋/공유 파일 생성은 별도 요청 후 진행한다.

## 보스 최종 체크리스트

- [ ] 실제 Vercel OIDC claims/JWKS와 별도 관리자 검증 책임 확정·실제 토큰 거부 시험.
- [ ] 브로커 호스팅/TLS/리전/종료·관측 및 Storage 발급자/키 회전/재사용 방지 확정.
- [ ] DB 역할별 자격증명·TLS·풀러 및 6개 postgres helper 소유권 검토.
- [ ] 001~008과 실제 운영 카탈로그 충돌 검토·최소 권한 허용/거부 시험.
- [ ] bootstrap 의존성·Vercel 전체 작업 전송·공용 인증 연결을 검토 후 별도 구현/승인.
- [ ] 공개/비공개·권한 회수·CAS·응답 유실·재시작·세대 복구의 실제 운영 상당 환경 시험.

이미 발급된 읽기/업로드 URL의 즉시 회수는 보장하지 않는다. 운영 활성화·배포는 별도 승인이다.

보스에게 전달할 설명:
> 활동 사진 UI와 HTTPS/DB/Storage/영수증·복구는 독립 환경에서 검증했습니다.
> 운영 조립 계층은 모의 포트로 시험했으며 실제 Vercel OIDC·Storage 발급자·DB 자격증명은 미연결입니다.
> 첨부 설치 패키지의 001~008, 남은 postgres helper 6개, bootstrap 인증·비밀 관리 결정을 검토해 주세요.
> 현재 운영 기능은 비활성이고, 승인 전 운영 접근·적용·배포는 하지 않습니다.
