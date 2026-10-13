# 관리자 인증 설정과 확인

Supabase 공식 Next.js SSR 문서를 기준으로 쿠키 기반 인증을 사용합니다.
환경변수 값, 비밀번호, 세션 토큰을 공유하거나 로그에 기록하지 마세요.

## SQL 적용

1. Supabase SQL Editor에서 `supabase/001_admin_users.sql` 전체를 실행합니다.
   새 테이블을 만드는 최초 설정용 SQL이므로 이미 생성했다면 반복 실행하지 않습니다.
2. Supabase Authentication > Users에서 기존 로그인 계정의 User UID(UUID)를 복사합니다.
3. 먼저 해당 계정으로 로그인하여 관리자 미등록 접근 거부가 표시되는지 확인합니다.
4. `supabase/002_first_admin.sql`의 `YOUR_AUTH_USER_UUID_HERE`만 실제 User UID로 바꾸어 SQL Editor에서 실행합니다.
   실제 UUID를 저장소 파일에 기록할 필요는 없습니다. 이메일이나 프로젝트 ID를 넣지 않습니다.
5. `/admin`을 새로고침하고 관리자 이메일과 대시보드를 확인합니다.

앱은 Publishable key만 사용합니다. 관리자 추가/수정/삭제는 앱 사용자가 수행할 수 없습니다.
SQL Editor에서 관리자 권한으로 등록합니다. RLS는 authenticated 사용자가 자기 UUID 행만 읽도록 제한합니다.
권한 조회 실패나 테이블 미생성 시에도 관리자 화면은 제공되지 않습니다.
향후 운영 데이터 테이블에는 별도의 관리자 RLS 정책과 서버 권한 검사가 필요합니다.

## 로그인 테스트 순서 (실제 계정 테스트는 사용자가 수행)

- 시크릿 창에서 `/admin` 직접 접근 → `/login` 이동.
- 잘못된 비밀번호 → 로그인 실패 안내; 처리 중 버튼 비활성화.
- 관리자 등록 전 로그인 → 접근 거부.
- 관리자 등록 후 로그인 → 대시보드와 실제 이메일 표시.
- 새로고침 → 쿠키 기반 로그인 유지.
- 관리자 아닌 별도 계정 로그인 → 접근 거부.
- 로그아웃 → `/login` 이동; `/admin` 재접근 → 로그인 화면.
- 등록 삭제 후 `/admin` 새로고침 → 접근 거부.
- 테스트 환경에서 권한 조회 실패 → 접근 거부.
- 두 별도 계정으로 RLS 조회 → 각각 자기 등록 행만 조회; INSERT/UPDATE/DELETE는 거부.
- 운영 빌드에서 `/preview/admin` → 404; 개발 환경에서만 미리보기 제공.

## 로컬 빌드

개발 서버는 유지하고 새 Mac 터미널에서 실행합니다.

```sh
cd /Users/masonsmacbookair/Projects/malmoim-admin
npm run lint
npx tsc --noEmit --incremental false
npm run build
echo "빌드 종료 코드: $?"
```

종료 코드 0과 페이지 생성 완료를 확인해야 빌드 검증 완료로 판단합니다.
