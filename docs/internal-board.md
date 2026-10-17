# 내부 게시판

`/admin/internal-board`는 관리자만 이용하는 게시글·댓글 공간입니다.

## DB 적용

기존 마이그레이션 이후 `supabase/021_internal_board.sql`을 Supabase SQL Editor 또는 프로젝트의 DB 배포 절차로 적용합니다. 이 작업에서는 운영 DB를 변경하지 않았습니다. 적용 전에는 게시판이 명시적인 로드 실패 안내를 표시합니다.

게시글 및 댓글은 관리자에게만 조회가 허용되며, 직접 테이블 변경은 차단됩니다. `manage_internal_board` RPC가 현재 로그인 사용자 ID로 작성자를 설정하고 수정·삭제·고정을 작성자에게만 허용합니다. 변경 시 `updated_at` 비교와 행 잠금으로 오래된 화면의 덮어쓰기를 거부합니다. 삭제는 댓글도 함께 삭제합니다.

## 동작

- 공지이면서 고정된 글만 최상단에 정렬하며, 나머지는 작성일 내림차순입니다.
- 공지를 일반 카테고리로 바꾸면 고정이 해제됩니다.
- 검색은 제목·본문·작성자에 적용되며 카테고리 및 고정 필터와 동시에 작동합니다. 필터 패널을 접어도 선택한 조건은 유지됩니다.
- 작성·수정은 우측 패널에서 수행하며, 삭제는 같은 패널의 확인 버튼으로 확정합니다.
- 검색은 현재 로드한 게시글에 즉시 적용됩니다. 다른 사용자의 변경을 가져오려면 새로고침합니다.

## 검증

- `node --experimental-strip-types --test tests/board.test.mjs`
- `node tests/board-db.mjs` (기존 `work/sql` PGlite 환경 사용, 운영 DB와 연결하지 않음)
- `npx tsc --noEmit`
- `npm run lint -- --quiet`
- `npm run build`
