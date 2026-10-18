# Meta Pixel — 랜딩 PageView

픽셀 ID: `1120189660978956` (공개 식별자).

## 적용 범위
운영 `malmoim.com`/`www.malmoim.com`의 `/season9`, `/season9/en`, `/2026halloweenparty`, `/2026halloweenparty/en`만 추적. 관리자·로그인·신청 입력·기타 공개 페이지, localhost, Vercel 미리보기는 제외한다.

- 광고 측정 동의 전에는 외부 SDK를 로드하거나 PageView를 전송하지 않음. 거절해도 신청 가능.
- 동의는 브라우저 localStorage의 `malmoim-meta-consent-v1`에 저장. 랜딩의 광고 측정 설정에서 변경 가능. 브라우저 저장이 막혀 있으면 현재 페이지의 메모리에서만 유지.
- 동의 후 Next Script로 Meta SDK를 한 번 로드. 초기화 한 번, 같은 경로의 반복 렌더/onLoad/onReady에서 PageView 중복 방지. 언어/랜딩 경로 이동은 새로운 조회로 처리.
- 비대상 경로 진입 또는 동의 철회 시 Meta consent revoke. 이미 전송한 이벤트의 소급 삭제 기능은 아님.
- 자동 설정(`autoConfig`) 비활성화, advanced matching 데이터 전달 없음. 이름·전화번호·이메일·신청 답변을 이벤트 인자로 전달하지 않음.
- 동의 우회 방지를 위해 원본 스니펫의 noscript 추적 이미지는 넣지 않음.
- 신청 완료 Lead/Purchase, CAPI, 결제 전환 이벤트는 구현하지 않음.

## 검증
- 모의 테스트 4개: 운영 경로 범위, 동의 전 이벤트 없음, 단일 초기화/중복 방지, 철회 시 중지와 PageView 외 이벤트 없음.
- lint 오류 0(기존 suggestions.ts 경고 2), TypeScript 통과.
- 실제 광고 클릭·Meta Events Manager 수신 확인은 미검증. 실제 이벤트를 테스트하기 위해 임의의 신청이나 전환을 만들지 않음.

## 운영 확인
Meta Events Manager에서 해당 데이터 소스를 선택 → 이벤트 테스트에서 운영 랜딩을 열고 광고 측정 동의 후 PageView가 표시되는지 확인한다. 동의하지 않음 선택 시 전송되지 않아야 한다. 자동 고급 매칭과 이벤트 설정 도구로 별도로 만든 자동 이벤트가 있다면 담당자가 그 설정을 확인해야 한다.

참고: Next.js 설치 패키지의 scripts 가이드 및 Meta 공식 GTM 템플릿 https://github.com/facebook/GoogleTagManager-WebTemplate-For-FacebookPixel/blob/main/template.tpl . Meta 개발자 문서 직접 조회는 HTTP 429로 제한되어 읽었다고 간주하지 않음.
