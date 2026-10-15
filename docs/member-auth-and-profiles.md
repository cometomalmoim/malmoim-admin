# 일반 회원 인증·회원가입 구현 및 DB 검토

상태: 로컬 코드 구현 / 운영 DB 미조회·미적용 / 개인정보 정책 미확정으로 실제 가입 차단.
현재 개인 브랜치의 기존 미커밋 변경을 보존했다. commit, push, DB 적용, 원격 설정 변경은 하지 않았다.

## A. 작업 전 진단

- 현재 브랜치는 feat/website-yukyung이며 기존 미커밋 변경을 보존했다.
- 기존 비밀번호/확인 입력은 visible 상태를 공유했고 토글 버튼은 비밀번호 쪽에만 있었다.
- 기존 언어 입력은 한국어 5단계 + 외국어 1~5개였으며 영어 고정 필드가 없었다.
- 인증 화면은 한국어만 지원했다. 헤더의 English는 대응 인증 페이지 대신 /en 홈페이지로 이동했다.
- 기존 공개 콘텐츠는 URL 기반 /en 번역을 지원했지만 언어 선호 쿠키는 없었다.
- memberRegistrationPolicy=null과 검토 SQL의 NULL 준비 응답으로 실제 가입은 차단된 상태였다.
- 요청에서 지정한 검토 SQL 1개·검증 SQL 2개·이 보고서는 모두 존재했다.
- 운영 DB 메타데이터 연결이 없어 실제 테이블·RLS·트리거·초안 적용 여부는 미확인이다.
- 기존 admin_users와 관리자 권한 검사, 행사·참여 이력 구조는 변경하지 않았다.

## B. 디자인

- 데스크톱: 기존 MALMOIM 로고와 홈페이지의 실제 문구를 왼쪽에, 로그인 폼을 오른쪽에 배치했다.
- 760px 이하: 브랜드 패널을 숨기고 로그인 폼 한 열로 표시한다.
- 홈페이지의 노랑·청록·중립색과 기존 로고를 사용했다. 신규 이미지·외부 UI 패키지는 없다.
- 회원가입은 계정 / 기본 정보 / 언어 정보의 세 fieldset으로 구성했다.
- 승인되지 않은 개인정보 안내는 확정 대기로 표시한다. 가짜 처리방침 링크나 동의 문구를 만들지 않았다.
- 회원 정보 필수·선택 기준도 미확정임을 표시했다. 기본 정보는 입력 시 형식을 검증하며 운영상 필수로 확정하지 않았다.
- 계정과 언어 항목은 이번 요청의 입력 조건으로 검증한다. 개인정보 수집은 실제 가입 활성화 전 결정해야 한다.

## C. 구현

### 로그인·세션

- 기존 Supabase SSR createClient와 signInWithPassword를 재사용한다.
- 일반 회원 로그인 후 선택 언어에 따라 / 또는 /en, 관리자 로그인 후 /admin 이동은 분리되어 있다.
- PublicAccount 서버 컴포넌트는 요청 쿠키와 getUser 결과로만 계정 UI를 렌더링한다. 쿠키 존재만으로 인증됐다고 판단하지 않는다.
- 개인화 영역을 Suspense 안에 두어 Next Cache Components 규칙을 지켰다. 사용자 정보를 공유 캐시에 저장하지 않는다.
- proxy 갱신은 공통 헤더가 있는 /, about/events/exchange/board/history, /en 하위와 /auth/login, /signup 및 기존 /login, /admin에 적용한다.
- 독립적인 season9, Halloween, API 경로는 이번에 갱신 대상에 추가하지 않았다.
- 계정 메뉴는 이메일, 비활성 마이페이지, 로그아웃을 표시한다. Escape·외부 클릭·포커스 이탈로 닫힌다.
- 일반 회원 로그아웃은 기존과 같은 local 세션 signOut을 사용하고 선택 언어에 따라 / 또는 /en으로 이동한다. 관리자 logout의 /login 이동은 유지한다.
- 일반/관리자 인증은 같은 브라우저의 Supabase 세션을 공유한다. 한쪽에서 로그아웃하면 같은 세션으로 접근하던 관리자 화면도 다시 인증이 필요하다.
- 관리자 로그인 화면, getAdminAccess, admin_users, 관리자 페이지 코드는 수정하지 않았다.

