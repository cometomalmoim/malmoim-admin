# 수료증 자동 PDF 발급

작업 브랜치: `feat/events-yewon`. 운영 DB·Storage에 연결하거나 SQL을 적용하지 않았다.

## 실행과 가상 테스트

Node.js 22 이상에서 `npm ci` 후 `npm run dev`를 실행하고
`/preview/certificates`에 접속한다. 이 주소는 개발 모드에서만 제공된다.
Supabase 환경 변수와 로그인 없이 가상 32명, 동명이인, 가상 템플릿으로 확인할 수 있다.
macOS 파일 감시 제한이 있으면 `WATCHPACK_POLLING=true npm run dev -- --webpack`을 사용한다.

가상 모드는 브라우저에서 PDF/ZIP을 생성하며 발급 효력 없음 표시를 넣는다.
파일을 선택하지 않으면 가상 배경을 생성한다. 파일 선택 시에는 해당 배경으로 확인한다.
가상 설정은 브라우저 localStorage에 저장/불러올 수 있다. 파일은 저장하지 않고
가상 처리 기록은 새로고침하면 사라진다. 가상 재생성은 현재 설정을 사용한다.

실제 관리자 화면: `/admin/certificates`, `/admin/events/{slug}/certificates`.
항상 가상 모드로 시작하며 실제 모드는 명시적으로 전환한다.

## 실제 DB 적용 전 준비 (이번 작업에서 수행하지 않음)

1. 운영과 분리된 Supabase 테스트 프로젝트에 기존 이벤트·신청자·참여 이력 스키마를 준비한다.
2. `supabase/012_certificates.sql` 이후 `supabase/013_certificate_attendance.sql`을 검토하고 테스트 환경에만 순서대로 적용한다.
   다른 팀의 마이그레이션 번호와 충돌 여부도 확인한다.
3. 관리자/일반 사용자/익명 계정을 이용해 RLS, Storage, API 통합 테스트를 한다.
4. 테스트 프로젝트 URL과 publishable key를 설정한 환경에서만
   `CERTIFICATES_ENABLED=true`를 설정해 실제 모드를 검증한다.
5. 저장소에 포함된 폰트의 배포 패키지 포함 여부와 PDF·ZIP 응답 크기/시간 제한을 확인한다.
6. 운영 적용과 배포는 별도 승인된 작업으로 진행한다.

`certificate-templates`는 새 비공개 버킷이다. 기존 `admin-resources` 설정은 변경하지 않는다.
템플릿은 5MB 이하 PDF/PNG/JPG를 받는다. PDF는 회전 없는 단일 페이지만 지원하며,
손상·암호화·실행 콘텐츠를 거부한다. 이미지 최대 10000px/4000만 픽셀 제한이 있다.
이름이 비어 있는 템플릿을 사용해야 하며 기존 이름을 지우는 기능은 제공하지 않는다.
위치는 페이지 가로·세로 비율, 글씨 크기는 pt이며 y는 위에서 이름 기준선까지의 비율이다.
페이지 밖으로 나가는 이름은 자동 축소하지 않고 수정 안내를 표시한다.

## 데이터 및 권한

- `(event_id, source, application_id)`로 신청자를 구분한다. 이름으로 합치지 않는다.
- 500개 단위로 응답이 끝날 때까지 조회한다. 기존 신청자 목록 25명 제한을 재사용하지 않는다.
- 출석자를 먼저 표시하지만 합격/입금/참석만으로 자동 발급하지 않는다.
- 한 번에 1~100명을 관리자가 선택하고 확인 후 발급한다. 테스트 이벤트는 실제 발급에서 제외한다.
- 서버가 이름과 이벤트를 다시 조회하고 PDF를 생성한 뒤 RPC로 전체 발급 기록을 원자적으로 저장한다.
  기록 저장 실패 시 다운로드 응답을 보내지 않는다. 기록은 PDF 생성 이력이며 브라우저 수신 완료를 보장하지 않는다.
- RPC는 관리자 여부, 이벤트·신청자 소속, 이름 변경, 중복 요청 항목을 검사한다.
- 발급 당시 이름·이벤트 제목·식별자·시각·발급자·템플릿 ID를 저장한다.
- 설정 수정은 새 템플릿 버전으로 저장한다. 이전 원본/설정은 변경·삭제할 수 없다.
- 실제 재발급은 과거 이름과 과거 템플릿을 사용하고 원래 기록과 연결된 새 발급 기록을 남긴다.
- PDF를 Storage에 영구 보관하지 않는다. 재발급 결과는 동일 이름/디자인이며 바이너리 동일성은 보장하지 않는다.
- API와 데이터 조회 경계에서 관리자 권한을 재확인한다. POST는 same-origin 요청만 허용한다.
- 기본 비활성 상태의 수료증 API는 인증/DB 클라이언트 생성 전 503을 반환한다.

