# 자료실 구현 및 운영 적용

## 범위·담당·경로

- 2조: 전체 자료실 `/admin/resources`, 등록 `/admin/resources/new`, 상세 `/admin/resources/[UUID]`, 수정 `/admin/resources/[UUID]/edit`.
- 1조 연결: `/admin/events/[slug]/resources` 및 그 아래 동일한 등록·상세·수정 경로. `recruitment_events`의 실제 이벤트를 조회하고 없는 slug와 이벤트 범위 밖 자료는 404.
- 이벤트 신청자 화면과 목록 카드에서 자료로 이동한다. 통합 자료실에서는 이벤트 없음도 가능하다.
- 누적 주차는 직접 입력하는 선택 정수. 기수 및 기수 내 회차와 독립된 필드다.
- 개발 전용 `/preview/admin/resources`, `/preview/admin/resources/new`: 빈 목록·비활성 등록 구성. DB 연결/저장 없음. 운영에서는 404.

## 운영 적용 전 필수

`supabase/005_resources.sql`을 검토 후 Supabase SQL Editor에서 실행한다. 자동 실행하지 않았다. 기존 테이블/버킷 이름 충돌 시 전체 transaction을 중단하며 덮어쓰지 않는다. 먼저 Supabase Tables/Storage에 별도 자료 구조가 있는지 확인한다.

SQL은 resources, resource_files, 인덱스·작성자/수정일·파일 개수 트리거, 관리자 전용 RLS, private admin-resources 버킷과 Storage 정책을 구성한다. 새 환경변수나 secret/service_role 키는 필요 없다. 005는 001(admin_users), 003(recruitment_events)이 있는 환경에 적용한다. 004 신청 접수 활성화와 별개이며 이를 실행/활성화하지 않는다.

적용 전/조회 오류 시 설정 또는 권한 확인 안내가 나오며 가짜 빈 목록으로 숨기지 않는다. SQL 적용 및 아래 통합 테스트 완료 전 사용 가능으로 보고하지 않는다.

## 파일 저장 및 보안

- PDF만, 파일당 **3MiB(3,145,728bytes)**, 자료당 최대 5개. 업로드는 하나씩. Vercel Function 4.5MB 요청 제한 내에서 서버 검증을 위해 이전 제안 10MB 대신 3MB로 설정했다. Next 설정 변경 없음. 실제 PDF 구조 파싱을 위해 pdf-lib를 추가했다.
- 자료 메타데이터를 먼저 저장하고 첨부는 별도 요청으로 올린다. metadata 저장 성공과 파일 등록 성공을 구분한다.
- POST `/api/admin/resources/files`: same-origin 검사, 요청마다 getAdminAccess, 부모 자료 확인. 서버에서 크기/확장자/MIME/PDF header와 EOF, 실행 동작·첨부·암호화·object stream 및 인코딩된 이름을 보수적으로 검사한다. 일부 정상 PDF도 이 정책에 따라 거절될 수 있다.
- pdf-lib로 문서 구조/페이지를 실제 로드하고 invalid object와 암호화 문서를 거부한다. **악성코드 검사/백신을 대체하지 않는다.** 신뢰할 수 있는 운영진 자료만 등록하며 향후 스캐너/안전한 PDF 재생성 도입을 검토한다. 압축 object stream은 내부 액션 우회를 줄이기 위해 차단한다.
- 경로는 resource UUID/file UUID.pdf. 원본 파일명은 메타데이터로 보관한다. public URL 없음, 서버 관리자 확인 후 ready 파일에 60초 signed download URL 발급(첨부 다운로드). signed URL은 유효 기간 동안 소지자가 접근 가능하므로 공유하지 않는다.
- anon 테이블 권한 없음. 일반 authenticated 사용자는 관리자 allowlist RLS/Storage 정책을 통과하지 못한다. 서버 페이지뿐 아니라 data boundary, Action, 파일 Route에서 권한을 검사한다. 사용자별 결과 공유 캐시 없음.
- Storage 권한이 있는 관리자는 SDK 직접 요청도 가능하므로 Storage 자체는 MIME/크기 제한을 적용하되 PDF 내용 검증은 어드민 서버 업로드 경로에서 이루어진다.
- 외부 링크는 http/https 및 credential 없는 URL만. 새 탭 noopener noreferrer. 서버에서 링크 내용을 가져오지 않는다.
- 작성자 UUID/이메일은 DB trigger에서 검증된 auth.uid/auth.jwt로 작성하고 수정 시 원 작성자를 유지한다.

