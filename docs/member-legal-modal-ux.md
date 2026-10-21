# 가입 법률 문서 모달 UX 개선 (2026-10-21)

회원가입은 계속 차단되어 있습니다. 문서 승인 값, 서버 검증, 닉네임 처리, SQL 및 운영 데이터는 이번 UX 작업에서 바꾸지 않았습니다.

## 동작

- 가입 화면의 개인정보 처리방침·이용약관 전문 보기는 같은 `MemberLegalModal`을 엽니다. 폼 전송이나 새 탭/경로 이동을 하지 않는 `type="button"`입니다.
- 네이티브 `dialog.showModal()`로 배경을 inert 처리하고 모달 키보드 탐색을 제공합니다. 열릴 때 제목으로 포커스를 옮기며, ESC·X·하단 닫기·실제 모달 영역 밖 클릭으로 닫습니다. 닫으면 원래 버튼에 포커스를 돌려줍니다.
- 열려 있는 동안 body의 overflow를 잠그고 닫기/언마운트 때 기존 값을 복원합니다. 폼이나 입력 컴포넌트를 언마운트하거나 초기화하지 않습니다.
- 모달 헤더와 닫기 영역은 유지하고 본문만 스크롤합니다. 작은 화면에서는 화면 안쪽 여백 12px, 동적 뷰포트 높이 제한을 적용합니다.
- `MemberLegalContent`가 모달·독립 페이지 양쪽에서 승인된 문서 데이터의 KO/EN 본문·시행일·버전·목차를 렌더링합니다. 모달 목차 ID는 인스턴스별 접두어로 분리합니다.
- 현재 `publishedMemberLegal=null`이므로 준비 안내만 표시합니다. 내부 법률 초안을 공개 UI로 가져오지 않습니다. 추후 승인 문서를 설정해도 같은 컴포넌트가 전문을 표시합니다.
- `/privacy`, `/en/privacy`와 푸터 링크를 유지합니다. 가입 화면의 준비 경고는 상단 한 곳에 남기고 동의 영역/제출 버튼 위의 반복 문구를 제거했습니다. 처리 결과에 필요한 검증 오류·상태 안내는 유지합니다.

## 이번에 수정·추가한 파일

- 추가: `src/components/member-legal-modal.tsx`, `src/components/member-legal-content.tsx`, `src/components/member-legal.css`.
- 수정: `src/components/signup-legal-notice.tsx`, `src/components/member-privacy-page.tsx`, `src/components/signup-form.tsx`, `src/app/(public)/signup/signup.css`, `src/lib/member-messages.ts`, `tests/member-registration.test.mjs`.
- 문서: 이 파일 및 기존 결과 보고서의 UX 갱신 안내.

## 검증

- `npm run lint`: 성공. 기존 suggestions.ts 미사용 인자 경고 2개, 오류 없음.
- `npm run build`: 성공. 기존 Node.js 20 관련 Supabase SDK 지원 종료 예정 경고가 남아 있음.
- `node --test tests/member-registration.test.mjs tests/member-login.test.mjs tests/community-board.test.mjs tests/member-board-admin.test.mjs`: 82개 통과.
- 신규 자동 검증: 모달 초기 포커스·스크롤 잠금·종료 후 원상 복귀, ESC 취소 처리, 외부/내부 클릭 구분, 닫기 버튼의 비전송 속성, 공유 본문의 한·영 콘텐츠/목차/미승인 상태. 기존 가입·연령·닉네임·동의·로그인·게시판 테스트도 통과.
- 실제 로컬 프로덕션 브라우저: 데스크톱 영어, 390×844 한국어 모달, ESC/X/배경 클릭, 모달 제목 포커스, 닫힌 뒤 전문 보기 버튼 포커스 복귀, 닉네임 값 보존, body 스크롤 잠금/복원, 가로 넘침 없음, 푸터에서 독립 페이지 이동 확인.
- 긴 승인 문서는 공유 렌더러와 본문 overflow 레이아웃으로 지원합니다. 실제 미승인 문서를 임시 공개하여 검증하지는 않았습니다.

작업 브랜치는 `feat/website-yukyung`입니다. 새 브랜치·commit·push·Supabase DB/데이터 변경은 수행하지 않았습니다. 기존 미완료 변경을 보존했습니다.
