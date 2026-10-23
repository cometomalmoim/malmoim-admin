# 60422 사진 helper 소유권 축소

운영 미적용. 기존 001/002는 v1 기준으로 보존하고, 이 폴더는 명시적 승인 후
적용하는 소유권 overlay다. 대상은 malmoim-photo-package-e118b7ab:60422만 허용한다.

- `contract.json`: 7개 변경 전/후 매핑, 6개 postgres 잔여 함수, 열별 권한.
- `003_owner-hardening.review.sql`: 조회 함수 6개 → photo_helper_reader_owner,
  capability 함수 1개 → photo_capability_owner. 둘 다 NOLOGIN/NOINHERIT/
  NOSUPERUSER/NOBYPASSRLS/NOCREATEROLE/NOCREATEDB/NOREPLICATION.
- 조회 역할: 사진 테이블 5개의 필요한 열 SELECT만. capability 역할:
  사진 작업·활동 조회와 capability 지정 열 INSERT만. UPDATE/DELETE 없음.
  사진 전용 테이블에 역할 한정 SELECT/INSERT RLS 8개를 추가한다.
- cap 함수의 관리자 조회는 기존 제한 helper `photo_finish_v2.admin(uuid)`로
  위임한다. 브라우저가 호출할 수 없으며 실제 관리자 재확인을 유지한다.
- 공유 auth/storage/admin_users의 스키마·테이블·정책·권한은 변경하지 않는다.
- auth.uid/jwt/role 또는 admin_users에 직접 의존하는 기존 6개 helper는
  공유 접근 권한을 추가하지 않고 postgres 소유로 남긴다. 완전한 postgres
  제거를 완료했다고 주장하지 않는다.
- 기존 postgres 소유 Storage 정책 helper가 verified_state를 호출하므로 그
  단일 함수 EXECUTE는 유지한다. 테이블 권한 확대나 role membership은 없다.

이전 조건: 새 소유자의 대상 스키마 CREATE와 설치자의 SET/INHERIT를 잠시
허용해야 ALTER FUNCTION OWNER가 가능하다. 같은 트랜잭션에서 전부 회수하며
함수 본문·권한·RLS 검증까지 통과한 뒤에만 COMMIT한다. search_path='' 유지,
PUBLIC/anon/authenticated/worker의 기존 실행 제한을 유지한다.

```sh
node supabase/install/history-photos/owner-hardening/apply-local.cjs /private/tmp/malmoim-photo-package-KCloOQ
node supabase/install/history-photos/owner-hardening/test-local.cjs /private/tmp/malmoim-photo-package-KCloOQ
node supabase/install/history-photos/test-clean-lab.cjs /private/tmp/malmoim-photo-package-KCloOQ
```

apply는 변경 전 schema-only dump와 카탈로그를 root/owner-backup-*에 0600으로
기록한다. 재실행은 004 읽기 전용 검증만 수행한다. 기본 install-local도
overlay가 이미 있으면 004로 검사하며, 기존 설치를 자동으로 업그레이드하지 않는다.
회귀 시험에서는 기존 관리자·일반 회원 계정을 재사용하고 신규 시험 활동/파일만
추가한다. 실패한 신규 시험 활동도 다음 시험에서 비공개로 복원하고 기록은 보존한다.
실패 시 권한을 광범위하게 GRANT하거나 RLS를 끄지 않는다. 데이터/파일 삭제나
자동 복구 DROP은 제공하지 않으며, 커밋 이후 복원은 별도 검토·승인이 필요하다.

향후 새 설치 패키지에는 v1 설치 다음에 이 overlay와 004 검증을 연결해야 한다.
운영 admin_users/Auth 접근을 위한 남은 6개 함수의 소유권은 보스의 별도 권한
검토가 필요하다. Vercel OIDC·Storage 토큰·DB 역할/RPC 이름 문제는 이번 범위가 아니다.
