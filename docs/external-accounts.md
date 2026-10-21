# 외부 서비스 계정 관리: 초기 운영 정책

현재 정책은 어드민에 등록된 모든 Admin/Staff에게 전체 계정 조회·등록·수정 및 MFA 없는 비밀번호 보기·복사를 허용합니다. 일반 회원 로그인이나 익명 사용자는 접근할 수 없습니다. 046 적용 후 삭제도 모든 Admin/Staff에게 허용합니다.

| 작업 | Admin/Staff | Master |
|---|---|---|
| 모든 계정 조회, 신규 등록, 기존 계정 수정 | 허용 | 허용 |
| 비밀번호 보기·복사 | MFA 없이 허용, 매번 감사 기록 | 동일 |
| 계정 삭제 | 허용, 감사 기록 보존 | 허용, 감사 기록 보존 |
| 암호문 직접 조회, 테이블 직접 쓰기·감사 로그 조작 | 불가 | 불가 |

## 적용 순서

### 저장 오류 및 기존 DB 복구

현재 연결 DB에서 `42703: column external_accounts.created_by does not exist`가 확인된 경우 043 이후 스키마가 누락된 상태입니다. 키 설정과 서버 재시작만으로는 해결되지 않습니다. **같은 프로젝트의 Supabase SQL Editor에서 `supabase/manual/repair_external_accounts.sql` 전체를 실행**하세요. 이 스크립트는 022/043/044를 현재 초기 운영 정책으로 맞추며 기존 계정·암호문·등록자·감사 기록을 삭제하지 않습니다. 여러 번 실행할 수 있고 PostgREST 스키마 캐시 갱신도 요청합니다. 복구 스크립트 적용 후 최신 정책을 위해 045→046을 순서대로 다시 적용하세요. 관리자/스케줄 기반 테이블은 기존 설치를 사용합니다.

`npm run check:external-accounts`로 현재 `.env.local`이 가리키는 프로젝트의 공개 API 스키마를 점검할 수 있습니다. 익명·0행 조회와 항상 실패하는 잘못된 작업 요청만 사용하며 계정을 만들거나 비밀번호를 조회하지 않습니다. `42703`, `PGRST202/205` 등은 누락/불일치입니다. 익명 요청의 `42501`은 보호된 객체의 정상적인 권한 거부이며 이를 해결하려고 **anon 권한을 추가하면 안 됩니다.** 이 검사로 인증된 저장 성공이나 최신 RPC 내부 권한까지 확정할 수는 없습니다.

저장 RPC 실패 시 서버 터미널에 `[external-accounts] Database operation failed`와 참조 번호, 작업 종류, DB `code/message/details/hint`가 출력됩니다. 비밀번호·암호문·실패 행의 값·키 충돌 값은 숨깁니다. 클라이언트에는 원문 DB 오류 대신 참조 번호와 오류 종류에 맞는 안내만 표시합니다. 선택 결제 필드는 기본값을 적용하고 날짜·금액·담당자 UUID·필드 길이는 RPC 호출 전에 검증합니다.

1. 관리자 및 `018_schedule_management.sql` 적용 환경에 `022_external_accounts.sql` → `043_external_account_creation.sql` → `044_external_account_initial_access.sql` → `045_external_account_people.sql` → `046_external_account_admin_delete.sql` 순서로 실행합니다. 기존 045 설치 환경에는 046만 추가 적용합니다. 045는 피플 테이블(019)이 필요합니다. `022_board_idea_category.sql`은 별개입니다.
2. 개발 환경에서는 `npm run setup:external-accounts`를 실행합니다. `.env.local`의 기존 설정과 유효한 키를 보존하며 누락/빈 값에만 32바이트 무작위 키를 64자리 hex로 설정합니다. 값은 출력하지 않습니다. 실제 이름은 복수형 **`EXTERNAL_ACCOUNTS_ENCRYPTION_KEY`**이며 `NEXT_PUBLIC_` 접두사를 붙이면 안 됩니다. 변경 후 개발 서버를 재시작하세요.
3. 관리자 기준은 기존 `admin_users`입니다. 사용자를 Master로 자동 승격하거나 기존 인증기를 삭제하지 않습니다. `external_account_members`는 이전 정책의 역할 기록을 보존하며, 담당자 후보는 피플의 `people` 테이블에서 조회합니다.

