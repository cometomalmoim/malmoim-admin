# 피플 관리

`/admin/people`에서 관리자만 프로필을 조회·등록·수정·삭제할 수 있습니다. 일반 회원 로그인 계정과 별개이며 계정 권한을 변경하지 않습니다.

## DB 적용

기존 SQL을 018까지 적용한 Supabase 프로젝트에서 `supabase/019_people_management.sql` 전체를 SQL Editor로 실행합니다. people, people_events, people_resources 테이블 및 관리자 전용 RLS/RPC를 추가합니다. 기존 이벤트·자료의 내용이나 공개 상태를 변경하지 않습니다.

프로필과 이벤트·자료 연결은 `manage_person` 트랜잭션에서 함께 저장합니다. 수정 시 updated_at을 비교해 다른 운영진의 변경을 덮어쓰지 않습니다. 프로필 삭제는 연결 관계만 함께 삭제하며 이벤트·자료 원본은 유지합니다.

사진은 HTTPS URL로 등록합니다. Instagram은 instagram.com HTTPS 주소만 허용합니다. 이름은 필수이며 나머지 항목은 선택입니다. 기수·역할 필터는 등록한 값으로 구성됩니다.

## 검증

`node --test tests/people.test.mjs` — 필수값, 길이, URL·이메일, 연결 ID 검증.

`node tests/people-db.mjs` — 로컬 PGlite(`work/sql/node_modules`)에서 실제 migration을 적용하여 CRUD, RLS, 동시 수정 차단, FK 오류 롤백, 연결과 삭제 동작 검증. 운영 DB에 연결하지 않습니다.