나눔고딕 전체 폰트를 포함하므로 기본 PDF 약 730KB, 32개 ZIP 약 23MB다.
사용할 호스팅의 응답 제한이 작으면 활성화 전에 비동기 발급/전용 다운로드 저장소 등 별도 설계가 필요하다.

## 폰트

Google Fonts의 NanumGothic Regular 원본 및 OFL 1.1 라이선스를 함께 포함했다.
`public/fonts/README.md`에 원본 URL과 SHA-256 검증 기록이 있다.
부분 폰트 포함은 실제 렌더링에서 글자 누락이 발생해 전체 폰트를 포함한다.
지원하지 않는 문자는 오류로 안내한다.

## 검증 명령

```sh
node --experimental-strip-types --test tests/*.test.mjs
npm run lint
npx next typegen
npx tsc --noEmit
npm run build -- --webpack
```

마이그레이션을 운영 연결 없이 재검증하려면:

```sh
npm install --prefix work/sql --cache ./work/npm-cache @electric-sql/pglite
node tests/certificates-db.mjs
```

PGlite 테스트는 auth·Storage·기존 테이블의 최소 모형 위에서 PostgreSQL SQL/RLS를 검증한다.
실제 Supabase Auth/Storage HTTP 연동을 대체하지 않는다.
`work/`는 Git 제외 대상이다. 테스트 PDF/ZIP/설치 캐시를 커밋하지 않는다.

## 이번 구현의 변경 파일

- UI: `src/components/admin/certificate-view.tsx`, `src/components/admin/certificates.css`
- 진입점: `src/components/admin/protected-admin.tsx`, `src/components/admin/event-view.tsx`, `src/app/preview/certificates/page.tsx`
- 생성·검증·조회: `src/lib/certificate-model.ts`, `src/lib/certificate-pdf.ts`, `src/lib/certificates.ts`
- API: `src/app/api/admin/certificates/route.ts`
- 마이그레이션: `supabase/012_certificates.sql`
- 테스트: `tests/certificates.test.mjs`, `tests/certificates-db.mjs`
- 폰트: `public/fonts/NanumGothic-Regular.ttf`, `public/fonts/OFL-NanumGothic.txt`, `public/fonts/README.md`
- 설정: `.env.example`, `.gitignore`, `package.json`, `package-lock.json`, `tsconfig.json`
- 이 문서: `docs/certificates.md`

기존 신청자·참여 이력·납부·환불·자료실 저장 로직은 수정하지 않았다.
기존 화면의 변경은 관리자 라우터 연결과 이벤트 화면의 수료증 링크 추가다.

## 검증 결과 (2026-10-16)

- 코드 테스트 32개 통과. 동명이인, 1032개 페이지 조회, PDF/PNG/JPG,
  한글·정렬·페이지 이탈, 32명 ZIP, 동일 출처 검증 포함.
- 메모리 PostgreSQL 마이그레이션/RPC/RLS 테스트 통과.
- ESLint 오류 0개, 기존 suggestions 액션의 미사용 인자 경고 2개 유지.
- Next route type 생성 후 TypeScript 통과.
- Webpack 프로덕션 빌드 통과. 기본 Turbopack 빌드는 환경의 파일 감시 문제로
  완료되지 않아 중단했다. Turbopack 개발 서버는 FSEvent 오류로 종료됐다.
- 폴링/Webpack 개발 서버에서 가상 화면 200, PDF 미리보기 및 동명이인 2명 ZIP 다운로드 확인.
- PDF를 PNG로 렌더링해 한글 이름/안내/가상 표시 확인. 부분 폰트 포함 시 글자 누락을
  발견해 전체 폰트 포함으로 수정 후 재검증했다.
- 실제 발급 기본 비활성 API는 503. 프로덕션에서 개발 전용 가상 페이지는 404.
- 실제 테스트 Supabase Auth/Storage HTTP 통합, 대량 발급 호스팅 제한 검증은 미완료.
- 기존 Desktop worktree(125개 파일) 및 다른 worktree(175개 파일)의 파일 해시,
  미커밋/스테이징 상태, 브랜치·HEAD가 기존 스냅샷과 동일하다.
- 운영 DB/Storage 연결·변경, 커밋, Push, PR, main 병합, 배포는 수행하지 않았다.

## 로컬 Supabase 연결

전용 worktree의 Git 제외 `.env.local`에만 다음 값을 둔다.

