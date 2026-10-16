# 수료증 자동 PDF 발급

작업 브랜치: `feat/events-yewon`. 운영 DB·Storage에 연결하거나 SQL을 적용하지 않았다.

## 실행과 가상 테스트

Node.js 22 이상에서 `npm ci` 후 `npm run dev`를 실행하고
`/preview/certificates`에 접속한다. 이 주소는 개발 모드에서만 제공된다.
Supabase 환경 변수와 로그인 없이 가상 32명, 동명이인, 가상 템플릿 디자인을 확인할 수 있다.
이 주소는 화면 확인 전용이며 업로드·수정·발급·다운로드 등 실제 작업 입력이 비활성화된다. 이름 검색과 전체 식별자 펼치기는 사용할 수 있다.
DB/API를 호출하지 않으며 운영·테스트 모드에서는 404로 차단한다.
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
- 실제 발급은 한 번에 1~20명을 관리자가 선택하고 확인 후 발급한다. 테스트 이벤트는 실제 발급에서 제외한다.
- 서버가 이름과 이벤트를 다시 조회하고 PDF를 생성한 뒤 RPC로 전체 발급 기록을 원자적으로 저장한다.
  파일 저장 후 기록 확정에 실패하면 다운로드 주소를 발급하지 않는다. 기록은 PDF 생성 이력이며 브라우저 수신 완료를 보장하지 않는다.
- RPC는 관리자 여부, 이벤트·신청자 소속, 이름 변경, 중복 요청 항목을 검사한다.
- 발급 당시 이름·이벤트 제목·식별자·시각·발급자·템플릿 ID를 저장한다.
- 설정 수정은 새 템플릿 버전으로 저장한다. 이전 원본/설정은 변경·삭제할 수 없다.
- 실제 재발급은 과거 이름과 과거 템플릿을 사용하고 원래 기록과 연결된 새 발급 기록을 남긴다.
- PDF·ZIP은 전용 비공개 Storage에 24시간 임시 보관한다. 재발급 결과는 동일 이름/디자인이며 바이너리 동일성은 보장하지 않는다.
- API와 데이터 조회 경계에서 관리자 권한을 재확인한다. POST는 same-origin 요청만 허용한다.
- 기본 비활성 상태의 수료증 API는 인증/DB 클라이언트 생성 전 503을 반환한다.

나눔고딕 전체 폰트를 포함하므로 기본 PDF 약 730KB, 20개 ZIP 약 15MB다.
파일은 Vercel 응답에 포함하지 않고 Supabase Storage에서 브라우저로 직접 다운로드한다.

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

## 신청자 목록 사용성

이름 일부를 입력해 검색할 수 있으며 공백과 영문 대소문자를 정리한다.
검색은 표시 목록만 바꾸므로 검색어 입력·삭제 후에도 기존 선택은 유지된다.
전체 신청자·출석 완료(발급 가능)·현재 선택 수는 검색과 관계없는 전체 기준이다.
검색 중에는 검색 결과 수를 별도로 표시한다. 전체 출석자 선택 버튼은 검색 밖의
출석자도 포함하며 최대 100명을 선택한다. 출석이 아닌 사람은 검색 결과에서도 선택 불가다.
UUID는 앞 8자·뒤 6자로 줄이고, 전체 식별자 보기에서 이벤트·신청 경로·전체 신청 ID를 확인한다.
실제 선택과 발급 식별자는 기존 복합 ID를 유지한다. 로그인 없는 개발 미리보기에서도
검색과 식별자 펼치기가 가능하며 발급·설정 변경 기능은 비활성 상태다.

## 비공개 Storage 전달과 재시도 (014)

기존 012·013 이후 `014_certificate_storage_jobs.sql`을 별도 승인된 환경에 적용한다.
이번 개발에서는 로컬 TCP `127.0.0.1:54322`에만 적용했다. 기존 SQL과 자료실 설정은 변경하지 않는다.

- 신규 비공개 `certificate-staging`: 5MiB PDF/PNG/JPG 임시 직접 업로드.
- 신규 비공개 `certificate-downloads`: PDF/ZIP 결과, 최대 64MiB.
- `certificate_jobs`: 작업 UUID·요청·대상 스냅샷·processing/ready/failed/expired·만료·정리 상태.
- `certificate_uploads`: 업로드 경로의 관리자 소유권·형식·유효기간.
- `certificate_issues.download_job_id`: 기존 발급 이력과 결과 작업 연결. 기존 행은 null 유지.
- Storage의 `allow_any_operation(text[])` 함수가 필요하다. 운영은 적용 전 지원 여부와 기존
  광범위한 허용 정책 유무를 확인한다. 삭제용 SELECT는 delete/delete_many에만 허용하며
  만료·실패 파일의 GET·서명 URL 발급을 허용하지 않는다.

