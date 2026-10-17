# PDF 서명란 편집기 — 2단계

3단계에서 이름·날짜 필드와 참가자 테스트 서명·PDF 생성이 추가되었다. 현재 사용법과 검증 결과는 `docs/pdf-signing-preview.md`를 참고한다. 아래는 2단계 당시 기록이다.

이번 작업에 한해 사용자가 `feat/events-yewon` 작업을 허용했다. 고정 브랜치 변경, merge, commit, push, PR, DB/Storage/운영 서버 접근은 하지 않는다.

## 실행

프로젝트 폴더에서 `npm run dev -- --webpack --hostname 127.0.0.1 --port 3187`을 실행하고
`http://127.0.0.1:3187/preview/pdf-fields`를 연다. 기존 개발 서버와 포트가 겹치면 다른 포트를 사용한다.
로그인과 환경변수가 필요 없다. 이 경로는 기존 proxy matcher 밖에 있고 관리자 메뉴·라우터와 연결하지 않았다.
운영·테스트 모드에서는 페이지와 PDF.js 리소스 핸들러 모두 404다.

일반 PDF 서류를 선택하고 페이지별로 서명란을 그리거나 기본 서명란을 추가한다.
위치 이동, 오른쪽 아래 모서리 크기 조절, 삭제, 백분율 숫자 입력, 키보드 편집을 지원한다.
모든 페이지의 썸네일과 페이지 선택, 이전/다음, 50~200% 확대·축소, 폭 맞춤을 제공한다.
‘배치 결과 확인’에서는 편집을 잠근다. 실제 서명이나 서명된 PDF 생성은 하지 않는다.

## 독립 구성

- `src/components/pdf-fields/pdf-field-editor.tsx`: 브라우저 전용 독립 컴포넌트, `initialSettings`와 `rendererAssetBase` 선택 props.
- `src/components/pdf-fields/pdf-field-editor.module.css`: 범위가 제한된 스타일.
- `src/lib/pdf-fields.ts`: 좌표 변환·경계·설정 검증. 네트워크/DB 의존성 없음.
- `src/lib/pdf-fields-validation.ts`: 기존 `pdfStructure`와 pdf-lib를 재사용하고 형식·용량·페이지 수·암호화·실행 콘텐츠·회전을 추가 검사.
- `src/app/preview/pdf-fields/page.tsx`: 개발 전용 독립 진입점.
- `src/app/preview/pdf-fields/assets/[...asset]/route.ts`: 설치된 PDF.js worker/CMap/폰트/이미지 디코더만 같은 출처에서 제공. 업로드/문서 입력 없음. 경로 허용 목록, 운영 404.
- `tests/pdf-fields.test.mjs`: 회전·CropBox·UserUnit·설정 복구와 잘못된 입력 검사.

기존 파일 변경은 PDF.js `6.4.299` 추가를 위한 `package.json`, `package-lock.json`뿐이다.
기존 수료증·신청자·문자·공통 메뉴·라우터·인증·SQL·환경변수는 변경하지 않았다.

## 좌표 계약

설정은 `{ version: 1, fingerprint, pages, fields }`이다. fingerprint는 업로드 바이트의 SHA-256이다.
페이지는 PDF.js의 실제 `viewBox`(MediaBox와 CropBox의 유효 영역), `rotation`, `userUnit`, scale=1의
`width`, `height`, 6요소 affine `transform`을 담는다. 페이지 번호는 1부터 시작한다.
필드는 `{ id, pageNumber, rect: { x, y, width, height } }`다.

필드 rect는 **회전 전 PDF 기본 사용자 좌표계**의 양수 크기 사각형이며 원점은 PDF 좌표계를 따른다.
그리기/이동은 보이는 페이지의 왼쪽 위 기준 0~1 좌표에서 수행하고 viewport 역행렬로 PDF 좌표로 변환한다.
네 모서리를 변환해 0/90/180/270도와 CropBox 원점·UserUnit을 처리한다. CSS 픽셀이나 확대율을 영구 좌표로 사용하지 않는다.
향후 PDF에 서명 이미지를 삽입할 때에는 이 원본 좌표와 페이지 회전을 함께 고려해 이미지 방향도 맞춰야 한다.