개발/테스트에서 키가 누락되면 암호화 모듈은 프로젝트 루트의 `.env.external-accounts.key`에 로컬 전용 무작위 키를 한 번 생성해 재사용합니다. 이 파일과 `.env.local`은 Git에서 제외되며 로컬 키 파일은 배포 파일 추적에서도 제외합니다. 공용 기본 키나 요청마다 바뀌는 임시 키를 사용하지 않습니다. 잘못된 기존 환경 변수나 손상된 로컬 키 파일은 자동 교체하지 않고 오류로 처리합니다.

운영 환경에서는 자동 fallback을 사용하지 않습니다. 호스팅 서버의 비밀 환경 변수에 위 이름으로 유효한 키를 설정해야 합니다. 누락·형식 오류·파일 권한 오류는 키 값 없이 서버 `console.error`에 원인을 기록합니다. 같은 DB를 사용하는 모든 서버와 개발 환경은 같은 키를 사용해야 하며, 기존 암호문이 있다면 새 키를 생성하기 전에 기존 키를 복원해야 합니다. 키는 별도 비밀 저장소에 백업하세요. 키 교체에는 기존 키로 복호화 후 재암호화하는 절차가 필요합니다.

암호화는 Next.js 서버의 AES-256-GCM으로 수행하며 `manage_external_account`에는 암호문만 전달합니다. 현재 구조는 Supabase Vault/Edge Functions Secret을 조회하지 않으므로 관련 SQL Secret 설정이나 새 DB 마이그레이션은 필요하지 않습니다. `ALTER DATABASE ... app.settings.encryption_key`를 설정해도 이 코드의 키로 사용되지 않습니다.

## UI와 감사 기록

4:6 Split-View를 사용합니다. 좌측 목록은 파비콘·서비스명·단일 담당자·결제 D-Day만 표시하고 검색은 서비스명/계정 ID/담당자명에 적용합니다. 구독 없음 또는 결제일 누락 시 결제 배지를 표시하지 않습니다. 결제일이 있으면 모든 남은 일수를 표시하고 알림 기간 안에서는 경고 색상을 사용합니다.

초기에는 상세를 선택하지 않습니다. 카드 클릭 시 조회 모드로 열리며 모든 폼 필드는 비활성화됩니다. 서비스 바로가기 옆 ‘닫기’는 선택을 해제하고 목록으로 포커스를 돌려줍니다. 우측 하단 ‘수정’으로 편집을 시작하면 ‘저장/취소’가 표시됩니다. 취소는 입력을 초기화하고 조회로 돌아가며, 실패 시 편집 내용은 유지합니다. 편집 시작 시점의 수정 버전을 고정하여 중간 재조회로 동시 수정 검사가 우회되지 않게 합니다. 비밀번호 보기/복사는 조회 모드에서도 사용할 수 있습니다.

`+ 새 계정 등록`은 편집 가능한 등록 슬라이드오버를 엽니다. 성공 시 닫고 검색을 초기화해 목록을 재조회하며, 상세는 사용자가 카드를 클릭해야 열립니다. 저장 중에는 닫기를 차단합니다.

카테고리·공유 부서·백업 담당자·결제 수단/카드 별칭은 UI와 검색·아이콘 분기에서 제거했습니다. 담당자는 `manager_person_id`로 피플의 `people.id`에 연결합니다. 기존 미연결 계정에는 이전 `primary_manager` 담당자를 표시하며 그대로 저장하면 유지됩니다. 피플 담당자를 선택하거나 미지정으로 변경하면 이전 연결을 대체하고 감사 기록에 변경 이력을 남깁니다. 기존 DB 컬럼과 값은 기록 보존을 위해 유지하며, 편집 시 서버가 기존 값을 읽어 보존합니다. 클라이언트에서 이 제거된 필드를 전달해도 변경되지 않습니다. 신규 계정은 category=other, department/payment_method='', primary_manager/sub_manager=NULL로 저장합니다. 담당자 연결을 위해 045 마이그레이션을 적용해야 합니다. 과거 감사 기록에서도 해당 필드의 변경 세부 표시는 생략하며 원본 로그는 DB에 보존합니다.