```dotenv
SUPABASE_LOCAL_TEST=true
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<로컬 CLI에서 확인한 publishable key>
CERTIFICATES_ENABLED=false
```

설치된 로컬 CLI의 `status --output json` 결과에서 `PUBLISHABLE_KEY`만 사용한다.
CLI는 반드시 로컬 설치 경로, `--workdir`, `SUPABASE_HOME`을 지정해 사용하며,
전체 status 결과는 비밀 키를 포함하므로 터미널·보고서에 출력하지 않는다.
`SECRET_KEY`, `SERVICE_ROLE_KEY`는 앱 설정에 필요 없으며 `NEXT_PUBLIC_`에 넣지 않는다.

`npm run dev`의 개발 모드에서 플래그가 정확히 `true`일 때만 위 URL을 허용한다.
끝의 `/` 하나는 허용한다. 클라우드 URL, localhost, 다른 IP·포트·경로 및
URL 사용자 정보·쿼리·프래그먼트는 거부한다. 플래그가 없거나 false이면 기존 HTTPS 및
publishable key 검증이 적용된다. 운영·테스트 모드에서는 플래그 true 자체를 거부한다.
운영 빌드·실행에는 이 로컬 설정을 사용하지 않는다.

이 설정은 앱 전체의 Supabase 연결에 적용된다. 로그인, 관리자 확인, RLS 및
운영 쿠키 보안 설정은 유지된다. 로컬에 준비되지 않은 기능의 스키마 오류를
운영 연결로 우회하지 않는다. 수료증 활성화는 인증 확인 후 별도 단계로 진행한다.
로컬 앱은 아직 실행하지 않았으며 발급도 수행하지 않았다.

## 출석자 전용 발급 및 동시성 검증 (2026-10-16)

- 화면은 `attendance=attended`만 선택 가능하다. 결석·미기록·노쇼는 선택 불가다.
  목록을 갱신하면 선택에서 부적격자를 제거하고 수료 확인 체크를 해제한다.
  실제 모드에서는 창 포커스 복귀 및 15초 간격으로 갱신하며, 갱신 실패 시 선택을 비운다.
- API는 개별·일괄·재발급 전 DB에서 현재 상태를 조회한다. 재발급도 현재 출석자만
  가능하며, 이름과 템플릿은 과거 발급 당시 스냅샷을 유지한다. 미리보기는 발급 기록이 없다.
- 최종 기준은 발급 기록 트랜잭션이다. 신규 `013`은 이벤트를 UUID 순으로 먼저
  `FOR SHARE` 잠그고 참여 이력을 같은 식별자로 확인·잠근다. 기존 출석 변경 함수는
  이벤트 `FOR UPDATE` 후 참여 이력을 수정하므로 같은 순서로 직렬화된다.
  한 명이라도 출석자가 아니거나 참여 행이 없으면 전체 기록을 롤백하고 파일을 응답하지 않는다.
- 발급 완료 이후 출석 수정은 가능하며 이미 저장된 발급 기록은 보존한다.
  SQL 실패 후 무조건 재요청하지 말고 기록을 확인한다.
- 기존 `001`~`012` SQL, 참여 이력 함수와 Storage 설정은 변경하지 않는다.
  운영 적용은 별도 작업이며 이번에는 `127.0.0.1:54322`에만 `013`을 적용했다.

로컬 32명(출석20/결석6/미기록6)으로 개별·혼합 일괄·재발급의 API 및 인증된 직접
RPC 거부, 서로 다른 연결의 실제 잠금 대기와 두 실행 순서, 동명이인 식별,
한글 PDF 및 20명 ZIP을 검증했다. 테스트에서 바꾼 출석 상태는 원래 인원 구성으로
복원했다. 비활성 상태를 복원한 후 실행 서버의 수료증 API HTTP 503을 확인했다.
브라우저 직접 조작은 수행하지 않았으며 체크박스 상태는 실제 컴포넌트 렌더링 테스트로 검증한다.

최종 검증: 코드 자동화 테스트 90개, 메모리 PostgreSQL SQL/RLS 테스트,
TypeScript 검사 통과. ESLint 오류 0개(기존 suggestions 경고 2개).
실제 HTTP 일괄 요청에서도 출석 상태의 이전 값을 읽은 뒤 PDF를 생성하고,
최종 DB 잠금에서 대기하는 동안 결석 변경을 확정하면 HTTP 409와 추가 기록 0건을 확인했다.
이번 정상 발급 테스트의 추가 기록은 23건(동시성 1 + 개별 1 + 재발급 1 + ZIP 20)이다.