브라우저는 작은 JSON으로 업로드 URL을 발급받고 Storage에 PUT한다. 업로드 서명 URL은
Supabase 기본 2시간, 경로 고정·덮어쓰기 금지다. 비밀 키나 사용자 세션 토큰은 브라우저에
추가 전달하지 않는다. 업로드 URL도 권한을 가진 값이므로 로그에 남기지 않는다.
서버가 임시 원본을 다시 읽어 실제 시그니처·용량·PDF 구조·단일 페이지·이미지 해상도·
이름 배치를 검증한 뒤 기존 `certificate-templates`에 검증된 원본을 복사하고 등록한다.
임시 파일은 검증 전에는 템플릿 목록이나 발급에 사용되지 않는다.

발급/재발급/실제 데이터 미리보기는 파일 본문 대신 작업 ID와 다운로드 URL의 JSON만 반환한다.
1. 요청별 UUID로 작업을 선점한다. 중복 요청은 같은 작업을 조회하며 두 번 생성하지 않는다.
2. 서버가 PDF/ZIP을 생성하고 비공개 Storage에 저장한다. 준비 중 파일은 다운로드 불가다.
3. 최종 RPC가 파일 메타데이터 존재·크기·MIME를 확인한 뒤 기존 013 출석 잠금 검증을 호출한다.
   작업 행 → 이벤트 UUID 순 → 참여 이력 순서다. 기존 출석 변경 함수는 수정하지 않는다.
4. 발급 기록과 작업 ready 상태는 같은 DB 트랜잭션으로 확정한다. 이전 직접 기록 RPC의
   authenticated 실행 권한은 회수해 파일 저장 확인을 우회할 수 없게 한다.
5. 관리자 본인 소유의 ready 작업에만 최대 300초 서명 URL을 발급한다. 파일 만료가 더
   가까우면 URL 유효기간도 그만큼 줄인다. 브라우저는 Supabase에서 직접 파일을 받는다.

생성/저장/최종 검증 실패 시 완료 기록을 만들지 않는다. 이미 저장된 파일은 삭제를 시도하고
실패하면 정리 대상에 남긴다. 처리 중 작업은 2분 후 만료되며 출석 잠금 대기 전후에 유효기간을 검사해 뒤늦은 확정을 거부한다.
최종 RPC 응답이 유실돼도 ready 파일을 삭제하지 않으며 같은 작업으로 상태를 재확인한다.
준비 완료 작업은 24시간 보관한다. 주소 만료·인터넷 오류 시 다운로드 재시도는 새 발급이 아니다.
생성 실패·파일 만료 후 새로 만들 때는 “새 발급 작업 준비” 후 수료 대상을 재확인한다.
재발급 버튼은 기존 정책대로 현재 출석을 검증하고 과거 이름·템플릿을 사용하는 새 발급이다.
다운로드 목록에 미리보기는 “발급 기록 없음”으로 구분한다.

파일 저장과 DB는 하나의 트랜잭션이 아니다. 저장 후 확정이 실패한 고아 파일은 정리하며,
이미 발급된 작업은 재시도로 기록을 추가하지 않는다. 브라우저의 디스크 저장 완료는 서버가
보장할 수 없으므로 ready는 “파일 저장·기록 확정 완료”를 의미한다.

### 시간·메모리 및 Vercel 검증

실제 발급은 최대 20명, PDF 합계/최종 ZIP 각각 64MiB, 생성 단계 45초로 제한한다.
Route `maxDuration=60`은 유지한다. 생성 전후와 저장 후 시간을 확인하고 초과하면 확정하지 않는다.
ZIP은 메모리에서 생성하므로 입력·결과 버퍼가 함께 존재할 수 있다. 시간 제한은 단일 PDF 파서의
동기 작업을 중간에 강제 종료하지 못한다. 매우 복잡한 템플릿과 실제 Vercel CPU/메모리의
최악 조건은 별도 검증해야 하며 필요하면 비동기 워커로 전환한다.
5MiB 업로드와 약 15MB ZIP은 브라우저↔Supabase 경로이므로 Vercel 4.5MB 본문을 경유하지 않는다.
메타데이터 요청은 스트림으로 100,000바이트에서 제한하며 multipart 앱 업로드는 받지 않는다.

