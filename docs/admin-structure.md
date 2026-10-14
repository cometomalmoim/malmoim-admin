# 어드민 공통 구조 — 조별 개발 인수인계

브랜치: feat/admin-shell. 공개 홈페이지가 병합된 origin/main(a6157f7)에서 시작했다.
작업 시작 시 기존 작업 트리는 깨끗했다. 공개 홈페이지의 미완료 변경을 가져오지 않았다.

## 메뉴와 담당 영역

| 메뉴 | 경로 | 담당 | 역할 |
|---|---|---|---|
| 대시보드 | /admin | 공통 | 이벤트·신청·회원의 운영 현황을 확인합니다. |
| 이벤트 관리 | /admin/events | 1조 | 이벤트 정보와 진행 상태를 관리합니다. |
| 모집 페이지 | /admin/recruitment | 1조 | 전체 이벤트에 연결된 공개 모집 페이지를 관리합니다. |
| 문자 발송 | /admin/messages | 1조 | 전체 이벤트의 안내 문자와 발송 내역을 관리합니다. |
| 수료증 관리 | /admin/certificates | 1조 | 공통 템플릿과 전체 발급 내역을 관리합니다. |
| 자료실 | /admin/resources | 2조 | 공통 자료와 전체 이벤트 자료를 모아 관리합니다. |
| 스케줄 | /admin/schedule | 2조 | 운영 일정과 담당 업무 일정을 확인합니다. |
| 피플 | /admin/people | 2조 | 운영진 프로필과 담당 업무를 관리합니다. |
| 인스타그램 피드 | /admin/instagram | 2조 | 공개할 인스타그램 콘텐츠를 관리합니다. |
| 외부 서비스 계정 | /admin/external-accounts | 2조 | 외부 서비스의 계정 정보와 담당자를 정리합니다. 비밀번호는 다루지 않습니다. |
| 내부 게시판 | /admin/internal-board | 2조 | 운영진의 공지와 업무 소통을 위한 공간입니다. |
| 건의함 | /admin/suggestions | 2조 | 운영 관련 의견과 건의 사항을 확인합니다. |
| 소개 콘텐츠 | /admin/content | 3조 | 사용자 홈페이지에 공개할 소개와 참여 안내를 관리합니다. |
| 언어교환 매칭 | /admin/matching | 3조 | 언어교환 요청과 매칭 운영을 관리합니다. |
| 회원 게시판 | /admin/member-board | 3조 | 사용자 홈페이지의 회원 게시글을 관리합니다. |
| 활동 히스토리 | /admin/history | 3조 | 사용자 홈페이지에 공개할 지난 활동 기록을 관리합니다. |
| 회원·운영진 계정 | /admin/accounts | 공통 | 로그인 계정과 이용 상태를 확인합니다. |
| 역할·권한 | /admin/roles | 공통 | 접근 권한 설정을 위한 공간입니다. 현재는 기존 관리자 등록 기준을 유지합니다. |
| 활동 기록 | /admin/activity-log | 공통 | 운영 작업의 활동 내역을 확인합니다. |

## 이벤트 상세

운영 경로 예약: /admin/events/[eventId]/[tab]. 실제 이벤트 조회가 없으므로 현재 모든 상세 ID는 인증·관리자 검사 후 404다.
목록에 가짜 이벤트 행이나 상세 링크를 생성하지 않는다.
개발 전용: /preview/admin/events/structure/overview. structure는 실제 ID가 아니라 미리보기 전용 식별자다.
탭: overview(개요), recruitment(모집 페이지), applicants(신청자), attendance(참여자·출석), messages(문자), certificates(수료증), resources(자료).
모든 상세 탭은 1조 담당이다. 실제 기능 개발 때 검증된 이벤트 조회를 추가한 뒤 ID의 존재와 접근 범위를 검사한다.

## 통합 메뉴와 이벤트 범위

모집 페이지는 전체/해당 이벤트의 모집 페이지, 문자는 전체 발송/해당 이벤트 대상 안내,
수료증은 전체 템플릿·발급/해당 이벤트 발급, 자료실은 공통·전체/해당 이벤트 자료다.
ScopedPanel의 OperationScope로 all/event를 구분한다. 실제 조회·저장 추상화는 아직 없다.
RecruitmentCards는 실제 빈 상태 또는 개발 미리보기 카드 구조만 렌더링한다.
카드에는 제목·설명·연결 이벤트·게시 상태·공개 주소와 미리보기/복사 위치가 있다.
주소가 없으므로 미리보기·복사는 비활성화다. 가짜 URL이나 발급 성공은 표시하지 않는다.
이벤트 구조 보기 링크는 개발 미리보기의 실제 경로로만 이동한다.
다국어·UTM 링크는 이후 실제 모델과 주소 정책을 정해 추가한다.

