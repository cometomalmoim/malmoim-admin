# 회원 게시판 실제 DB 연결 진단·운영 적용 승인 자료

작성일: 2026-10-17 / 작업 브랜치: feat/operations-juho
상태: 원격 읽기 진단 및 로컬 적용 검증 완료. **운영 활성화 미완료, 원격 SQL 실행 승인 대기.**
기존 미완료 작업은 보존했고 commit/push를 실행하지 않았다.

## A. 준비 안내의 정확한 원인

communityList는 Supabase의 member_board_list RPC 오류/예외에 null을 반환한다.
CommunityListView는 null을 준비 안내로 표시하며 실제 빈 목록과 구분한다.
글쓰기 화면도 동일 조회가 성공하지 않으면 저장 폼을 제공하지 않는다.

이번에 .env.local의 값을 출력하지 않고, 설정 검증과 원격 읽기 요청만 실행했다.
- 필요한 공개 URL/키가 존재하고 기존 설정 검증을 통과했다. local test 모드는 꺼져 있다.
- Auth settings: HTTP 200. 연결 대상 Auth API 및 공개 키는 응답한다.
- board_posts/comments/reports/moderation_logs/aliases/view_days: 각 HTTP 404 / PGRST205.
- member_board_list(p_filter,p_admin), member_board_detail(p_id,p_admin,p_page,p_query): HTTP 404 / PGRST202.
- admin_users: 익명 요청 HTTP 401 / 42501. 이를 테이블 부재로 해석하지 않는다.
- 테이블 요청은 limit=0으로 데이터 행을 조회하지 않았다. 목록/상세 조회의 오류 코드만 출력했다.
- Auth 사용자 로그인·계정 목록·회원 개인정보·환경변수 값·원격 쓰기는 수행하지 않았다.

따라서 현재 호출 대상 REST 스키마 캐시에서 게시판 테이블/조회 함수를 찾지 못하는 것이 확인된 실패 지점이다.
환경변수 누락이나 Auth API 전체 장애로 판단할 근거는 없다.
다만 REST 결과만으로 실제 PostgreSQL 테이블 부재를 확정할 수 없다.
미적용, 다른 프로젝트에 적용, 노출 스키마/권한 또는 캐시 문제를 DB 담당자가 구분해야 한다.
현재 SQL 관리자 연결/전용 Supabase 메타데이터 도구가 없으며 실제 migration history는 미확인이다.
운영 mutate RPC는 읽기 진단 목적으로 호출하지 않았다.

## B. 적용 대상과 순서

새 번호 파일을 중복 생성하지 않고 기존 날짜 기반 SQL을 단일 적용 후보로 유지했다.
이는 자동 배포 migrations 디렉터리에 넣은 파일이 아니다.

1. DB 담당자가 supabase/tests/member_board_preflight.sql을 대상 환경에서 먼저 실행한다.
   READ ONLY 트랜잭션에서 객체/컬럼/함수 인자와 소유자/보안 설정/RLS/제약/인덱스/권한 메타데이터만 읽는다.
   적용 이력 테이블 존재 여부도 확인한다. 실제 이력 버전·이름은 배포 기록과 별도 대조한다.
2. 기존 게시판 객체가 하나라도 있으면 CREATE 후보를 실행하지 않는다. 실제 DDL/정책과 비교해 별도 차이 SQL을 검토한다.
3. 없는 환경에서 auth.users/auth.uid()/admin_users.user_id UUID 및 migration owner BYPASSRLS를 확인한다.
4. 보존 정책/별칭/영향 범위와 아래 롤백안을 승인받는다.
5. 승인된 테스트 Supabase에서 supabase/drafts/20261017_member_board_review.sql을 한 번 실행한다.
6. supabase/tests/member_board_access.sql 및 실제 JWT/SSR 통합 시나리오를 수행한다.
7. 결과를 검토하고 **별도 운영 적용 승인 후** 동일 SQL을 운영에 적용한다.

001_admin_users.sql을 운영에 재실행하거나 관리자 계정을 생성하지 않는다.
021~023 내부 게시판은 이 새 게시판의 선행 의존성이 아니다. 격리 회귀 테스트에서만 함께 적용한다.
후기/행사/프로필 초안도 게시판 활성화 때문에 실행하지 않는다.
기존 SQL 번호 중복을 이유로 운영 적용 이력이나 다른 팀 파일을 임의로 변경하지 않는다.

적용 후보에는 transaction, Auth/관리자 사전 조건, BYPASSRLS 소유자 확인,
6개 대상 객체 또는 member_board_ 접두 함수 존재 시 중단 검사를 추가했다.
기존 데이터를 덮어쓰거나 IF NOT EXISTS로 구조 차이를 숨기지 않는다.

## C. 글 작성·저장·조회