### 만료 파일 정리

관리자 화면의 “내 만료 파일 정리”는 본인 작업의 만료·실패 파일을 종류별 25개씩 삭제한다.
임시 업로드는 서명 URL 2시간 만료 후 10분의 여유를 두고 삭제한다. 실제 Storage 메타데이터가
사라진 것을 확인해야 cleaned_at을 기록한다. 삭제 실패는 재시도 대상에 남는다.
참조된 정식 템플릿·발급 이력·작업 요청은 삭제하지 않는다. 등록 실패로 남은 미참조 정식 원본도 해당 업로드 정리 시 삭제한다. 오래된 메타데이터의 보존 기간은
별도 정책으로 정해야 하며, 만료는 자동 물리 삭제를 뜻하지 않는다.

무인 운영을 위한 `scripts/cleanup-certificates.mjs`도 제공한다. Node 22.18 이상과
설치된 프로젝트 의존성이 있는 스케줄러에서 아래 명령을 매시간 실행하도록 구성할 수 있다.
스케줄은 이번 작업에서 생성하지 않았다.

```sh
node --experimental-strip-types scripts/cleanup-certificates.mjs
```

스케줄러의 비밀 환경 설정에 다음을 넣는다. 저장소나 일반 로그에 값을 기록하지 않는다.
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- 해당 파일을 생성한 관리자의 `CERTIFICATE_MAINTENANCE_EMAIL`, `CERTIFICATE_MAINTENANCE_PASSWORD`
- 운영 실행에만 `NODE_ENV=production`, `SUPABASE_LOCAL_TEST=false`,
  `CERTIFICATE_MAINTENANCE_ALLOW_CLOUD=true`를 명시적으로 승인해 설정한다.
- 로컬 검증은 `NODE_ENV=development`, `SUPABASE_LOCAL_TEST=true`와 정확한 127.0.0.1:54321을 사용한다.

스크립트는 로그인·admin_users 확인 후 RLS를 따르며 Secret/service_role 키는 사용하지 않는다.
클라우드 대상은 별도 허용 플래그 없이는 거부한다. 현재 관리자 소유 작업만 정리하므로
여러 관리자가 파일을 생성한다면 각 소유자 계정으로 스케줄을 실행해야 한다.
비밀번호를 스케줄러에 보관하기 어렵다면 수동 정리를 사용한다. 공용 관리자 비밀번호를
코드에 넣거나 service_role을 브라우저에 제공하는 방식으로 우회하지 않는다.
앱의 CERTIFICATES_ENABLED=false 상태에서도 이 정리 스크립트는 독립적으로 실행할 수 있다.
실패 시 종료 코드 1로 알리고 스케줄러 알림·재시도를 설정한다.

### 추가 검증 명령

```sh
node tests/certificate-storage-db.mjs
```

기존 전체 코드 테스트·TypeScript·ESLint 및 로컬 Storage/Auth/HTTP 통합 테스트도 함께 수행한다.
Vercel 운영 실환경 검증과 실제 운영 마이그레이션은 별도 승인 작업이다.

014 최종 검증: 코드 테스트 101개, 기존·신규 메모리 PostgreSQL 테스트, TypeScript,
ESLint 오류 0개(기존 경고2개). 로컬 5MiB PDF/PNG/JPG 직접 업로드와 실제 형식 위조 거부,
약15MB/20개 ZIP 직접 다운로드, 중복 요청/다운로드 재시도, Storage 실패 시 기록0건,
출석 변경과 실제 HTTP 발급의 잠금 경합, 일반 사용자·익명 Storage 접근 거부,
만료 정리와 비활성 상태의 정리 스크립트, 미참조 원본 정리까지 검증했다.
첫 정리 검증에서 삭제용 SELECT 정책 누락을 발견해 새014에 보완하고 실제 삭제를 재검증했다.
반복 통합 검증으로 로컬 발급 기록44건이 추가됐으며 실패/재다운로드 요청으로는 추가되지 않았다.
최종 기능 플래그는 false이며 실행 서버 HTTP503을 확인했다.
