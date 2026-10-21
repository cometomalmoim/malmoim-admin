# 외부 서비스 계정 관리: 초기 운영 정책

현재 정책은 어드민에 등록된 모든 Admin/Staff에게 전체 계정 조회·등록·수정 및 MFA 없는 비밀번호 보기·복사를 허용합니다. 일반 회원 로그인이나 익명 사용자는 접근할 수 없습니다. 삭제는 기존 Master 전용 정책을 유지합니다.

| 작업 | Admin/Staff | Master |
|---|---|---|
| 모든 계정 조회, 신규 등록, 기존 계정 수정 | 허용 | 허용 |
| 비밀번호 보기·복사 | MFA 없이 허용, 매번 감사 기록 | 동일 |
| 계정 삭제 | 불가 | 허용, 감사 기록 보존 |
| 암호문 직접 조회, 테이블 직접 쓰기·감사 로그 조작 | 불가 | 불가 |

## 적용 순서

1. 관리자 및 `018_schedule_management.sql` 적용 환경에 `022_external_accounts.sql` → `043_external_account_creation.sql` → `044_external_account_initial_access.sql` 순서로 실행합니다. 기존 022/043 설치 환경에는 044만 추가 적용합니다. `022_board_idea_category.sql`은 별개입니다.
2. 서버에 `EXTERNAL_ACCOUNTS_ENCRYPTION_KEY`를 설정합니다. 암호학적 난수 32바이트의 64자리 hex 비밀 값이며 `NEXT_PUBLIC_` 접두사를 사용하지 않습니다. 예: `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. 키를 별도 비밀 저장소에 백업해야 합니다. 단순 교체하면 기존 비밀번호를 열 수 없으며 이전 키로 복호화·재암호화하는 별도 절차가 필요합니다.
3. 관리자 기준은 기존 `admin_users`입니다. 사용자를 Master로 자동 승격하거나 기존 인증기를 삭제하지 않습니다. `external_account_members`는 담당자 후보 및 삭제 권한에 계속 사용하며 모든 관리자가 담당자 후보를 조회할 수 있습니다.

## UI와 감사 기록

4:6 Split-View의 검색·카테고리 필터·갱신일 경고·담당자 선택을 제공합니다. `+ 새 계정 등록`은 슬라이드오버를 엽니다. 성공 시 검색/필터를 초기화하고 새 계정을 선택해 재조회하며 실패 시 입력을 유지합니다. 저장 중에는 닫기를 차단합니다.

비밀번호는 기본 마스킹하며 ‘보기’ 또는 ‘복사하기’를 누르면 추가 인증 없이 요청합니다. 서버와 DB에서 관리자 여부를 확인하고, DB가 열람 기록을 저장한 뒤 서버에서 복호화합니다. 원문·암호문은 일반 목록과 감사 로그에 포함하지 않습니다. 보기는 15초 후 또는 창 포커스 이탈 시 숨깁니다. 클립보드는 OS 관리 영역이므로 자동 삭제하지 않습니다. 브라우저의 복사 실패도 비밀번호 전달 시점에 기록된 copy 로그에 포함될 수 있습니다.

`created_by`는 DB의 `auth.uid()`로 자동 기록하며 클라이언트 위조나 수정으로 바뀌지 않습니다. 감사 이력에는 작업자·시각·수정 전후 값·비밀번호 변경 여부가 남고 계정 삭제 후에도 보존됩니다. 직접 테이블 UPDATE는 계속 차단하며 감사 기록과 동시 수정 검사를 수행하는 RPC로만 수정합니다. UI는 계정별 최근 100건을 표시합니다.

목록(24px)과 상세 제목(32px)의 파비콘은 공개 도메인만 Google Favicon Service에 전달합니다. 경로·쿼리·로그인 정보는 전달하지 않으며 URL 누락, 내부 주소 또는 이미지 오류 시 기본 아이콘을 표시합니다.

`external_account_renewals`는 갱신일·담당자·금액을 제공하는 스케줄 연동용 뷰입니다. 일정 자동 생성이나 알림 발송은 하지 않습니다. 결제 수단에는 카드 별칭/끝 4자리만 저장합니다.

## 이전 정책 복원

`supabase/rollback/044_external_account_initial_access.sql`은 데이터를 삭제하지 않고 043의 부서/담당자 조회 범위, Master 수정·열람, TOTP 인증 및 일회성 소비 정책을 복원합니다. SQL과 함께 044 도입 전 앱의 UI/서버 액션도 복원해야 합니다. 현재 앱은 MFA 코드를 입력받지 않으므로 DB만 복원하면 비밀번호 요청이 실패합니다. 기존 인증기와 `external_account_mfa_uses` 데이터는 유지합니다.

## 검증

`node --test tests/external-accounts.test.mjs tests/external-account-favicon.test.mjs tests/external-account-registration.test.mjs tests/external-account-creation-actions.test.mjs`

`node tests/external-account-initial-access-db.mjs`는 022→043→044 설치, Staff/Admin 전체 조회·수정·MFA 없는 보기/복사, 감사 기록, 비관리자 차단, Master 전용 삭제, 동시 수정 차단, 등록자 유지, 이전 정책 복원과 044 재적용을 검사합니다. 기존 `work/sql` PGlite 캐시를 사용합니다. 022/043 당시의 권한은 기존 `external-accounts-db.mjs`, `external-account-creation-db.mjs`에서도 별도로 검증합니다.

테스트는 합성 세션과 일회용 로컬 DB를 사용합니다. 실제 운영 로그인이나 운영 DB 변경은 수행하지 않습니다. 운영 적용 전 SQL 순서와 암호화 키 설정을 확인해야 합니다.
