# 회원가입·개인정보·닉네임 구현 결과 (2026-10-20)

2026-10-21 UX 갱신: 가입 화면의 전문 보기를 공통 모달로 전환했습니다. 현재 UI와 추가 테스트 결과는 [모달 UX 개선 기록](member-legal-modal-ux.md)을 참고하세요. 아래 테스트 결과는 최초 구현 시점의 기록입니다.

## 1. 완료 기능과 공개 상태

한국어·영어 개인정보 페이지 구조, 가입 안내/동의 UI, 필수 닉네임, 만 19세 검증, 문서 버전 확인, 서버/DB 중복 방지 초안, 공개 작성자 표시를 구현했습니다. 실제 가입은 기존과 같이 차단되어 있습니다. 미승인 법률 문서나 임의의 연락처·기간·리전은 공개하지 않았습니다.

`publishedMemberLegal=null`, `memberRegistrationPolicy=null` 두 코드 게이트와 DB readiness 게이트를 둡니다. 서버 액션은 정책 미승인 시 Auth 클라이언트 생성 전에 종료합니다. 입력 확인 모드에서는 개인 입력값을 서버로 보내지 않고 locale만 보냅니다. 로그인·기존 세션·게시판 이용은 이 가입 게이트와 별개입니다. 소스 코드의 차단은 Supabase Auth의 외부 직접 가입 API까지 막는 설정이 아닙니다. 운영자는 아래 Auth 신규 가입 설정도 확인해야 합니다.

## 2. 수정·추가 파일

| 역할 | 파일 |
| --- | --- |
| 개인정보 페이지·메타데이터 | `src/app/(public)/privacy/page.tsx`, `src/app/(english)/en/privacy/page.tsx`, `src/components/member-privacy-page.tsx`, `src/components/member-privacy.css` |
| 다국어 경로·푸터 | `src/lib/public-locale.ts`, `src/components/public-frame.tsx` |
| 법률 문서 모델·가입 UI | `src/lib/member-legal.ts`, `src/components/signup-legal-notice.tsx`, `src/components/signup-form.tsx`, `src/components/member-signup-page.tsx`, `src/app/(public)/signup/signup.css` |
| 가입 검증·서버 | `src/lib/member-nickname.ts`, `src/lib/signup-validation.ts`, `src/lib/member-messages.ts`, `src/lib/member-registration.ts`, `src/lib/member-registration-policy.ts`, `src/app/actions/member-registration.ts` |
| 작성자 표시 | `src/components/community/board-list.tsx`, `src/components/community/board-detail.tsx`, `src/components/community/admin-board.tsx` |
| SQL·읽기 전용 사전 확인 | `supabase/drafts/20261020_member_nickname_consent_review.sql`, `supabase/tests/member_nickname_preflight.sql` |
| 테스트 | `tests/member-registration.test.mjs`, `tests/member-nickname-db.mjs` |
| 내부 검토 문서 | 이 문서, `docs/member-privacy-internal-draft.md`, `docs/member-withdrawal-design.md` |

## 3. 개인정보 페이지

경로는 `/privacy`, `/en/privacy`입니다. 로그인 없이 접근하며 공통 푸터·언어 전환·가입 화면에서 연결합니다. 승인 전에는 공개 준비 상태만 표시하고 검색 색인은 차단합니다. 내부 초안은 클라이언트 번들에 포함하지 않습니다. 승인된 문서를 설정하면 목차·단락·시행일·버전과 canonical/hreflang을 제공합니다. 미정인 시행일을 현재 날짜로 꾸며내지 않았습니다.

## 4. 안내·동의 동작

이용약관 필수 체크박스는 기본 미선택이며 현재 비활성화되어 있습니다. 약관·개인정보 처리방침 전문 보기는 공통 모달을 사용하며 닫아도 입력을 유지합니다. 독립 개인정보 페이지와 본문 렌더러를 공유합니다. 개인정보 수집·이용 안내에는 목적·항목·기간·거부권 및 영향을 표시할 수 있습니다. `collection.basis`가 consent일 때만 수집·이용 필수 체크박스를 표시하며 contract 모드는 처리 근거 안내를 표시합니다. 마케팅 동의는 추가하지 않았습니다.

필수 동의·문서 버전은 클라이언트, 서버 및 SQL에서 다시 검증합니다. 저장 증빙은 사용자 UID, 문서 세트의 collection_version, 약관 수락, 해당하는 수집 동의, DB 시각만 기록합니다. 버전별 KO/EN 약관·처리방침·수집 안내 원문은 정책 테이블의 변경 불가 스냅샷과 연결합니다. 정책의 enabled 변경 외에는 UPDATE를 막으며 신규 버전은 별도 행으로 추가합니다. IP·User-Agent를 동의 증빙에 추가하지 않았습니다.