비밀번호는 기본 마스킹하며 ‘보기’ 또는 ‘복사하기’를 누르면 추가 인증 없이 요청합니다. 서버와 DB에서 관리자 여부를 확인하고, DB가 열람 기록을 저장한 뒤 서버에서 복호화합니다. 원문·암호문은 일반 목록과 감사 로그에 포함하지 않습니다. 보기는 숨기기로 전환되며 수동으로 다시 마스킹할 수 있습니다. 15초 후 또는 창 포커스 이탈 시에도 숨깁니다. 클립보드는 OS 관리 영역이므로 자동 삭제하지 않습니다. 브라우저의 복사 실패도 비밀번호 전달 시점에 기록된 copy 로그에 포함될 수 있습니다.

`created_by`는 DB의 `auth.uid()`로 자동 기록하며 클라이언트 위조나 수정으로 바뀌지 않습니다. 감사 이력에는 작업자·시각·수정 전후 값·비밀번호 변경 여부가 남고 계정 삭제 후에도 보존됩니다. 직접 테이블 UPDATE는 계속 차단하며 감사 기록과 동시 수정 검사를 수행하는 RPC로만 수정합니다. UI는 계정별 최근 100건을 표시합니다.

목록(24px)과 상세 제목(32px)의 파비콘은 공개 도메인만 Google Favicon Service에 전달합니다. 경로·쿼리·로그인 정보는 전달하지 않으며 URL 누락, 내부 주소 또는 이미지 오류 시 기본 아이콘을 표시합니다.

`external_account_renewals`는 갱신일·담당자·금액을 제공하는 스케줄 연동용 뷰입니다. 일정 자동 생성이나 알림 발송은 하지 않습니다. 결제 수단에는 카드 별칭/끝 4자리만 저장합니다.

## 이전 정책 복원

`supabase/rollback/044_external_account_initial_access.sql`은 데이터를 삭제하지 않고 043의 부서/담당자 조회 범위, Master 수정·열람, TOTP 인증 및 일회성 소비 정책을 복원합니다. SQL과 함께 044 도입 전 앱의 UI/서버 액션도 복원해야 합니다. 현재 앱은 MFA 코드를 입력받지 않으므로 DB만 복원하면 비밀번호 요청이 실패합니다. 기존 인증기와 `external_account_mfa_uses` 데이터는 유지합니다.

## 검증

`node --test tests/external-accounts.test.mjs tests/external-account-favicon.test.mjs tests/external-account-registration.test.mjs tests/external-account-creation-actions.test.mjs`

`node tests/external-account-initial-access-db.mjs`는 022→043→044 설치, Staff/Admin 전체 조회·수정·MFA 없는 보기/복사, 감사 기록, 비관리자 차단, Master 전용 삭제, 동시 수정 차단, 등록자 유지, 이전 정책 복원과 044 재적용을 검사합니다. 기존 `work/sql` PGlite 캐시를 사용합니다. 022/043 당시의 권한은 기존 `external-accounts-db.mjs`, `external-account-creation-db.mjs`에서도 별도로 검증합니다.

`node --test tests/external-account-key.test.mjs`는 키 생성·재사용, 초기화 스크립트 재실행과 기존 설정 보존, 잘못된 키/운영 환경 누락 시 안전한 오류를 검사합니다. `node tests/external-account-encryption-registration-db.mjs`는 실제 AES 암호화→Staff 계정 등록→키 재로드→복호화와 감사 기록을 검증합니다.

테스트는 합성 세션과 일회용 로컬 DB를 사용합니다. 실제 운영 로그인이나 운영 DB 변경은 수행하지 않습니다. 운영 적용 전 SQL 순서와 암호화 키 설정을 확인해야 합니다.

UI 개편 회귀 검증: `node --test tests/external-account-panel.test.mjs tests/external-account-list.test.mjs tests/external-account-registration.test.mjs tests/external-account-creation-actions.test.mjs tests/external-account-save.test.mjs`. 선택/닫기, 조회→수정→취소/저장, 실패 시 입력 유지, 검색 범위와 결제 배지 조건, 제거된 DB 값의 보존을 검사합니다.