## 실패 복구·삭제

1. 파일 업로드 전 pending 레코드를 먼저 기록한다. 개수 제한은 부모 row lock trigger로 경쟁 요청에서도 적용한다.
2. 생성 경로에 upsert 없이 업로드. 성공 후 ready로 변경해야 다운로드 가능하다.
3. 업로드/ready 저장 실패 시 pending 기록을 유지한다. 장애/취소된 작업 경로가 추적되지 않는 고아 파일이 되지 않게 한다. **자동 정리 작업은 없다.** 화면에서 미완료 기록을 삭제한 후 재업로드한다.
4. 진행 중 요청과 삭제가 겹치지 않도록 pending 생성 후 15분 이내에는 삭제를 차단한다(업로드 maxDuration 60초). 15분 후 Storage remove → 파일 기록 delete 순서로 복구한다.
5. 파일 삭제는 확인 후 Storage 먼저, 파일 기록 나중. DB 정리에 실패하면 기록을 남기고 재시도 안내. 자료 전체 삭제는 파일을 순차 정리한 후 자료 레코드를 삭제한다. 부분 실패 시 자료 정보 유지. 삭제 완료로 표시하지 않는다. 전체 파일 관계는 FK restrict로 보호한다.
6. DB와 Storage는 하나의 ACID transaction이 아니다. 브라우저 연결이 끊기면 상세 화면 새로고침으로 상태 확인. 관리자 직접 SQL/Storage 삭제는 앱 복구 흐름 밖이므로 권장하지 않는다.

## 공통 코드·충돌 가능 파일

- `src/lib/resources.ts`: 서버 조회/필터/20건 페이지네이션/이벤트 범위.
- `src/lib/resource-validation.ts`: metadata/PDF/link 검증.
- `src/app/actions/resources.ts`: 자료 저장/삭제.
- `src/components/resources/*`: 통합·이벤트 공통 목록·등록·상세·첨부 UI.
- 공통 변경: `protected-admin.tsx`, admin catchall route, recruitment-view.tsx, preview catchall route. 1조 이벤트 기능과 충돌 가능.
- 3조 공개 홈페이지·시즌9 폼 파일은 변경하지 않았다. Git 고정 브랜치에는 앞서 미병합 신청 기능 commit도 있으므로 PR에 함께 보인다. 신청 활성화 SQL004의 별도 검토 gate는 유지한다.

## 노션 이관

노션 CSV(기수·회차·누적 주차·주제·작성일·원 작성자)와 실제 원본 PDF, 자료별 파일 연결 목록이 필요하다. CSV 파일명과 원본 파일 SHA256 기준으로 중복/매핑을 사전 검토한다. 원 작성자 이력은 실제 근거가 있을 때 별도 이관 필드로 설계하며 로그인 관리자 작성자를 사칭하지 않는다. 캡처 행·파일·작성자를 데이터로 생성하지 않았다. 이번 기능 구현과 이관은 별도다.

## 검사 기록