## 5. 닉네임 저장·중복

닉네임은 NFKC 정규화와 앞뒤 공백 제거 후 한글 완성형·영문·숫자·밑줄 2~20자로 제한합니다. 공백·HTML·스크립트 문자를 거부하고 관리자·시스템·공식 계정 및 탈퇴 표식 예약어를 제한합니다. 실제 가입 요청 시 개인 프로필을 조회하지 않는 가용성 RPC를 호출합니다. 응답은 사용 가능 여부뿐입니다.

SQL 초안은 기존 `board_aliases`를 확장하여 UID 연결을 유지합니다. `lower(normalize(nickname,NFKC))` 생성 열에 UNIQUE 인덱스를 두어 동시 요청에서도 최종 중복을 차단합니다. 프로필·언어·닉네임·동의 기록은 한 트랜잭션으로 저장하며 중간 실패는 롤백됩니다. 미리 중복 검사했어도 최종 저장이 23505로 실패하면 성공으로 표시하지 않습니다. 닉네임 변경은 이번 범위에 없습니다. 기존 별명 충돌은 사전 검사에서 중단하며 자동으로 바꾸지 않습니다.

이메일 인증으로 세션이 아직 없는 경우 비공개 프로필은 저장하지 않습니다. 메일 확인/로그인 후 같은 화면에서 재입력하여 완료합니다. Auth 계정 생성과 프로필 SQL은 한 트랜잭션이 아니므로 부분 실패를 명확히 안내하며, 계정만 만들어진 상태를 가입 완료라고 표시하지 않습니다.

## 6. 게시판 표시·기존 구조

기존 게시판 INSERT 보호 트리거가 서버의 별명을 author_name에 복사합니다. 새 가입 RPC가 승인·적용된 이후 작성한 글·댓글에는 저장한 닉네임이 들어갑니다. 클라이언트가 작성자 이름을 전달하거나 비공개 member_profiles/Auth 정보를 조회하지 않습니다. 목록·상세·댓글·관리자 화면은 공개 author_name만 공통 함수로 표시합니다.

기존 랜덤 별명·글·댓글 스냅샷은 보존합니다. 기존 사용자가 처음 닉네임을 선택해도 과거 글은 작성 당시 별명을 유지합니다. 과거 작성자 일괄 변경은 보호 트리거 및 이력 정책을 검토하는 별도 작업입니다. 게시판 RPC/RLS와 관리자 권한은 변경하지 않았습니다.

## 7. 탈퇴 구현 범위

`탈퇴한 회원` 표식의 KO/EN 표시를 지원하고 FK·트리거·식별정보·보유 증빙·부분 실패 복구 설계를 별도 문서에 정리했습니다. 자동 Auth 삭제, 일괄 익명화 SQL, 탈퇴 API는 추가하지 않았습니다. 현재 글·댓글의 NOT NULL Auth FK와 작성자 보호 트리거, 신고·운영 로그·조회 FK 때문에 단순 삭제는 불가합니다. 이번 동의 증빙 FK 역시 보유 정책 결정 전 자동 삭제하지 않습니다. 이 구조는 무기한 보관 승인이라는 뜻이 아닙니다. 본문 속 개인정보의 별도 요청 처리 기능은 후속 작업입니다.

## 8. 검증 결과

- `npm run lint`: 성공, 오류 0. 기존 `src/app/actions/suggestions.ts` 미사용 인자 경고 2개.
- `npm run build`: 성공, `/privacy`, `/en/privacy` 생성 확인. 실행 환경의 Supabase SDK Node.js 20 지원 종료 예정 경고가 있음.
- `node --test tests/member-registration.test.mjs tests/member-login.test.mjs tests/community-board.test.mjs tests/member-board-admin.test.mjs`: 79/79 통과.
- `node tests/member-nickname-db.mjs`: 메모리 PostgreSQL(PGlite) 검증 통과. 실제 Supabase 연결/계정 생성/메일 발송 없음.
- `node tests/community-board-db.mjs`: 기존 게시판 CRUD·RLS·신고·운영 조치·공지·고정·검색·조회수와 재적용 방지/격리 검증 통과.
- DB 검증 범위: 준비 전 차단, 유효/금지/장단 닉네임, NFKC·대소문자 고유성, 만 19세 경계/이하, 필수 동의, 구 profile RPC 우회 차단, 프로필 실패 롤백, 공개 닉네임/UID 비노출, 작성자 위조 차단, 동의 테이블 접근 제한, 정책 스냅샷 변경 차단. DB 단위 동시성 제어는 UNIQUE 제약으로 보장하며 부하 테스트를 수행한 것은 아님.
- 로컬 프로덕션 브라우저: 한국어·영어 개인정보 준비 안내, 영어 가입 화면의 닉네임·연령 안내·미선택/비활성 약관·개인정보 링크 확인. 빈 폼 제출 후 영어 필드 오류와 전송/저장하지 않았다는 안내 확인. 599px 폭의 개인정보 안내 화면에서 줄바꿈/레이아웃 확인. 승인된 실제 가입이나 운영 DB E2E는 미실행.

