# 2026 말모임 할로윈 파티

## 공개 페이지와 근거

- 공개 경로 `/2026halloweenparty`, canonical https://malmoim.com/2026halloweenparty . 공개 index/follow 메타데이터로 관리자 noindex와 구분한다.
- 노션 원문은 웹 도구 접근 실패 후 실제 브라우저에서 확인했다: https://app.notion.com/p/2026-3dfd162fc02480af800dca05164d1550
- 2026-10-31 토요일, 참가자 입장19:00, 종료24:00. 원문 요약 표에는18:00 시작도 있으나 상세 시간표상18~19는 운영진 장소 준비라 참가자 일정에는19시를 사용한다.
- 연신내 하이브 HIVE, 서울 은평구 연서로27길16-16 지하1층. 코스튬 권장(간단 소품 가능).
- 원문 시간표의 프로그램을 예정 일정으로 사용:19:30오프닝/아이스브레이킹,20:00네트워킹,20:40게임,21:30네트워킹/투표,22:10코스튬콘테스트,22:50애프터파티,23:30클로징. 현장 변동 안내 포함.
- 참가비는 미정이라 추후 안내. 예상인원, 준비 업무, 담당자, 예산, 미확정 경품/음식/주류/환불 조건은 공개하지 않는다. 가짜 행사 사진·후기·카운트다운 없음.
- 원본 BrandLogo 이미지 사용, 자체 SVG 할로윈 일러스트는 장식용이며 실제 행사 사진으로 표시하지 않는다.

## 신청 폼의 현재 상태

사용자가 확정한 항목은 이름·연락처·말모임 참가 이력이다. 참가 이력은 없음/있음 선택 및 기수·활동명 선택 입력으로 구성했다. 개인정보 동의 별도 표시.

**이번 배포는 안내 랜딩과 비활성 신청 폼 UI다. 실제 접수를 활성화하지 않는다.** CTA는 신청 안내 anchor 이동이며 신청 성공/완료를 표시하지 않는다. 전체 fieldset 및 버튼 disabled, 서버 Action/API/저장 로직 없음, 개인정보 전송 없음. 주최 말모임 문의 이메일로 연락 가능.

## 접수 개시 전 확정·개발 필요

- 참가비·포함 사항·환불 기준·대상/연령 조건·접수 마감·선발/안내 방식.
- 개인정보: 수집 항목/목적/운영 주체/보유기간/동의 거부 영향 확정. 9기의 보유기간을 임의로 재사용하지 않는다.
- 기존 recruitment_events/event_applications가 있다. 실제 접수 연결 시 재사용을 우선 검토하되 현재 event_applications.preferred_class(목/토 필수), 참가비 확인 필수 등9기 조건을 파티에 허위로 대입하지 않는다. 일반 이벤트 확장을 위한 검토용 migration/RPC·원자적 마감/중복/남용 방지·관리자 참가 이력 표시가 별도 필요하다.
- 아직 migration/DB변경 없음. 관리자 이벤트나 신청 목록에 가짜 이벤트를 생성하지 않는다. DB 저장/관리자 신청 목록 연결은 미구현이며 정식 접수 전 완료·검증해야 한다.
- 공개 신청자가 명단을 조회할 수 없는 RLS 유지. 실제 신규 이벤트/SQL 반영은 별도 확인 후 진행.

## 기존 기능 보존

새 route와 scoped `hw-` CSS만 추가, 홈페이지/어드민 인증/자료실/9기 신청/DB·환경변수·패키지 변경 없음. 고정 브랜치의 미배포9기 신청 코드를 운영에 같이 포함하지 않는다.

## 검증

lint/next typegen/TypeScript 통과. PC 첫 화면 로고·타이포·일러스트 확인. 모바일/CTA/빌드 결과는 최종 검증에 추가한다. 실제 신청 저장·중복·마감·관리자 조회는 아직 구현되지 않았으므로 검증 완료로 표시하지 않는다.

최초 확인:390px 모바일 가로 넘침 없음(390/390), 신청 anchor3개 모두 #apply, 모바일 고정 CTA 실제 이동 확인. 원본 로고 표시/일러스트/제목·메타데이터 canonical/index 확인. 기존 checkout 빌드는 Turbopack CSS process/port Operation not permitted(os error1)로 중단되어 통과로 기록하지 않는다. 별도 worktree/CI에서 재검사한다.

독립 배포 worktree 검증: npm ci 후 lint/next typegen/TypeScript 및 **npm run build 종료 코드0**. `/2026halloweenparty` 정적 페이지 생성 확인. 키보드 Enter로 타임테이블 anchor 이동 확인. 배포 diff는 새 route/page.tsx, scoped party.css, 이 문서 세 파일뿐이며 인증·기존 신청·DB·패키지 변경0. 실제 행사 신청은 UI disabled 상태로 게시하며 아직 구현/활성화하지 않는다.


운영 반영: 전용 PR9 병합 commit780171a Vercel Production success. https://malmoim.com/2026halloweenparty 실제 브라우저에서 랜딩/일정/장소/비활성 신청 폼 확인. 고정 브랜치는 유지하며 미배포9기 PR5는 병합하지 않았다.

## 영어 버전

공개 영어 경로 `/2026halloweenparty/en` 추가. 행사 소개·예정 일정·주소·자정 이후 자율 뒤풀이·FAQ·신청 필드/미접수 안내를 영어로 제공한다. KO/EN 상호 언어 링크, 각 canonical 및 ko/en/x-default hreflang, 영어 콘텐츠 lang=en 및 en_US OG 적용. CSS/PartyArt SVG는 두 페이지가 공유하며 행사 내용 변경 시 두 언어 문구를 함께 반영해야 한다. 실제 접수/DB 저장은 양쪽 모두 비활성 유지. 390px 가로 넘침 없음, 영어 CTA #apply 이동 확인. lint·TypeScript 통과.

영어 버전 최종 검증: 독립 worktree lint/TypeScript/운영 build 종료 코드0, KO→EN→KO 링크 이동 및 영어 모바일 신청 CTA 이동 확인. 새 정적 영어 route 생성 확인. 실제 접수는 양쪽 모두 미구현/비활성 유지.

영어 운영 배포: PR11 merge commitbdd99d8 Vercel Production success. https://malmoim.com/2026halloweenparty/en 실제 브라우저 제목/영문 콘텐츠와 한국어→English 왕복 전환 확인. 실제 접수 비활성 유지.