### 회원가입 폼과 검증

- /signup 페이지와 로그인 화면의 가입 링크를 연결했다.
- 비밀번호: 사용자 확정 기준인 최소 8자 + 영문 + 숫자 + ASCII 특수기호를 브라우저/서버 공통 함수에서 검증한다.
- 이 규칙을 기존 계정 로그인에 강제하지 않아 기존 비밀번호 로그인 동작은 유지한다.
- Supabase 자체의 실제 비밀번호 정책은 조회·변경하지 않았다. 운영 활성화 전 동일하거나 더 엄격한 정책인지 담당자가 확인해야 한다.
- 이메일·확인 비밀번호·기본 정보 형식·미래/불가능한 생일·국가/성별/언어 코드를 검증한다.
- 국적: ISO 3166-1 alpha-2 코드 249개, 한국어·영어 표기는 Intl.DisplayNames를 사용한다.
- 추가 외국어: 선택 가능한 ISO 639-1 언어 35개이며 한국어·영어를 제외한다. 모든 세계 언어를 제공하는 것은 아니다.
- 전화 국가번호는 주요 45개 선택 항목과 다른 번호 직접 입력을 제공한다. 실제 전화번호 소유나 유효한 발급 여부를 인증하지 않는다.
- 전화번호는 국가번호와 숫자 본체를 분리한다. 공백·괄호·하이픈을 제거하고 +82 번호의 첫 국내 접속용 0 하나를 제거한다.
- 한국어·영어는 각각 none/basic/conversational/fluent/native, 추가 외국어는 none을 제외한 4단계다.
- 추가 외국어는 0~3개이며 ko/en/중복/알 수 없는 코드/잘못된 실력값을 거부한다.
- 행 ID를 유지하여 삭제·추가 시 다른 입력/실력값을 보존한다. 0개에서 시작해 모두 삭제 가능하며 3개에서 추가를 막는다.
- 중복 제출 방지, 확인 중 상태, 오류 시 입력 유지, 첫 오류 포커스, 두 비밀번호 필드의 독립적인 표시/숨기기를 지원한다.
- 비밀번호는 프로필 객체·RPC 인수·로컬스토리지·동의 기록에 넣지 않는다.

### 저장 흐름과 현재 제한

1. 현재 memberRegistrationPolicy는 null이다. 서버 액션은 Auth 클라이언트 생성 전 차단한다.
2. 현재 UI에서는 유효한 입력이어도 locale만 담은 FormData를 차단 액션에 보낸다. 개인정보나 비밀번호를 전송하지 않는다.
3. 정책 승인 후에는 서버 공통 검증 → DB 준비/동의 버전 확인 → Auth signUp → 서버 getUser 확인 → 프로필 저장 RPC 순서로 연결할 수 있다.
4. 준비 RPC가 없거나 동의 버전이 다르면 Auth 계정을 만들지 않는다.
5. Auth가 세션을 주지 않으면 이메일 안내 확인/기존 계정 로그인 안내를 표시하고, 프로필이 저장되지 않았음을 명시한다. 기존 이메일 존재 여부를 확정해 노출하지 않는다.
6. 인증 후 /signup에서는 계정 이메일을 읽기 전용으로 표시하고 비밀번호를 다시 받지 않는다. 프로필을 다시 입력해 저장을 재시도하는 경로다.
7. Auth는 생성됐지만 프로필 RPC가 실패하면 profile_pending으로 표시한다. 전체 가입 완료로 표시하지 않는다.
8. 프로필과 언어는 한 RPC 트랜잭션으로 저장하며 RPC가 반환한 본인 UUID까지 확인한다.
9. 네트워크 결과가 불명확하면 완료로 보고하지 않는다. 서비스 키를 사용한 계정 삭제·보상 삭제는 하지 않는다.
10. 동의 UI/기록 저장은 미구현이다. null 정책만 켜거나 SQL 준비 응답만 바꿔서는 안 된다. 아래 활성화 순서를 따른다.