- lint / TypeScript: 통과(최종 재검사 결과 확인).
- `node --experimental-strip-types --test tests/resources.test.mjs`: PDF 정책·실제 구조 파싱, 링크 보안, 입력 검증 4개 통과. 운영 자료 없음.
- 개발 미리보기 목록→등록, 저장 비활성 확인. 모바일/인증/빌드 결과는 아래 최종 기록에 추가한다.
- 미검증: SQL005 실제 적용, DB·Storage 관리자 CRUD/실패 복구/다운로드/동시 요청, 일반 회원 및 anon 실제 RLS·Storage 차단, 데이터 있는 검색·필터·페이지네이션, 실제 로그인·로그아웃 회귀. SQL을 적용하지 않았으므로 통합 검증 완료로 간주하지 않는다.

공식 근거: https://vercel.com/docs/functions/limitations 및 https://supabase.com/docs/guides/storage/buckets/fundamentals

## 최종 확인 기록 (2026-10-15)

- 개발 서버 PID17190/3000을 종료하지 않았다.
- 개발용 자료 목록→등록 이동, 비활성 저장, 390px 모바일 메뉴 열기·이동·닫기 확인. 화면 전체 가로 넘침 없음(390/390px).
- 비로그인 `/admin/resources`, `/admin/events/season9/resources` 직접 요청: 스트리밍 로그인 리디렉션 확인(응답 status200 안의 redirect marker).
- 로그인된 관리자 자료실: 미설정 안내 확인. 로그인·로그아웃 동작 자체는 재실행하지 않았다.
- 공개 홈페이지와 로그인 화면 HTTP200 확인. 콘텐츠 전체 회귀/도메인별 실제 운영 배포는 미검증.
- 첫 빌드에서 cacheComponents와 불필요한 route runtime 설정 충돌을 수정했다. 이후 기본 sandbox 빌드는 Turbopack CSS process/port Operation not permitted(os error1)로 실패했다. 권한 요청 빌드 결과는 별도 기록한다.
- `.env.local` Git 미추적·ignore 확인, 새 소스/SQL에 실제 credential 패턴 없음.
- 운영 dependencies npm audit 취약점0. 전체 설치 audit에는 기존 개발 의존성 high5가 남아 있으며 force fix 미실행.
- `supabase/tests/resources_access.sql`: 테스트 환경용 관리자 CRUD 기초·파일 개수·RLS 검사, rollback. 작성만 했으며 미실행.
- 권한 요청 후 빌드도 같은 Turbopack 포트 바인딩 권한 오류로 실패. 로컬 운영 빌드 미통과. Mac 터미널에서 `cd ~/Projects/malmoim-admin && npm run build` 종료 코드0 확인 필요. Vercel CI 빌드는 push 후 별도 확인한다.

## SQL 적용 후 확인

- 사용자 SQL Editor 성공 캡처 확인. 실제 로그인 관리자 `/admin/resources` 재조회 성공: 자료0건, 연결 이벤트 말모임9기 표시. SQL005 설정 미확인 gate는 해소했지만 실제 Storage 파일 CRUD와 일반 회원 차단은 여전히 미검증이다.
- 구현 commit caa1ded의 Vercel Preview build success 확인. 주소 https://malmoim-admin-2e6mk1i7a-malmoim.vercel.app . 로컬 권한 빌드 실패와 구분한다.
- 기존 draft PR5에는 SQL004 신청 활성화 준비도 함께 있으므로 별도 접수 검증 gate를 유지한다. SQL005 성공만으로 신청 활성화를 완료했다고 간주하거나 main 병합하지 않는다.
- 비로그인 파일 API POST403 확인.

## 자료실 전용 운영 반영

사용자 승인으로 `codex/resources-release` 별도 배포 브랜치를 최신 main에서 만들고 자료실 구현·검증 기록만 cherry-pick했다. 기존 고정 브랜치와 draft PR5는 보존한다. 이 PR에는 시즌9 신청 Action·폼·접수 활성화 flag·SQL004 변경이 포함되지 않는다(main 대비 diff0 확인). 자료실 SQL005는 사용자가 이미 적용했다. PDF 실제 CRUD/다운로드·일반 회원 Storage 통합 검증은 미검증으로 유지하며 운영에 가짜 자료를 저장하지 않는다.