테스트의 PGlite는 기존 로컬 `work/sql/node_modules/@electric-sql/pglite` 런타임을 사용합니다. 다른 환경에서는 동일한 로컬 테스트 의존성을 먼저 준비해야 합니다. 운영 DB 연결로 테스트를 대체하지 마세요.

## 9. SQL 수동 적용과 공개 순서

1. 운영진 정책·최소 수집 범위·약관을 먼저 승인합니다. 실제 스키마는 로컬 초안과 다를 수 있으므로 대상 프로젝트를 확인하고 읽기 전용 `supabase/tests/member_nickname_preflight.sql`로 관계·권한·기존 확장 여부를 검토합니다. 스냅샷/백업과 복구 계획은 담당자가 준비합니다. 인증·프로필·비밀값을 결과 보고서에 복사하지 않습니다.
2. 이미 존재하는 profile/board SQL을 재실행하지 않습니다. 신규 SQL의 전제는 검토된 member_profiles/member_languages, board_aliases, 기존 save_member_profile 및 비활성 member_registration_ready입니다. 준비되지 않은 객체는 별도 검토 후 설치합니다. 별명의 정규화 충돌이나 기존 가입 활성화가 발견되면 이 초안은 중단합니다.
3. 모든 save_member_profile 호출자를 검토합니다. 새 wrapper가 검증을 우회할 수 없도록 기존 직접 호출 권한을 회수하므로 다른 클라이언트가 사용 중이면 그대로 적용하지 않습니다. 현재 조사한 가입 호출자는 새 RPC로 전환했습니다. BYPASSRLS 소유자와 search_path/RLS/권한을 검토합니다.
4. 승인된 담당자가 신규 `20261020_member_nickname_consent_review.sql`만 한 번 수동 검토·적용합니다. 이 파일은 정책 행 삽입·가입 활성화·계정 생성·기존 작성자 변경·실제 탈퇴를 수행하지 않습니다. 운영 환경에서 실행한 적 없습니다.
5. 승인 문서의 양 언어 스냅샷과 불변 버전을 DB 정책 테이블에 넣고, 기존 readiness 함수의 승인 버전과 맞추는 **별도 검토된 활성화 변경**을 준비합니다. 코드의 publishedMemberLegal/memberRegistrationPolicy도 동일한 버전·처리 근거로 맞춥니다. 기존 readiness가 null이면 새 RPC도 차단됩니다. 지금은 승인 문서가 없으므로 실행 가능한 활성화 SQL이나 임시 문서를 만들지 않았습니다.
6. 별도 비운영 프로젝트에서 메일 확인·재로그인·부분 실패·중복 닉네임·서버 우회·실제 공개 응답과 권한을 검증합니다. Supabase Auth 가입 설정과 이메일/redirect를 점검한 후 공개 여부를 승인합니다.

공개 중단은 앱 가입 게이트/DB 정책 비활성화로 처리하는 변경을 별도 검토합니다. 스키마 DROP, 기존 증빙/작성자 삭제, 과거 SQL 재실행을 되돌리기 수단으로 사용하지 않습니다.

## 10. 운영진 결정과 대시보드 확인의 구분

### 운영진이 결정할 정책

- 실제 개인정보처리자 법적 명칭 및 책임 주체; 담당자·공식 문의 이메일/전화.
- 수집 목적별 법적 근거, 필수/선택 항목과 최소 수집 범위; 생년월일 전체 보관 필요성.
- 회원·행사·신고·운영 로그·증빙·백업의 기간, 예외 및 파기 절차.
- 제3자 제공, 위탁/재위탁, 국외 이전의 근거·세부 고지 및 필요한 동의.
- 최종 약관, KO/EN 처리방침·수집 안내, 버전·시행일·변경 고지/재동의 절차.
- 탈퇴·본문 개인정보 삭제 요청의 공식 창구/절차, 기존 작성자 스냅샷과 닉네임 재사용 정책.

### 운영자가 설정/계약에서 확인할 사실

