# 히스토리 후기 작성 안내 및 관리자 참가 권한 승인 연결

/history와 /en/history의 후기 등록 버튼을 누를 때 현재 로그인·참가 권한을 확인합니다. 비로그인, 참가 미확인, 권한 확인 실패를 구분하며 승인 참가자만 작성창을 열 수 있습니다. 기존 서버 저장 검사와 DB RLS를 유지합니다.

/admin/history-review-access에서 기존 관리자 세션으로 이메일을 정확히 조회하고, 참가자·실제 출석 기록과 신원을 수동 대조한 뒤 사유를 입력해 승인·철회합니다. 이메일 검색은 Auth와 동일하게 소문자로 정규화한 전체 이메일을 비교하고, 중복 계정은 거부합니다. 승인 변경은 기존 history_manage_participant RPC만 사용하며 감사 로그를 유지합니다. 자동 신원 연결·출석 수정은 없습니다.

## 기준 및 범위

- 최신 확인 origin/main: bca0e7f (PR #183). 별도 release/history-review-production 브랜치에 충돌 없이 반영했습니다. db7180a 포함.
- 사진, 행사·참가·출석·모집 후기 기능, 기존 후기 카드 디자인의 구현은 변경하지 않습니다. main에서 들어온 팀원 변경은 그대로 보존합니다.
- 한영 페이지는 동일한 후기 컴포넌트를 사용합니다. 관리자 화면은 기존 admin_users 세션 검사로 보호됩니다.
- 새 진단 모듈에 맞춰 기존 목록 테스트의 모의 의존성도 보완했습니다. 개인정보·DB 오류 원문은 진단 로그에 출력하지 않습니다.

## 운영 준비와 설정

사용자는 qkhlvdctdcpfyvohhikl에 01 → 03 → 04 설치 및 02 검증 완료를 확인했습니다. 이 변경에서 SQL을 다시 실행하지 않습니다. supabase/review-release SQL은 수동 감사/검증 자료이며 자동 migration 경로가 아닙니다. 기존 DRAFT/BLOCKED는 이력 자료로 유지합니다. 설치 SQL은 재실행하지 마세요.

추가 환경변수·service_role 키·브라우저 관리자 토큰이 필요하지 않습니다. 기존 NEXT_PUBLIC_SUPABASE_URL은 https://qkhlvdctdcpfyvohhikl.supabase.co, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY는 기존 유효 공개 키를 사용해야 합니다. SUPABASE_LOCAL_TEST는 Production에서 해제돼야 합니다. 기존 사진 활성화 플래그 HISTORY_PHOTO_PRODUCTION_ENABLED / HISTORY_PHOTO_PRODUCTION_REVIEWED는 현재 운영 설정을 그대로 유지합니다. 이 준비 과정에서는 Vercel 환경값을 조회/변경하거나 배포하지 않았습니다.

## 검증

- 후기/관리자/ACL/사진 갤러리·기수·연도/참가·출석/로그인 회귀 테스트 101개 통과.
- 후기 목록/사진 처리/로그인 복귀/사진 등록 UI/기존 모집 후기 추가 회귀 테스트 46개 통과. 총 147개, 실패·스킵 없음.
- TypeScript, 수정 파일 ESLint, production webpack build 통과. 빌드는 비연결용 가상 Supabase 값과 사진 플래그 OFF로 실행했으며 실제 Production API를 호출하지 않았습니다.
- 관리자 직접 RPC 거부/이메일 대소문자·중복/컬럼 ACL 검사는 가상 메모리 PostgreSQL에서만 수행했습니다.
- 실제 운영 관리자 검색·승인·후기 등록·첨부 Storage E2E는 미실행입니다. 운영 스키마 검증은 사용자 제공 결과이며 이 준비 과정에서 독립적으로 운영 DB를 조회하지 않았습니다.

## 배포 후 별도 승인된 확인

기존 관리자로 /admin/history-review-access 접속 → 실제 동의한 회원 이메일 검색 → 기존 참가자 ID 조회 → 계정/참가/회차 출석 신원 대조 → 직접 확인 체크·유효 근거·사유 입력 → 승인. 회원이 /history 또는 /en/history에서 자발적으로 실제 후기를 작성합니다. 미참가/비로그인 차단을 확인합니다. 가짜 운영 후기·참가 기록은 만들지 않습니다.

저장 후 후기는 즉시 공개되며, 권한 철회 후에도 본인 기존 글 수정·삭제는 가능합니다. 이미 발행된 사진 서명 URL은 최대 1시간 유효할 수 있습니다. 운영 장애 시 승인을 중단하고 별도 승인된 코드 롤백을 수행하되, 테이블·버킷·기존 데이터·감사 기록은 삭제하지 않습니다. 잘못된 단일 승인은 기존 RPC로 현재 revision을 사용해 감사 사유와 함께 철회합니다.

현재 단계: 로컬 브랜치/커밋 및 PR 설명 준비만 완료. push, PR 생성, merge, 배포, 실제 회원 승인·후기 등록은 별도 승인 대상입니다.