## 삭제·담당자·반복 결제일 개선 (045)

모든 관리자는 수정 모드 하단 ‘계정 삭제’에서 확인창 승인 후 삭제할 수 있습니다. 성공하면 상세를 닫고 목록을 재조회하며 성공 토스트를 표시합니다. 046 적용 후 모든 Admin/Staff가 동일하게 삭제할 수 있습니다. 감사 이력은 삭제 이후에도 보존됩니다.

피플 프로필은 로그인 계정과 독립적입니다. `supabase/045_external_account_people.sql` 전체를 Supabase SQL Editor에서 실행하세요. 기존 계정·비밀번호·담당자 기록을 삭제하지 않습니다. `manager_person_id`는 people 외래키이며 프로필 삭제 시 NULL로 변경됩니다. 등록/수정 RPC의 감사 기록에도 해당 필드 변경이 남습니다.

목록 카드는 동일 높이이며 결제 배지는 우측에 표시합니다. 과거 결제 기준일은 월/연 주기를 따라 오늘 이후의 가장 가까운 예정일로 계산하며 오늘은 D-0입니다. 월말은 해당 월의 말일로 조정하되 원래 기준일을 유지합니다. 윤년 2월 29일은 평년 2월 28일로 계산합니다. 계산은 목록 표시용이며 DB 기준일과 스케줄 뷰는 자동 변경하지 않습니다.

추가 DB 검증: `node tests/external-account-people-db.mjs` (045 반복 적용, 피플 담당자 외래키·변경 감사, Staff 삭제 차단, Master 삭제·암호문 정리·감사 보존).

## 컴팩트 상세 폼과 전체 관리자 삭제 (046)

`supabase/046_external_account_admin_delete.sql`을 SQL Editor에서 실행합니다. 관리자 allow-list인 `admin_users` 검사는 유지하고, 삭제에 대한 Master 전용 검사만 제거합니다. 직접 테이블 쓰기는 여전히 차단하며 RPC에서 버전 검증·암호문 삭제·감사 로그 저장을 트랜잭션으로 처리합니다. 서버 액션과 UI도 동일하게 Admin/Staff 삭제를 허용합니다.

담당자 선택은 `people.status='active'` 조회 결과만 사용합니다. 현재 연결된 비활동 프로필은 표시용으로만 보존하고 드롭다운에서는 선택 불가 안내로 표시합니다. 해당 필드를 바꾸지 않고 다른 정보를 저장해도 기존 연결은 유지됩니다. DB는 비활동 프로필로의 신규 연결을 거부합니다.

상세 폼은 서비스명/URL → ID/새 비밀번호 → 담당자/갱신 알림 → 결제 주기/금액 → 통화/결제일 순서의 2열이며 메모는 전체 폭입니다. 단일 입력 높이는 34px, 매우 좁은 화면에서는 한 열로 전환합니다. 조회 모드는 비활성 입력을 유지하고 수정 모드 하단에 계정 삭제·저장·취소를 표시합니다.

검증: `node tests/external-account-admin-delete-db.mjs`는 045→046 반복 적용, Staff/Admin/Master 삭제 및 감사 보존, 비관리자 차단, 비활동 담당자 신규 연결 차단을 검증합니다. 과거 정책 DB 테스트는 해당 마이그레이션 시점의 Master 삭제 제한을 계속 검증합니다.

## 프로덕션 배포 설정과 오류 진단

키는 `src/lib/external-account-key.mjs`의 `resolveExternalAccountKey()`가 **Next.js 서버 실행 시** `process.env.EXTERNAL_ACCOUNTS_ENCRYPTION_KEY`에서 읽습니다. `src/lib/external-account-crypto.ts`의 암호화/복호화가 같은 함수를 사용합니다. 단수형 `EXTERNAL_ACCOUNT_ENCRYPTION_KEY`, `ACCOUNT_SECRET_KEY`, Supabase Vault와 Edge Functions Secret은 조회하지 않습니다. 키를 `next.config`의 공개 env 설정이나 클라이언트 변수로 옮기지 마세요.

