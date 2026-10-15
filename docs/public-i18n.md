# 공개 홈페이지 한국어/영어

## 경로

| 메뉴 | 한국어 | 영어 |
|---|---|---|
| 홈 | / | /en |
| 말모임 소개 | /about | /en/about |
| 스터디·이벤트 | /events | /en/events |
| 1:1 언어교환 | /exchange | /en/exchange |
| 게시판 | /board | /en/board |
| 히스토리 | /history | /en/history |

URL로 언어를 구분한다. 상단 언어 선택은 현재 메뉴를 유지해 이동하며, 로고/상단 메뉴/홈페이지 본문 링크/하단 메뉴는 선택한 언어를 유지한다. 브라우저 뒤로·앞으로도 URL에 맞는 언어를 표시한다. 인증이나 localStorage 로그인 상태와 관련 없음. 쿠키/브라우저 언어를 이용한 강제 리디렉션은 추가하지 않았다.

## 공통 구조

- public-content.ts: 한국어 원본 유지 + 영어 번역, getPublicPages/publicPath.
- public-metadata.ts: 페이지별 번역 제목/설명, 각 canonical, ko/en/x-default hreflang, OG locale.
- PublicFrame, PublicHeader, PublicHome, PublicDetail: 두 언어가 같은 구조를 사용한다. 영어 콘텐츠 wrapper lang=en, 원본 로고 유지.
- (public): 기존 한국어 경로. (english)/en: 영어 전용 route group, 동일한 scoped public.css. 관리자 noindex는 그대로이고 공개 페이지는 index/follow.

3조 공개 홈페이지 작업과 겹치는 파일: src/lib/public-content.ts, src/components/public-header.tsx, src/app/(public)/* 및 public.css. 콘텐츠 변경 시 두 언어 데이터를 함께 반영한다. 현재 공개된 내용이 없는 메뉴는 기존의 정직한 준비 중 상태를 그대로 번역했다. 가짜 행사/후기 없음.

## 범위와 기존 기능

기존 로그인·관리자·Supabase·DB·행사 신청 로직 변경 없음. 로그인 링크는 기존 /login으로 연결한다(관리자 로그인 화면의 번역은 이번 범위 아님). 9기/할로윈 개별 랜딩의 기존 언어 전환은 유지한다. 미배포9기 신청 코드가 운영에 섞이지 않도록 공개 홈페이지 변경만 별도 배포 PR로 분리한다.

## 검증 기록

lint/next typegen/TypeScript 통과. /en/events→한국어 전환 시 /events 유지, 영어로 다시 전환 확인. 모바일390px 메뉴 열기/닫기, Escape 후 토글 포커스 복귀 확인. 390/961/1024px 가로 넘침 없음. 운영 빌드·전체 경로 검사는 배포 브랜치에서 추가 확인한다.

12개 공개 경로 HTTP200/canonical/hreflang 확인. 320px에서도 가로 넘침 없음. 영어 모바일 화면 실제 캡처로 로고·언어 선택·로그인·본문 배치 확인.

독립 운영 검증: lint/TypeScript 및 npm run build 종료 코드0. 별도3102 production 서버에서 공개12경로 HTTP200/canonical/index 확인. 없는 영어 경로는 not-found/noindex(초기 스트리밍 응답은200일 수 있음, 후속404), 운영 preview404 확인. admin Host의 /는 기존 /login으로307. 테스트용3102만 종료하고 기존3000 개발 서버 유지. 실제 계정 로그인·로그아웃·권한 전체 회귀는 미검증(관련 코드 diff0).


운영 반영: PR12 merge commite05bd9e Vercel Production success. 실제 malmoim.com→/en 전환 및 /en/events→한국어/events 현재 메뉴 유지 확인. 관리자 인증·DB·행사 신청 변경 없음.