현재 JSON을 복사해 ‘기존 설정 불러오기·수정’에 붙여넣으면 같은 PDF에 재적용할 수 있다.
문서 해시·페이지 메타데이터·버전·ID 중복·페이지 범위·좌표 범위·최소 크기를 검증한다.
설정 변경은 메모리에만 반영한다. 새 파일 선택, 새로고침 또는 탭 종료 시 사라진다.
JSON/필드를 localStorage, DB, 파일로 자동 저장하지 않는다.

## 처리 범위와 안전 경계

- PDF 5MiB 이하, 최대 50페이지, 총 서명란 200개. PDF MIME이 없는 OS 파일은 확장자·바이트·구조 검사 후 허용한다.
- 90도 단위 회전 지원. 표시 너비/높이 1~20000 단위, 캔버스당 최대 약 800만 픽셀로 렌더링 해상도를 제한한다.
- 손상·암호화·실행 액션·첨부 콘텐츠·XFA는 거부한다. 기존 구조 검사에 이름 escape 해제 검사를 덧붙인다.
- 선택 PDF는 `File.arrayBuffer()` → pdf-lib 검증 → 메모리 바이트로 PDF.js worker에 전달한다. 문서 바이트를 HTTP로 전송하지 않는다.
- 외부 CDN을 사용하지 않는다. 네트워크 요청은 개발 페이지/번들/로컬 PDF.js 리소스 로딩이며, 새 기능에 POST/PUT 업로드 경로는 없다.
- PDF.js annotation/scripting 레이어를 사용하지 않으며 XFA를 비활성화한다. 파일 검사 자체가 백신/완전한 PDF 무해화를 대체하지는 않는다.
- 복잡한 PDF의 파싱 시간/메모리를 완전히 격리하지는 못한다. pdf-lib 검사는 메인 스레드에서 수행하므로 운영 전 별도 worker·시간 제한 검토가 필요하다.
- 현재 페이지 본문과 전체 썸네일을 렌더링한다. PDF 파일 내부의 기존 양식·서명을 편집하거나 실제 전자서명을 생성하지 않는다.

## 검증 (2026-10-16)

- `node --experimental-strip-types --test tests/pdf-fields.test.mjs`: 8개 통과.
- `node --experimental-strip-types --test tests/*.test.mjs`: 전체 115개 통과. 실제 DB 테스트 파일은 실행하지 않음.
- `tsc --noEmit --incremental false`: 통과.
- 새 컴포넌트·lib·preview 경로·테스트 ESLint: 오류/경고 없음.
- `eslint src tests next.config.ts eslint.config.mjs`: 오류 0개, 기존 suggestions 액션 미사용 인자 경고 2개.
  `npm run lint`의 전체 디렉터리 탐색은 work 검증 사본도 포함하므로 중단하고 위 범위로 검사했다.
- 환경변수 없는 `work/pdf-fields-check` 사본에서 `npm run build -- --webpack`: 통과.
- 같은 사본을 로컬 프로덕션 모드로 실행해 새 페이지와 worker 리소스 경로의 HTTP 404를 확인한 뒤 종료했다.
- 앱 제공 브라우저: 가상 한글 4페이지, 회전 4종·CropBox·UserUnit, 마우스 그리기/이동/크기 조절, 여러 필드,
  페이지별 분리, 삭제, 키보드 이동/크기 조절, JSON 복구, 다른 문서 설정 거부, 읽기 전용 결과 확인.
- OS 샌드박스가 별도 Chromium 실행을 차단하여 Playwright 일괄 UI 스크립트는 완료하지 못했다. 권한을 우회하지 않고 앱 브라우저로 확인했다.
- 브라우저 viewport 요청이 실제 390px로 적용되지 않아 모바일 390px 실측은 미검증이다. 실제 1040px에서 가로 넘침 없음.

## 후속 단계

참가자 서명 입력, 동의 항목, 개인 링크, 인증, 문자, 영구 저장, 서버 PDF 생성, 다운로드 권한은 미구현이다.
운영 화면과 연결하려면 권한 정책과 PDF.js 정적 리소스 배포 경로를 별도로 정해야 한다.