### 배포 서버의 필수 설정

- `EXTERNAL_ACCOUNTS_ENCRYPTION_KEY`: 32바이트를 표현하는 정확히 64자리 hex(0–9, a–f). 앞뒤 공백은 제거하지만 base64, 접두사 `0x`, 따옴표를 값에 포함하면 안 됩니다.
- `NEXT_PUBLIC_SUPABASE_URL`: 실제 배포 대상 프로젝트 URL.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: 같은 프로젝트의 publishable key. 암호화 키와 별개입니다. 이 기능에 service-role key는 필요하지 않습니다.

기존 암호문이 있으면 **그 데이터를 암호화한 기존 키를 사용**해야 합니다. `.env.local`에서 유효하게 설정한 키가 우선이며, 개발 환경에서 변수를 사용하지 않았다면 `.env.external-accounts.key`가 원본입니다. 두 파일은 gitignored 상태이므로 Git merge나 Next.js 빌드 성공만으로 운영 서버에 전달되지 않습니다. 같은 DB를 사용하는 개발·Preview·Production 인스턴스는 동일한 키를 사용해야 합니다.

### Vercel 설정 순서

1. 실제 어드민 도메인이 연결된 Vercel 프로젝트에서 Settings → Environment Variables를 엽니다.
2. `EXTERNAL_ACCOUNTS_ENCRYPTION_KEY` 이름으로 기존 키를 비밀 값으로 등록하고 Production 범위를 선택합니다. 가능한 경우 Sensitive를 활성화합니다. Preview가 같은 DB를 사용하면 Preview 범위에도 동일한 키를 등록합니다.
3. Supabase URL과 publishable key가 올바른 프로젝트를 가리키는지 확인합니다.
4. Production을 다시 배포하고 Ready 상태가 된 새 배포가 실제 도메인에 연결됐는지 확인합니다. 기존 배포에는 환경 변수 수정이 반영되지 않습니다.
5. 해당 배포의 서버 Runtime/Function Logs에서 아래 메시지가 더 이상 발생하지 않는지 확인하고, 기존 계정의 비밀번호 보기와 새 계정 저장을 확인합니다. 키나 비밀번호를 로그로 출력하지 마세요.

다른 호스팅 플랫폼도 Next.js Node.js 서버 프로세스의 비밀 환경 변수에 같은 이름을 설정한 뒤 서버를 재시작하거나 재배포합니다. 이 프로젝트의 암호화는 DB 내부가 아니라 Next.js에서 실행되므로 Vault Secret이나 SQL `ALTER DATABASE`만 설정해서는 해결되지 않습니다.

공식 문서: [Vercel 환경 변수 관리](https://vercel.com/docs/environment-variables/managing-environment-variables), [Sensitive 환경 변수](https://vercel.com/docs/environment-variables/sensitive-environment-variables).

### 오류별 구분

- 누락/빈 값: 서버 로그에 `[external-accounts] EXTERNAL_ACCOUNTS_ENCRYPTION_KEY: missing (undefined 또는 empty); 프로덕션 환경 변수 [EXTERNAL_ACCOUNTS_ENCRYPTION_KEY]이 설정되지 않았습니다.`와 배포 설정 안내가 남습니다. 화면에도 변수명과 재배포 안내를 표시합니다. 운영에서는 로컬 키 파일을 읽거나 임의 키를 생성하지 않습니다.
- 형식 오류: 서버 로그에 `invalid format`과 64자리 hex 요구 조건을 기록하고 화면에도 형식 오류를 표시합니다. 잘못된 값 자체는 기록하지 않습니다.
- 유효한 형식인데 기존 비밀번호만 복호화 실패: 기존 암호화 키와 배포 키가 다를 수 있습니다. 기존 키 백업과 DB 연결 대상을 확인하세요. 키를 새로 생성하거나 기존 암호문을 덮어쓰면 복구가 어려워집니다.

이 변경은 키 누락을 안전한 기본 키로 우회하지 않습니다. 정상 운영 복구에는 배포 환경에 기존 키를 등록하는 절차가 필요합니다. 새 SQL 마이그레이션은 필요하지 않습니다.
