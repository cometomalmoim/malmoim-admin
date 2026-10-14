# 사용자 홈페이지 기본 틀 — 3조 인수인계

## 범위와 구조

브랜치: feat/public-home. main 병합·운영 배포·DNS 변경은 진행하지 않았다.
공개 페이지는 src/app/(public) 아래에 분리했다.
- /: 소개·참여 안내, 스터디·이벤트, 언어교환, 지난 활동 안내와 푸터
- /about: 말모임 소개
- /events: 스터디·이벤트
- /exchange: 1:1 언어교환
- /board: 게시판
- /history: 말모임 히스토리

공통 콘텐츠는 src/lib/public-content.ts, 메뉴는 src/components/public-header.tsx,
공개 메타데이터·헤더·푸터는 (public)/layout.tsx, 스타일은 (public)/public.css에 있다.
후속 개발은 제공받은 실제 소개·일정·기록으로 준비 중 안내를 교체한다.
신청·회원가입·결제·매칭·게시글 저장은 구현하지 않았다.
원본 로고와 기존 Supabase 설정을 유지했다.

## 도메인 진입과 보안

Proxy의 / 처리만 추가했다. Host가 정확히 admin.malmoim.com인 루트는 /login으로 이동한다.
malmoim.com, localhost, Vercel 미리보기의 루트는 공개 홈페이지다.
도메인은 진입 화면만 결정하며 /admin의 서버 인증·관리자 목록 검사는 유지한다.
기존 로그인·로그아웃·쿠키 처리·관리자 SQL·권한 검사 코드는 변경하지 않았다.
공개 그룹은 index/follow, 기존 root metadata는 noindex/nofollow로 유지된다.
공개 canonical은 https://malmoim.com 기준이다. /preview/admin의 운영 404 조건은 유지한다.

## 2026-10-14 검증

- lint: 통과.
- TypeScript: 통과. 처음에는 페이지 이동 이전 .next/dev 생성 타입이 남아 실패했으나 개발 서버 재생성 후 통과.
- 공개 6개 페이지: 개발 서버 HTTP 200, 제목과 index/follow 확인.
- /login: HTTP 200, noindex/nofollow 확인.
- admin 도메인 Host의 /: 307 /login; 공개 도메인·미리보기 Host: HTTP 200.
- 쿠키 없는 /admin: 스트리밍 응답에 /login 이동 표시, 관리자 대시보드 미노출 확인.
- 브라우저: 390px 모바일에서 Enter로 메뉴 열기, 이벤트 메뉴 이동, 메뉴 닫힘 확인. 가로 넘침 없음.
- 로고 대체 텍스트와 본문 바로가기, 포커스 CSS 확인.
- 실제 계정 로그인·관리자 접근·로그아웃 및 운영 도메인·운영 404: 미검증.
- 운영 빌드: Codex에서 Turbopack CSS 처리의 포트 바인딩 Operation not permitted로 실패. 권한 확장 재시도도 동일. 빌드 성공으로 기록하지 않음.
- GitHub 브랜치와 PR을 통해 Vercel 빌드를 검증한다. 운영 배포는 빌드 성공 확인 후 진행한다.

## Mac에서 다음 확인

```sh
cd /Users/masonsmacbookair/Projects/malmoim-admin
git branch --show-current
npm run lint
npx next typegen
npx tsc --noEmit --incremental false
npm run build
echo "빌드 종료 코드: $?"
```

사용자의 배포 진행 요청에 따라 브랜치 커밋·push와 PR을 준비한다. 로컬 운영 빌드는 미검증이며 Vercel 빌드 통과를 확인하기 전 운영 main에는 병합하지 않는다.
기존 Vercel 프로젝트의 Git 연결과 Preview 자동 배포 설정을 확인한다.
Vercel Deployments에서 feat/public-home 배포의 Ready 상태 및 Visit URL을 확인해 PR에 기록한다.
미리보기 URL을 추측하지 않는다. 운영 main은 검토 전 병합하지 않는다.

## 기존 Vercel 프로젝트에 도메인 추가 (사용자 작업)

1. 기존 admin.malmoim.com 프로젝트를 연다. Settings > Git에서 GitHub 저장소 연결과 Production Branch=main을 확인한다.
2. 브랜치 Preview에서 모바일 메뉴·관리자 로그인·로그아웃·색인 설정을 검토한다.
3. 플랜 이용 조건을 확인한 뒤 검토 승인된 PR만 main에 병합한다.
4. Settings > Domains에서 malmoim.com을 추가하고 해당 프로젝트의 Production에 연결한다.
   admin.malmoim.com은 유지한다. 루트 도메인을 admin 도메인으로 redirect하지 않는다.
   www 추가/리디렉션 제안은 선택 사항이며 자동 적용하지 않는다.
5. Vercel이 malmoim.com에 표시한 DNS 레코드 타입·호스트·값을 그대로 사용한다.
   기존 A/AAAA, MX/TXT, admin 레코드와 네임서버를 먼저 확인한다.
6. 가비아 My가비아 > 서비스 관리 > DNS 관리툴에서 malmoim.com 설정을 연다.
   레코드 수정 > +레코드 추가에서 Vercel 안내를 입력하고 확인·저장한다.
   가비아가 실제 네임서버 제공자가 아니라면 현재 네임서버 제공자에서 설정한다.
   기존 루트 레코드와 충돌하면 담당자 확인 후 변경한다. 무조건 삭제·덮어쓰기하지 않는다.
7. Vercel Valid Configuration과 HTTPS, 양쪽 도메인의 루트 동작을 확인한다.

## Hobby 플랜 조건

Vercel 공식 지침상 Hobby는 비상업적 개인 이용만 허용한다.
상업 이용에는 Pro 또는 Enterprise가 필요하다. 페이지에 결제가 없다는 이유만으로 비상업적 이용이 되는 것은 아니다.
말모임 홈페이지·어드민이 영업·유료 서비스 운영 용도라면 유료 플랜 요건을 검토해야 한다.
용도가 불명확하면 Vercel 지원에 문의한다. 이번 작업에서는 구매·플랜 변경을 하지 않는다.

공식 출처:
- https://vercel.com/docs/limits/fair-use-guidelines
- https://vercel.com/docs/domains/working-with-domains/add-a-domain
- https://customer.gabia.com/manual/38/3041/3040