기존 SSR createClient → auth.getUser → 입력 검사 → member_board_mutate RPC 흐름을 유지했다.
author_id는 클라이언트에서 받지 않고 DB auth.uid()로 정한다.
일반 회원은 free/question만, 실제 admin_users 관리자는 notice를 작성한다.
유효한 UUID 저장 결과를 받은 뒤에만 상세 페이지로 이동한다.
DB 오류/불확실한 반환값은 성공 처리하지 않으며 기존 제어 폼 입력은 유지한다.

이번에는 오류 코드를 안전한 한국어/영어 안내로 구분했다:
미준비(PGRST202/205), 권한(42501), 동시 수정(40001), 과다 요청(P0003),
중복(23505), 입력 제약(23514/23502/22P02), 기타 장애.
SQL 원문·내부 오류 메시지·개인정보는 사용자에게 내보내지 않는다.
중복/불명확한 저장은 결과부터 확인하도록 안내한다.

로컬 SQL로 작성/조회/본인 수정/타인 차단/소프트 삭제를 확인했다.
실제 Supabase 로그인 및 영속 저장·브라우저 새로고침 연동은 미검증이다.

## D. 댓글

동일 RPC와 board_comments를 재사용한다. 본인 수정/삭제, 타인·비회원 차단,
비공개 부모 글에 쓰기 차단, 공개 댓글 수·검색에서 비공개 댓글 제외를 로컬 SQL로 확인했다.
서버 검증·버전 확인·폼 오류 시 입력 보존 코드를 유지했다.
실제 Supabase JWT로 댓글을 저장하고 새로고침하는 통합 검증은 미실행이다.

## E. 관리자 연동

공개/관리자 화면 모두 member_board_list/detail/mutate와 같은 6개 테이블을 사용한다.
관리자 화면의 admin 인자는 서버 getAdminAccess와 SQL admin_users 검사 모두를 통과해야 한다.
기존 내부 게시판은 internal_board_*와 별도 관리 함수를 계속 사용한다.
이번 작업은 기존 관리자 로그인/SSR/행사/회원가입 코드를 수정하지 않았다.

## F. 상단 고정

기존 pin RPC가 카테고리와 무관하게 관리자만 is_pinned를 변경한다.
DB 행 잠금·현재 수정 버전·사유와 관리자 조치 이력을 검증한다.
공개 목록은 status=public인 글만 is_pinned DESC 후 최신순으로 조회한다.
일반 글 고정/해제·여러 글 고정·숨김/삭제 제외·작성자의 고정 글 내용 수정을 격리 SQL로 검증했다.
원격 DB에서 고정 후 공개 화면 반영은 미검증이다.

## G. RLS·프로필·타 팀 영향

신규 대상:
- board_posts / board_comments / board_reports / board_moderation_logs
- board_aliases (Auth UUID와 공개 별칭의 비공개 매핑)
- board_view_days (회원별 일일 조회 중복 방지)

전부 ENABLE/FORCE RLS, 제한된 컬럼 권한, 검증된 SECURITY DEFINER RPC를 사용한다.
공개 응답에 Auth UUID/이메일/전화/생년월일을 포함하지 않는다.
프로필 테이블 없이 기존 Auth 회원으로 작성 가능하다. 공개 이름은 Member-무작위 코드다.
이를 실명/이메일/기존 행사 명단으로 대체하지 않았다. 별칭 운영 정책 승인이 필요하다.
신규 가입은 memberRegistrationPolicy=null로 계속 차단되어 있다.
기존 회원은 유효한 이메일·비밀번호 계정으로 로그인할 수 있는 코드 구조이나 실제 로그인은 하지 않았다.
관리자 권한 자동 등록/승격은 없다.

글/댓글 생성·작성자 수정은 제한된 직접 DML 정책이 있고 삭제/운영 변경은 검증 RPC의 소프트 삭제다.
일반 회원에게 보호 컬럼 변경·물리 DELETE·신고 처리/운영 이력 직접 쓰기를 허용하지 않는다.
숨김/삭제 글·댓글은 공개 조회/검색에서 제외한다.
6개 기간과 검색 범위/카테고리·관리자 작성자/고정 상태 조합, 공개 글 기반 키워드를 로컬 검증했다.

신규 Auth 외래키는 NO ACTION이므로 작성 이력이 있는 Auth 계정의 물리 삭제를 막을 수 있다.
다른 테이블을 변경하지 않아도 탈퇴 처리에 영향을 줄 수 있다는 점을 승인 전에 검토해야 한다.
신고 당시 원문/삭제 글/열람 기록 보관과 익명화 기간은 이 SQL에서 임의 확정하지 않았다.
기존 internal_board/Storage/admin_users/행사/신청/참여/프로필 구조를 변경하지 않는다.

## H. 이번 수정 파일