## D. DB 초안

실제 기존 동등 구조 유무를 먼저 확인해야 한다. 기존 SQL 번호는 중복이 있어 자동 실행 순서를 가정하지 않았고 날짜가 붙은 drafts 경로를 사용했다.

### 파일

- supabase/drafts/20261016_member_profiles_review.sql: 신규 테이블·RLS·제약·보호 트리거·저장 RPC 검토 초안. 운영 적용 금지.
- supabase/tests/member_profiles_metadata.sql: 테이블/컬럼/제약/RLS/권한/함수 속성만 조회하는 읽기 전용 검토 SQL.
- supabase/tests/member_profiles_access.sql: 격리된 로컬 Supabase에서만 실행할 회귀 테스트. 임시 Auth UUID를 트랜잭션 내 생성하고 rollback한다. 실행하지 않았다.

### 테이블

| 테이블 | 컬럼 및 타입 |
| --- | --- |
| member_profiles | user_id UUID PK/FK auth.users(id), name TEXT, phone_country_code TEXT, phone_number TEXT, nationality_code TEXT, gender TEXT, birth_date DATE, korean_proficiency/english_proficiency TEXT NOT NULL (각각 5단계, 기본값 없음), created_at/updated_at TIMESTAMPTZ |
| member_languages | user_id UUID FK member_profiles(user_id), language_code TEXT, proficiency TEXT, PK(user_id,language_code) |

Auth UUID 삭제 시 새 프로필/언어만 cascade한다. 기존 Auth 삭제 자체의 영향은 별도다. 예를 들어 기존 resources.author_id FK는 Auth 계정 삭제에 영향을 줄 수 있으므로 자동 계정 삭제를 하지 않는다.

기본 정보 nullable 여부는 개인정보 정책 확정 전의 초안이다. 필수 항목 확정 후 서버·DB 함수 검증을 함께 조정해야 한다. 생년월일 미래 금지는 DB 보호 트리거, 전화번호 쌍/국가/성별/실력/코드는 DB 제약으로 검증한다.

### RLS·컬럼 보호

- anon: 프로필/언어 SELECT·쓰기 및 저장 RPC 실행 권한 없음.
- authenticated: auth.uid()=user_id인 본인 프로필/언어 SELECT만 허용.
- direct INSERT/UPDATE/DELETE: 권한과 정책을 부여하지 않는다. 따라서 direct UPDATE용 USING/WITH CHECK 정책도 만들지 않는다.
- 쓰기는 본인 UUID를 내부에서 가져오는 SECURITY DEFINER RPC로만 제공한다. UUID/타임스탬프 입력을 받지 않는다.
- 허용하지 않은 프로필 키를 거부하며 소유자·created_at 변경을 트리거로 차단한다. updated_at은 DB가 생성한다.
- 함수 search_path를 비우고 객체를 한정한다. PUBLIC 실행 권한을 회수하고 필요한 함수만 해당 역할에 부여한다.
- 함수 소유자는 검토된 BYPASSRLS migration owner가 필요하다. 브라우저나 서버 액션에 service-role 키를 추가하지 않았다.
- 관리자에게 타 회원 개인정보 조회 예외를 주지 않는다.

### 원자성·개수 제한

- Auth 생성과 프로필 저장은 별도 요청이다. 이 둘 전체가 단일 트랜잭션이라고 주장하지 않는다.
- 프로필/언어 저장은 DB 함수 한 트랜잭션이다. 잘못된 언어·중복 등으로 실패하면 프로필 수정도 롤백한다.
- 사용자별 transaction advisory lock + 프로필 row lock으로 동일 회원의 병렬 저장을 직렬화한다.
- 프로필·언어 양쪽의 deferred constraint trigger로 커밋 시 추가 외국어 0~3개를 검증한다.
- 실제 동시 요청, deferred 검사, RLS는 DB 엔진에서 아직 검증하지 못했다.
- Auth 트리거는 모든 계정 생성에 영향을 줄 수 있고 실패 시 가입 자체를 막을 수 있어 이번 초안에서 auth.users 트리거를 추가하지 않았다.
- RPC 방식은 관리자 계정 생성과 분리하기 쉽지만 이메일 인증 후 재입력/저장 실패 재시도 UX가 필요하다.

