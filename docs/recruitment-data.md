# 9기 이벤트·신청자 조회 연결

## 현재 단계

사용자가 기존 이벤트·신청 테이블이 없음을 확인했다.
이벤트와 신청 목록의 최소 구조를 작성했다. 운영 SQL은 실행하지 않았다.
실제 접수는 계속 비활성이다. 입력 endpoint나 anon 쓰기 권한을 열지 않는다.

## 준비된 경로

- /admin/events: 실제 recruitment_events 목록
- /admin/recruitment: 실제 이벤트와 연결된 모집 페이지 목록
- /admin/events/season9/applicants: 9기 신청 목록, 25건 페이지 단위
- /admin/events/[slug]/applicants: 해당 DB 이벤트의 신청만 조회, 존재하지 않는 slug는 권한 검사 후 404

표시: 이름·연락처·희망 반·접수일(한국시간)·상태. 생년월일·지원 동기 등은 목록에 노출하지 않는다.
없으면 빈 상태. 테이블·권한 오류는 오류 안내로 표시하며 신청 0건처럼 숨기지 않는다.
리스트는 읽기 전용이며 선발·삭제·발송은 구현하지 않았다.

## SQL 적용

supabase/003_recruitment_applications.sql을 검토한 뒤 SQL Editor에서 전체 실행한다.
새 테이블 생성용 최초 migration이며 이미 적용한 경우 재실행하지 않는다.
운영 DB 실행은 사용자가 승인·수행한다. 표준 Supabase Postgres + 기존 admin_users가 전제다.
recruitment_events와 event_applications를 생성하고, 9기를 draft/접수 비활성으로 등록한다.
공개 회원가입·기존 관리자 목록·환경변수는 바꾸지 않는다.

RLS는 authenticated 중 admin_users에 등록된 사용자만 SELECT 허용한다.
anon SELECT와 모든 앱 역할의 INSERT/UPDATE/DELETE 권한은 제거한다.
앱의 서버 page 및 데이터 접근 함수 모두 관리자 검사를 하며 사용자별 결과를 공유 캐시에 저장하지 않는다.
Secret/service_role 키를 사용하지 않는다.
DB의 9기 slug는 실제 migration 등록 후에만 정상 이벤트로 표시된다.

## 검증

- lint·TypeScript 통과.
- 비로그인 이벤트/모집/신청자 직접 URL 접근 4개: 로그인 이동, 데이터 화면 미노출.
- 가상 RLS 테스트 파일: supabase/tests/recruitment_access.sql. 테스트 프로젝트에서만 실행하고 fixture는 rollback.
- 운영 migration·실제 관리자 DB 조회·RLS 가상 테스트 실행: 미검증, SQL 미적용.
- Codex build: 기존 Turbopack CSS 처리 포트 바인딩 Operation not permitted로 실패.
- 신청 저장 성공/실패·중복 연락처·마감·남용 차단: 이번 단계 미구현·미검증.
- 기존 개발 서버는 종료하지 않았다.

Mac에서 npm run build 및 종료 코드 0을 확인하거나 Vercel PR 빌드를 확인한다.
운영 UI 병합은 SQL 적용과 권한 검증을 확인한 후 진행한다.

## 실제 접수 활성화의 별도 단계

한영 통합 신청 폼 → 서버 제출 → 이벤트 모집 상태/마감/필수 동의 검증 → 원자적 DB 저장 → 완료 안내.
쓰기용 최소 RPC 또는 전용 서버 권한 경로, 중복 식별·연락처 정규화, 접수 남용 방지, 필수 입력 검증을 먼저 구현한다.
새로고침·중복 제출이 성공 건수를 늘리지 않게 하며 UTM 허용 항목만 저장한다.
개인정보·세션·답변을 광고 이벤트로 전송하지 않는다. 이번 migration만으로 접수는 열리지 않는다.
폐기 자동화는 사용자 지정 후속 우선순위로 남겼다.

## SQL 적용 후 확인 (2026-10-14)

사용자가 SQL Editor 성공 응답을 제공했다. 실제 관리자 세션으로 9기 신청 목록 0건 및 접수 비활성 상태를 확인했다.
Publishable key만 사용한 비회원 요청은 두 신규 테이블 모두 HTTP 401로 차단됐다.
개발 사전 렌더링 중 SDK Date.now 경고를 발견해 보호 page에서 connection()을 기다린 뒤 인증·조회하도록 수정했다.
가상 테스트 SQL 및 일반 회원 역할 테스트는 아직 실행하지 않았다. 신청 저장은 비활성이다.

## 실제 접수 구현 준비

004_season9_submission.sql은 접수용 RPC와 season9 published/접수 허용 설정을 함께 적용한다.
운영 SQL은 아직 실행하지 않았다. RPC는 직접 테이블 쓰기 권한 대신 최소 접수 기능만 제공한다.
이벤트 row lock으로 마감·재전송·동일 연락처 중복·전체 요청 제한을 직렬화한다.
동일 연락처/제출 ID 재전송은 기존 개인정보나 ID를 반환하지 않고 일반 접수 응답만 반환한다.
남용 제한은 이벤트 전체 1분 20건/1일 500건이며 클라이언트 honeypot도 추가했다.
이는 모집 정원이나 표시용 잔여 인원이 아닌 기술적 보호 한도다. 대규모 광고 전에는 CAPTCHA/고급 속도 제한을 검토한다.
UTM 5개 허용 필드만 최대 150자 저장하며 광고 픽셀·외부 전환 전송은 없다.
신청은 회원가입 없이 진행하고 실제 DB 함수 저장 성공 응답 후에만 완료 안내한다.
미완료: 운영 SQL 적용, 저장 성공/실패·중복·마감/RLS 실제 테스트, 폐기 자동화.
