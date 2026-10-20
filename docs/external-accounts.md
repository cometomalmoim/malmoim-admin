# 외부 서비스 계정 관리 설정

1. Supabase SQL Editor에서 `018_schedule_management.sql`과 관리자 테이블이 적용된 환경에 `supabase/022_external_accounts.sql` 전체를 실행합니다. `022_board_idea_category.sql`과 별개인 마이그레이션입니다. 기존 역할을 자동으로 Master로 승격하지 않습니다.
2. SQL Editor에서 실제 운영진 UUID를 확인하고 권한을 명시적으로 등록합니다. 앱 사용자는 이 테이블을 수정할 수 없습니다.

```sql
insert into public.external_account_members(user_id, role, department)
values ('실제 관리자 UUID', 'master', '회장단');
-- 일반 운영진은 role='staff'와 실제 부서명을 지정합니다.
```

3. 서버 환경에 `EXTERNAL_ACCOUNTS_ENCRYPTION_KEY`를 설정합니다. 암호학적 난수 32바이트의 64자리 hex 문자열이며 `NEXT_PUBLIC_` 접두사를 사용하면 안 됩니다. 예: `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. 키는 비밀 관리 저장소에 별도 백업합니다. 키 교체 시 기존 비밀번호를 이전 키로 복호화 후 새 키로 재암호화하는 별도 운영 절차가 필요합니다. 키를 단순 교체하면 기존 비밀번호를 열 수 없습니다.
4. Master 사용자는 상세 패널의 ‘MFA 인증기 최초 등록’에서 인증기를 연결합니다. 열람/복사마다 새로운 TOTP 코드를 입력합니다. 서버의 MFA 확인과 DB의 AAL2·60초 이내 TOTP 확인을 모두 통과해야 합니다. DB는 동일 인증 시각을 한 번만 소비하여 세션 재사용을 차단합니다. Supabase가 인증 코드 시도 제한을 적용합니다. [Supabase MFA](https://supabase.com/docs/guides/auth/auth-mfa/totp), [JWT claims](https://supabase.com/docs/guides/auth/jwt-fields).

Staff는 같은 부서 또는 1차/2차 담당자로 지정된 계정의 메타데이터와 감사 기록만 읽을 수 있습니다. 비밀번호 열람·복사와 모든 변경은 Master만 가능합니다. 인증 키와 암호문은 브라우저의 목록/폼에 전달하지 않습니다. 열람된 비밀번호는 15초 후 또는 탭 이탈 시 화면에서 숨깁니다. 클립보드는 OS 관리 영역이며 자동 삭제하지 않습니다. 복사 기록은 비밀번호 전달 시점에 남으므로 브라우저의 클립보드 쓰기 실패도 기록에 포함될 수 있습니다.

`external_account_renewals` 뷰는 `external_account_id`, `title`, `starts_on`, `assignee_id`, `renewal_notice_days`, `amount`, `currency`를 제공하며 원본 테이블 RLS가 그대로 적용됩니다. 추후 스케줄 연동에서 이 뷰를 사용하면 됩니다. 현재 스케줄에 일정을 자동 생성하지 않습니다. 갱신일은 운영진이 실제 구독 상태에 맞게 갱신합니다. 결제 수단에는 카드 별칭/끝 4자리만 저장하세요.

감사 기록은 계정 삭제 후에도 유지하며 비밀번호 원문·암호문을 포함하지 않습니다. 상세 패널에는 선택 계정의 최근 100건을 표시합니다. 더 오래된 기록은 DB에서 Master가 조회할 수 있습니다. 운영 DB에 이 스크립트를 자동 실행하지 않습니다.

검증: `node --test tests/external-accounts.test.mjs`, `node tests/external-accounts-db.mjs` (기존 `work/sql` PGlite 캐시 필요), `npm run lint`, `npx tsc --noEmit`, `npm run build`.