### 동의·활성화·롤백

개인정보 수집 목적, 보관 기간, 처리방침 URL/문구/버전, 필수·선택 수집 범위, 철회·탈퇴 절차는 미확정이다.
향후 member_consents 또는 같은 역할의 별도 기록에 UUID, 문서 버전, 동의 종류, DB 생성 시각, 철회 이력을 남기는 구조를 검토해야 한다. 이는 현재 테이블로 생성하지 않았다.
동의 기록은 회원이 본인 기록을 조회할 수 있어도 시각·버전을 직접 수정하지 못하도록 별도 권한/저장 함수를 설계해야 한다.

활성화 전 순서:
1. 운영 메타데이터와 실제 적용 이력, 동등 프로필 구조/이름 충돌을 DB 담당자가 확인한다.
2. 수집 정책을 확정하고 해당 필수 필드·동의 기록 저장을 SQL/서버/화면에 반영한다.
3. 승인된 동의 버전 검증과 기록을 save_member_profile의 같은 트랜잭션에 구현한다.
4. 격리 환경에서 SQL 적용·RLS·다른 사용자 접근·동시 저장·부분 실패 테스트를 실행한다.
5. Supabase 가입 허용/이메일 인증/비밀번호 정책/메일 발송/승인된 리디렉션과 수동 로그인 후 복구 흐름을 확인한다.
6. 총괄 승인 후 별도 운영 적용을 진행한다. UI 동의와 서버 정책, DB 준비 버전을 함께 활성화한다.

member_registration_ready는 초안에서 의도적으로 NULL이다. 초안 적용만으로 가입이 열리지 않는다.
배포 롤백 시 가입을 먼저 차단하고, 수집된 데이터가 있으면 보존/내보내기와 관련 의존성을 검토한다. 새 함수/트리거/테이블만 역순 제거하는 것은 격리 환경에서만 사전 검증한다. Auth 계정, 기존 관리자·행사 객체를 삭제하지 않는다. 자동 DROP 스크립트는 제공하지 않았다.

## E. 검증