- src/lib/community-board-model.ts: 안전한 저장 실패 안내 함수.
- src/app/actions/community-board.ts: 기존 RPC 실패 안내를 코드별로 연결.
- supabase/drafts/20261017_member_board_review.sql: 수동 적용 후보 표시/사전 조건/중복 적용 중단.
- supabase/tests/member_board_preflight.sql (신규): 읽기 전용 메타데이터 점검.
- supabase/drafts/20261017_member_board_quarantine.sql (신규): 데이터 보존용 긴급 접근 차단.
- tests/community-board.test.mjs: 안전한 오류 구분 및 실패 시 성공/redirect/revalidate 차단.
- tests/community-board-db.mjs: preflight/중복 적용 중단/접근 차단·데이터 보존 회귀 검증.
- docs/member-board-activation.md (이 문서).
- docs/member-community-board.md: 최신 적용 진단 문서 연결.

기존 미완료 게시판/인증/화면 변경은 보존했다.
원격 진단용 임시 스크립트는 실행 후 삭제했다. 신규 앱 의존성은 설치하지 않았다.

## I. 검증 결과

- git diff --check: 통과.
- npm run lint: 통과, 기존 suggestions.ts 미사용 인수 경고 2개.
- npm run build: Next.js 16.4 빌드 및 44개 정적 생성 작업 통과.
  기본 Node20에 대한 기존 Supabase SDK 지원 종료 예정 경고는 남는다.
- 설치된 Node24로 node --test tests/*.test.mjs: **151개 통과**.
- Node24 tests/community-board-db.mjs: 격리 PGlite PostgreSQL 테스트 통과.
  기존 내부 게시판 SQL과 함께 적용, CRUD/RLS/타인 차단/댓글/신고/이력/검색/기간/고정/조회수 검증.
  넓은 기본 권한 조건에서도 보호 컬럼·물리 삭제·관리자 변경이 차단된다.
  preflight READ ONLY 실행, 중복 CREATE 중단 후 기존 데이터 보존,
  긴급 접근 차단 뒤 익명/일반/관리자 API·직접 컬럼 접근 차단과 내부 게시판 유지 검증.
- 실제 연결에 대한 읽기 진단만 수행했다. 운영 테스트 글·댓글·Auth 계정을 생성하지 않았다.
- 이번 작업에서 새 브라우저 인증·CRUD 테스트는 수행하지 않았다.
  과거 UI 모의 테스트 통과를 실제 DB 통합 테스트로 계산하지 않는다.

## J. 승인 범위·데이터 보존·롤백

승인 요청 대상은 위 적용 후보의 **6개 신규 테이블, 관련 함수·트리거·인덱스·정책·최소 권한**이다.
승인 전 실제 객체/적용 이력, 함수 소유자 BYPASSRLS, 별칭, Auth 계정 삭제,
삭제/신고 원문/열람 기록 보관 및 백업 정책을 확인해야 한다.
환경변수 값이나 계정 비밀번호를 대화에 공유할 필요는 없다.
현재 앱의 공개 키로는 DDL/메타데이터 관리자 검토를 대신할 수 없다.

적용 전: 대상 프로젝트와 승인 SQL 버전/해시를 확인하고 기존 스키마·권한 및 관련 데이터를 백업한다.
부분 실패: 적용 SQL의 BEGIN/COMMIT 트랜잭션 전체를 ROLLBACK한다.
커밋 후 장애:
1. 게시판 사용을 중지하고 새 6개 테이블 및 권한·함수 정의를 먼저 백업한다.
2. 운영자의 별도 승인으로 quarantine SQL을 실행해 anon/authenticated/PUBLIC의
   테이블·독립 컬럼 권한 및 게시판 함수 EXECUTE를 회수한다.
3. 테이블/데이터/FK/운영 이력을 보존한다. 앱은 다시 준비/연결 실패 안내를 표시한다.
4. DB 담당 migration owner/service role의 관리 접근 자체를 회수하는 SQL은 아니다.
5. 원인 수정 후 검토된 권한만 복구하고 RLS 및 실제 JWT 테스트 후 재개한다.
6. CREATE 전체 SQL을 재실행해 복구하지 않는다. DROP/CASCADE로 데이터를 지우지 않는다.

quarantine은 스키마 역마이그레이션이 아닌 긴급 접근 차단안이다.
데이터 보존 시 Auth FK의 계정 삭제 영향도 남는다. 객체 완전 제거는 보존/의존성 정책을 정한 뒤 별도 승인한다.
스키마 캐시 미반영만 원인이라면 담당자가 실제 객체 일치 여부부터 확인하고 새 CREATE 적용을 중단해야 한다.

## K. 실제 DB 통합 미완료

승인된 테스트 Supabase 및 기존 일반 회원 2명/관리자 테스트 세션이 아직 제공·확인되지 않았다.
따라서 실제 JWT 로그인, Auth 쿠키 갱신, 작성/새로고침 유지/본인 수정·삭제/타인 공격,
댓글, 관리자 동일 데이터 조회/고정/숨김/신고, 검색/기간/키워드 한영 화면,
관리자·행사 회귀를 실제 연결 환경에서 수행하지 못했다.
실서비스 활성화가 완료되었다고 보고하지 않는다.