## 공통 컴포넌트

- src/lib/admin-navigation.ts: 메뉴·설명·조별 담당과 이벤트 탭 정의.
- AdminShell: 로고·이메일·기존 로그아웃, 그룹 접기·펼치기, 모바일 메뉴, 긴 메뉴 스크롤.
- AdminView: 경로 안내·제목·대시보드·페이지 빈 상태·이벤트 탭 배치.
- ScopedPanel / RecruitmentCards: 통합·이벤트 범위 화면 공유.
- ProtectedAdmin: 모든 운영 page에서 getAdminAccess를 호출하는 서버 경계. 레이아웃만으로 보호하지 않음.
- admin.css: ops- 접두사의 스타일로 공개 홈페이지와 기존 로그인에 영향 최소화.

피플은 운영진 프로필·업무, accounts는 로그인 계정·이용 상태,
roles는 향후 접근 권한 관리, external-accounts는 외부 서비스 정보다.
비밀번호 입력·저장·열람은 없고 역할이 실제 적용되는 것처럼 표시하지 않는다.
현재 관리자 목록 기반 접근만 유지한다.

## 조별 공통 변경 시 협의

1조: 이벤트·모집·문자·수료증. 2조: 내부 운영. 3조: 홈페이지 관리와 공개 홈페이지. 공통: 계정·역할·활동 기록.
현재 catch-all 운영 page는 각 메뉴를 공유 렌더러로 연결한다. 조별 기능을 추가할 때 각 고정 경로 page로 분리할 수 있으나
각 page에서도 ProtectedAdmin 또는 같은 서버 인증·권한 검사를 호출해야 한다.
실제 데이터·변경 작업에는 서버 권한 검사와 적절한 RLS를 별도로 설계해야 한다.
navigation / AdminShell / AdminView / ScopedPanel / 보호 경계 수정은 조별 합의 후 진행한다.

3조와 충돌 가능 파일: src/lib/admin-navigation.ts, src/components/admin/*, src/app/admin/[...segments]/page.tsx,
src/app/preview/admin/* 및 이후 각 고정 page 경로.
이번 작업은 공개 (public) 페이지·public-header·globals.css·root layout·proxy·인증 라이브러리·DB·환경변수·패키지를 변경하지 않는다.
공개 홈페이지와 브랜드 로고를 공유하므로 brand-logo.tsx를 수정할 때는 함께 확인한다.

## 미구현 기능

CRUD, 검색·필터 데이터 처리, 파일 업로드, 문자 발송, 수료증 생성, 신청·출석·선발,
모집 페이지 게시·주소 복사, 매칭, 게시판 저장, 계정·권한 변경, 외부 비밀번호 관리는 구현하지 않았다.
실제 데이터는 모두 빈 상태이며 요약 수치는 —다.

## 검증 (2026-10-14)

- lint·TypeScript: 통과.
- 개발 preview 메뉴 19개: HTTP 200 및 제목 확인.
- 개발 이벤트 탭 7개: HTTP 200 및 탭 내용 확인.
- 운영 메뉴 19개에 쿠키 없이 직접 접근: 모두 로그인 이동, 인증 우회 없음.
- 390px 모바일: Enter 메뉴 열기, 모집 메뉴 이동, 메뉴 닫힘, 가로 넘침 없음.
- 페이지 params의 Suspense 누락 경고를 발견해 수정했다.
- 기존 인증·로그아웃·공개 홈페이지·도메인 routing 소스: 변경 없음.
- 운영 빌드: Codex Turbopack 포트 바인딩 Operation not permitted. 권한 확장 재시도 동일. 빌드 성공으로 간주하지 않음.
- 실제 계정 로그인·등록된 관리자 접근·로그아웃, 역할 조회 실패, 운영 preview 404: 통합 테스트 미검증.
- 운영 preview 차단 조건: NODE_ENV !== development면 notFound 유지. Vercel 미리보기도 production 모드라 404가 의도된 결과다.

Mac 터미널 확인:

```sh
cd /Users/masonsmacbookair/Projects/malmoim-admin
npm run lint
npx next typegen
npx tsc --noEmit --incremental false
npm run build
echo "빌드 종료 코드: $?"
```

Vercel 브랜치 빌드가 통과해야 운영 병합을 검토한다. main 직접 push·병합은 이번 작업에 포함하지 않는다.