- npm run lint: 통과, 기존 suggestions.ts 미사용 인수 경고 2개 유지.
- npm run build: 통과, /en/auth/login·/en/signup 포함 33개 페이지 생성. 실행 환경 Node20에 대한 Supabase SDK 지원 종료 예정 경고가 있다.
- Node24 node --test --test-reporter=spec tests/*.test.mjs: 54개 통과.
- 자동 테스트는 가짜 Auth/RPC 의존성을 사용한다. 성공/실패/이메일 인증 대기/서버 검증/저장 실패/재시도/관리자 접근 거부/서버 계정 표시/홈 세션 갱신을 검사한다.
- 실제 프로덕션 빌드 브라우저: 320/390/768/1024/1440px 가로 넘침 없음, 로그인 입력/토글/첫 오류 포커스, /signup 이동, 국적 249개, 한국어·영어 5단계/추가 외국어 4단계, 행 추가/삭제/중복 방지/0~3개 제한/입력 유지/가입 차단, 기존 관리자 로그인 화면 확인.
- 별도 격리 UI fixture: 실제 ProfileMenu 컴포넌트의 키보드 열기/Escape, 이메일, 비활성 마이페이지, 모의 로그아웃 로딩·실패·재시도, 반응형을 검사했다. Supabase 호출이 없는 모의 테스트다.
- git diff --check: 통과.
- 실제 Supabase 로그인/메일 인증/쿠키 지속/로그아웃 통합, 실 DB 저장·RLS·동시성·SQL 실행은 미검증이다. 승인된 테스트 계정과 격리 DB 환경이 제공되지 않았다. 운영 테스트 계정은 생성하지 않았다.

### 테스트 파일의 역할

- tests/member-login.test.mjs: 기존 관리자/일반 로그인과 로그아웃의 목적지, 오류 처리, 관리자 등록 검사, proxy 범위 회귀 검사.
- tests/member-registration.test.mjs: 개인정보 미확정 시 차단, 입력·비밀번호 정책, 이메일 인증/원자 저장 호출/저장 실패 재시도, 헤더·세션 처리 검사.
- supabase/tests/member_profiles_metadata.sql: DB 구조만 확인하는 검토 도구.
- supabase/tests/member_profiles_access.sql: 격리 DB에서 개인정보 접근과 제약을 검사할 SQL. 운영 앱에서 실행하지 않는다.
- .next/member-account-check 및 .next/*.png: 브라우저 검증용 임시 fixture/화면 캡처. Git 추적·운영 경로와 무관하며 삭제해도 된다.
- tests 파일은 DB 연결 후에도 회귀 방지용으로 유지하는 편이 좋다. signup-options/validation, member-registration, policy 파일은 실제 앱 코드이므로 테스트용으로 삭제하면 안 된다.

## F. 다른 팀 영향

- 관리자 화면·권한 검사·admin_users·기존 SQL 파일·행사 신청·참여 이력·영문 콘텐츠는 수정하지 않았다.
- 공통 PublicFrame에 개인화 계정 슬롯을 추가했으므로 한국어/영어 헤더에 동일한 세션 상태를 반영한다.
- 공통 헤더 경로는 세션 갱신과 private/no-store 응답을 사용하므로 공개 헤더에 개인 정보가 공유 캐시로 섞이지 않도록 한다.
- 기존 행사 신청서는 신청 당시 기록이다. 프로필 수정으로 자동 변경하지 않는다.
- 이름/전화번호가 같아도 event_people 또는 과거 신청과 연결하지 않는다. 행사 테이블에 회원 FK를 추가하지 않았다.
- 새 회원 가입은 관리자 등록을 생성하지 않는다.
- 총괄·DB 담당자와 운영 스키마 확인, 개인정보/동의/필수 필드, 가입·메일·비밀번호 정책, 실패 복구·탈퇴, 추후 행사 계정 연결 기준을 협의해야 한다.

공식 참고:
- [Supabase 가입 API](https://supabase.com/docs/reference/javascript/auth-signup): 이메일 확인 시 세션 유무와 기존 이메일 응답 주의.
- [Supabase 사용자 데이터](https://supabase.com/docs/guides/auth/managing-user-data): auth.users 참조 프로필과 Auth 트리거의 영향.
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security): 행 정책과 테이블 권한을 함께 검토.

## 변경 파일 목록

| 구분 | 파일 |
| --- | --- |
| 로그인 화면 | src/app/(public)/auth/login/page.tsx, src/app/(public)/auth/login/login.css, src/components/member-login-form.tsx |
| 계정 헤더 | src/components/public-account.tsx, src/components/profile-menu.tsx, src/components/profile-menu.css, src/components/public-header.tsx, src/components/public-frame.tsx |
| 인증·세션 | src/app/actions/auth.ts, src/proxy.ts |
| 회원가입 화면 | src/app/(public)/signup/page.tsx, src/app/(public)/signup/signup.css, src/components/signup-form.tsx |
| 회원가입 검증·연결 | src/lib/signup-options.ts, src/lib/signup-validation.ts, src/lib/member-registration.ts, src/lib/member-registration-policy.ts, src/app/actions/member-registration.ts |
| DB 초안·검증 | supabase/drafts/20261016_member_profiles_review.sql, supabase/tests/member_profiles_metadata.sql, supabase/tests/member_profiles_access.sql |
| 자동 테스트 | tests/member-login.test.mjs, tests/member-registration.test.mjs |
| 협업 문서 | docs/member-auth-and-profiles.md |

로그인 화면과 member-login-form, auth 액션의 일반 로그인 부분 및 기존 테스트 일부는 작업 시작 전부터 미커밋 상태였다. 해당 변경을 보존하고 이번 범위에서 확장했다.

## 한영 전환·언어 입력 변경 기록 (2026-10-16)

### 화면과 데이터 계약

- 비밀번호와 확인 비밀번호는 각각 별도 보기 상태를 가진다. 각 버튼의 aria-controls는 자신의 입력 하나만 가리킨다.
- 한국어와 영어는 독립적인 고정 필드로, 둘 다 사용자가 5단계 중 직접 답해야 한다. 기본 실력을 자동 선택하지 않는다.
- 기존 한국어 필드와 일관되게 영어도 화면/서버/초안에서 응답을 요구한다. 기본 개인정보의 운영상 필수·선택 정책은 여전히 미확정이다.
- 추가 외국어는 선택이며 0~3개다. 초기 0개, 모두 삭제 가능, 3개에서 추가 차단, ko/en/중복/none은 거부한다.
- englishLevel → member_profiles.english_proficiency, koreanLevel → korean_proficiency로 저장 요청을 구성한다.
- 추가 외국어만 member_languages에 전달하며 빈 배열도 원자적 저장 단위에 포함한다.

### 경로와 선호 유지

| 화면 | 한국어 | 영어 |
| --- | --- | --- |
| 홈페이지 | / | /en |
| 일반 로그인 | /auth/login | /en/auth/login |
| 회원가입 | /signup | /en/signup |

기존 소개/이벤트/언어교환/게시판/히스토리의 /en 대응 경로도 유지한다.
새 프레임워크를 설치하지 않았다. 기존 route group/locale prop을 재사용하고 인증 화면 전용 문구만 member-messages.ts에 분리했다.
국적·국가번호·추가 언어의 표시 이름은 locale별로 생성한다. 코드값은 번역하지 않는다.

상단 언어 선택은 대응 페이지에 ?lang=ko 또는 ?lang=en으로 이동한다.
proxy는 유효한 명시적 선택을 malmoim_locale 쿠키에 기록하고 쿼리를 제거한 주소로 이동한다.
쿠키는 path=/, SameSite=Lax, HttpOnly, 운영 HTTPS에서는 Secure, 수명 1년이다. 인증 토큰과 별개이며 서비스 권한을 부여하지 않는다.
언어 전환 링크는 prefetch=false여서 미리 가져오기만으로 반대 언어를 선택하는 부작용을 피한다.
저장된 영문 선호가 있으면 지원되는 한국어 기본 주소를 영문 주소로 렌더링 전에 이동한다. 명시적인 한국어 선택은 이를 덮어쓴다.
직접 /en 주소를 열면 영문을 선택한 것으로 처리한다. URL·서버 locale prop이 같은 화면을 결정하므로 클라이언트에서 번역을 나중에 교체하지 않는다.
일반 로그인/로그아웃의 성공 목적지는 검증된 locale 열거값에 따라 / 또는 /en이다. 외부 URL을 목적지로 받지 않는다.

공개 프레임과 각 인증 main에 서버 렌더링된 lang=ko/en을 제공한다.
공통 RootLayout의 html lang=ko는 관리자까지 영향을 주지 않도록 수정하지 않았다. 영문 공개 영역은 상위 wrapper의 lang=en을 상속하여 표시/읽기 언어를 지정한다.
별도 다중 root layout으로 최상위 html까지 경로별로 변경하는 작업은 이번 범위에서 하지 않았다.

관리자 /login·/admin, API, season9 및 Halloween 독립 페이지에는 새 선호 리디렉션을 적용하지 않는다.
독립 행사 페이지의 기존 번역 구조는 유지한다. 해당 페이지와 일반 사이트 사이의 새 통합 언어 선호 처리는 추가하지 않았다.
지원되지 않는 임의 영문 경로를 자동 생성하지 않는다. 언어 전환으로 이동하면 페이지가 새로 열리므로 작성 중인 폼의 값은 별도 저장하지 않는다. 비밀번호를 저장소에 보존하지 않는다.

### DB 호환성

SQL은 기존 초안 파일만 수정했다. 운영 테이블을 변경하거나 신규 적용하지 않았다.
korean_proficiency/english_proficiency는 NOT NULL, 동일 5단계 CHECK이며 기본값이 없다.
member_languages의 허용 목록은 ko/en을 제외한 35개이며, 최대 3개를 RPC 검증과 deferred count trigger에서 검사한다.
RLS 및 직접 쓰기 제한, UUID/타임스탬프 보호, 사용자별 잠금과 프로필·언어 일괄 저장 원칙은 유지했다.

이전 초안이 실제 적용되어 있거나 동등한 테이블이 이미 있다면 이 신규 생성 초안을 그대로 실행하면 안 된다.
기존 영어 행이 있다면 고정 영어 필드로 전환하는 계획이 필요하고, 영어 미응답을 임의로 none으로 채우면 안 된다.
기존 추가 언어가 3개를 초과하거나 금지 값이 있더라도 자동 삭제·잘라내기를 하지 않는다. 담당자가 보존·재입력·전환 절차를 검토해야 한다.
이번 변경은 기존 SQL에 UPDATE/DELETE 정리 작업이나 자동 백필을 추가하지 않는다.

### 가입 차단·검증

실제 가입은 여전히 차단되어 있다.
- UI는 준비 상태와 비활성 개인정보 동의를 표시한다.
- 차단 시 서버 액션에 전달하는 것은 locale뿐이며 개인정보나 비밀번호를 보내지 않는다.
- memberRegistrationPolicy=null이 Auth 클라이언트 생성 전 서버 액션을 막는다.
- DB 초안의 member_registration_ready도 NULL을 반환하며 저장 RPC가 미승인 버전을 거부한다.
- 개인정보 동의 문구/버전/보관·철회·필수 수집 정책 및 변조 불가능한 동의 기록은 미확정·미구현이다.

자동 테스트와 브라우저 검증은 실제 Supabase 통합 테스트와 구분한다.
실제 계정 생성·로그인·로그아웃·이메일 인증·DB 저장/RLS/동시성은 실행하지 않았다.
운영 DB 실제 적용 여부와 메타데이터는 미확인이다. 검토용 SQL 및 연결 코드는 운영 활성화의 증거가 아니다.

### 이번 추가/수정 파일

- 영문 route: src/app/(english)/en/auth/login/page.tsx, src/app/(english)/en/signup/page.tsx
- 공통 page: src/components/member-login-page.tsx, src/components/member-signup-page.tsx
- locale/text: src/lib/public-locale.ts, src/lib/member-messages.ts
- 기존 로그인/가입 page·form, auth/member-registration 액션, signup options/validation, 저장 orchestration 수정
- 헤더·프로필 메뉴·PublicAccount·proxy 수정
- public-shell-design.css: 961~1100px에서 긴 영문 메뉴에 기존 접이식 내비게이션 적용
- 기존 검토 SQL 1개·검증 SQL 2개, 자동 테스트 2개 및 이 문서/public-i18n.md 갱신

### 최신 화면 검증 결과

- 54개 자동 테스트 통과. Auth/RPC 성공·실패·이메일 인증·권한·영문 목적지 처리는 모의 테스트다.
- 한영 홈 → 로그인 → 가입 → 로그인/홈 이동, 같은 페이지 언어 전환, 선호 쿠키에 따른 기본 주소 처리, 한국어·영어 새로고침을 실제 로컬 브라우저에서 확인했다.
- 두 토글의 독립 동작/입력 유지/Show·Hide·보기·숨기기, 한국어·영어 5단계, 추가 외국어 4단계를 확인했다.
- 초기 0/3, 3개에서 추가 비활성화, 4번째 차단, ko/en 제외, 중복 방지, 개별 실력 유지, 삭제 후 값 유지 및 0개 복귀를 확인했다.
- 추가 외국어 0개 상태로 입력 검증을 통과해도 실제 계정 생성 차단 응답이 표시되는 것을 확인했다.
- 영문 가입 본문에 한국어 미번역 문구가 남지 않은 것을 확인했다.
- 320/390/768/961/1024/1440px 로그인·가입 화면의 가로 넘침이 없고 영문 태블릿 메뉴 열기/Escape가 정상 동작한다.
- 기존 소개 페이지의 한영 이동·새로고침과 /login 관리자 화면 유지도 확인했다.
- npm run lint는 기존 suggestions 경고 2개 외 오류 없이 통과, npm run build 통과, git diff --check 통과.
- 실제 Supabase 계정·메일·DB 저장/RLS 통합 테스트는 실행하지 않았다. 운영 계정 생성이나 SQL 적용도 하지 않았다.
