# 피플 관리

`/admin/people`에서 관리자만 프로필을 조회·등록·수정·삭제할 수 있습니다. 일반 회원 로그인 계정과 별개이며 계정 권한을 변경하지 않습니다.

## DB 적용

기존 SQL을 018까지 적용한 Supabase 프로젝트에서 `supabase/019_people_management.sql` 전체를 SQL Editor로 실행합니다. people, people_events, people_resources 테이블 및 관리자 전용 RLS/RPC를 추가합니다. 기존 이벤트·자료의 내용이나 공개 상태를 변경하지 않습니다.

프로필과 이벤트·자료 연결은 `manage_person` 트랜잭션에서 함께 저장합니다. 수정 시 updated_at을 비교해 다른 운영진의 변경을 덮어쓰지 않습니다. 프로필 삭제는 연결 관계만 함께 삭제하며 이벤트·자료 원본은 유지합니다.

사진 업로드를 사용하려면 `supabase/020_people_photos.sql`을 추가 적용합니다. 비공개 people-photos 버킷과 관리자 전용 저장소 정책, 내부 사진 경로 제약을 추가합니다. JPG·PNG·WebP를 3MB까지 선택할 수 있으며 저장 시 업로드합니다. 사진 조회 API는 매번 관리자 권한을 확인합니다. 기존 HTTPS 사진 주소는 계속 표시됩니다. 사진 교체 시 이전 파일은 보존됩니다.

Instagram은 `@malmoim` 또는 `malmoim`처럼 ID만 입력하며 DB에는 기존 방식과 호환되는 HTTPS 주소로 저장합니다. 이름은 필수이며 나머지 항목은 선택입니다. 기수·역할 필터는 등록한 값으로 구성됩니다.

사진 미리보기는 원본 File의 Object URL을 사용하고, 업로드는 원본 바이트를 저장합니다. Canvas 변환·압축·리사이징 없이 원본 해상도와 인코딩을 유지하며 조회 API도 저장된 파일을 그대로 반환합니다. 용량 초과 파일은 화질을 낮추지 않고 업로드를 거부합니다. 상세 사진과 미리보기는 `object-fit: cover` 및 `image-rendering: high-quality`를 사용하며 미지원 브라우저는 `auto`로 표시합니다. 작은 원본에서 손실된 디테일은 CSS로 복원할 수 없습니다.

## 검증

`node --test tests/people.test.mjs` — 필수값, 길이, URL·이메일, 연결 ID 검증.

`node tests/people-db.mjs` — 로컬 PGlite(`work/sql/node_modules`)에서 실제 migration을 적용하여 CRUD, RLS, 동시 수정 차단, FK 오류 롤백, 연결과 삭제 동작 검증. 운영 DB에 연결하지 않습니다.