| 대상 | 확인 경로와 기록할 사실 |
| --- | --- |
| Supabase 리전 | Supabase Dashboard에서 운영 프로젝트 선택 → Project Settings → Infrastructure의 Primary Database 지역 확인. [공식 인프라 안내](https://supabase.com/blog/read-replicas-vs-bigger-compute)와 [리전 설명](https://supabase.com/docs/guides/platform/regions) 참고. DB 주 리전·국가와 read replica 위치를 구분하고, 백업/지원 접근/재위탁 위치는 계약·공급업체 문서로 별도 확인합니다. URL의 프로젝트 식별자만으로 지역을 추정하지 않습니다. |
| 인증 이메일 | [Authentication → Emails → SMTP Settings](https://supabase.com/dashboard/project/_/auth/smtp)에서 custom SMTP 활성 여부, 공급업체·발신 도메인 확인. Authentication → Hooks에서 Send Email Hook도 확인. 비밀번호·SMTP 인증정보는 공유하지 않습니다. 기본 SMTP 사용이라고 추정하지 않습니다. [공식 문서](https://supabase.com/docs/guides/auth/auth-smtp) |
| 가입/인증 설정 | Authentication → Sign In / Providers → Email의 가입 허용·Confirm email 및 비밀번호 정책 확인. 가입 비활성 상태를 의도한다면 Auth 신규 가입 허용 설정도 점검하되 기존 로그인은 유지합니다. 코드 게이트만으로 직접 Auth API 가입을 막을 수는 없습니다. |
| URL/인증 링크 | Authentication → URL Configuration에서 Site URL·Redirect URLs가 운영 도메인/KO·EN 흐름과 일치하는지 확인. [공식 문서](https://supabase.com/docs/guides/auth/redirect-urls) |
| 호스팅 | 실제 배포 계정의 프로젝트 → Deployments/Settings에서 운영 도메인 연결, 사업자, 런타임/로그/백업 지역 및 기간 확인. 코드의 기본 Vercel README/이미지만으로 업체를 확정할 수 없습니다. |
| 광고/분석 | 배포 소스·호스팅 주입 스크립트/태그 매니저·Meta Events Manager·실제 브라우저 요청을 확인. 행사별 광고 측정 동의 및 철회 동작을 담당자가 점검합니다. 가입 화면에 마케팅 동의를 추가하지 않았습니다. |
| 계약/보유 | 공급업체 계약·DPA/재위탁 목록, Supabase 백업·Auth 로그 보유 설정, 행사/메시지 담당자 문서와 실제 운영 절차를 대조합니다. 프로젝트 DB 리전 하나로 모든 이전 위치를 설명할 수 없습니다. |

### 코드 조사 결과

- Supabase Auth 이메일/비밀번호 가입 및 서버 인증 세션 확인, PostgreSQL 프로필/언어 구조가 존재합니다. 공개 별명과 비공개 프로필이 분리되어 있습니다. 개인정보를 Auth 사용자 메타데이터에 덧붙이지 않았습니다.
- 별도 인증 이메일 발송 SDK/SMTP 설정은 앱 소스에서 확인되지 않았습니다. Auth 공급자 원격 설정을 조사해야 합니다. SOLAPI 메시지 기능은 별도 기존 기능이며 인증 메일 공급자로 추정하지 않았습니다.
- 호스팅 업체·Supabase 실제 리전·실제 재위탁 목록은 코드만으로 확정하지 못했습니다. 비밀 환경변수 값은 출력하지 않았습니다.
- 로그인 SSR 쿠키는 HttpOnly/SameSite=Lax/운영 Secure, Supabase 서버 fetch는 no-store입니다. 설정만으로 공급업체 로그 보유 현황까지 알 수는 없습니다.
- `landing-meta-pixel.tsx`/`meta-pixel.ts`에 운영 호스트의 지정 행사 경로에서 별도 선택 후 PageView를 전송하는 코드가 있습니다. `malmoim-meta-consent-v1` localStorage를 사용합니다. GA/gtag/@vercel/analytics는 조사한 src/package에서 발견되지 않았으나 실제 운영 미사용이라고 단정하지 않습니다.
- 기존 승인 약관/개인정보 처리방침 페이지는 조사한 소스에서 찾지 못해 임의 약관을 공개하지 않았습니다.

## 11. 후속 작업·Git

최종 문서 승인·게시, 실제 SQL 적용 및 비운영 메일/Auth 통합 검증, 운영 가입 활성화, 기존 회원의 닉네임 선택/과거 스냅샷 정책, 전체 탈퇴 및 본문 개인정보 요청 처리는 후속 작업입니다. 이번 구현이 법률 검토 완료 또는 탈퇴 자동화 완료를 뜻하지 않습니다. 내부 초안의 공식 법령/지침 링크를 운영진이 검토해야 합니다.

`feat/website-yukyung`에서 작업했으며 새 브랜치, commit, push, Supabase 운영 DB 변경은 수행하지 않았습니다. 별도 행사/관리자 내부 기능과 기존 게시판 SQL은 수정하지 않았습니다.
