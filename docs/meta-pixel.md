# Meta Pixel — 랜딩 방문 및 신청 완료

픽셀 ID: `1120189660978956` (공개 식별자).

## 적용 범위
운영 `malmoim.com`/`www.malmoim.com`의 `/season9`, `/season9/en`, `/2026halloweenparty`, `/2026halloweenparty/en`만 추적. 9기 신청 `/season9/apply`, `/season9/en/apply`는 신청 완료 전환만 허용하고 PageView는 보내지 않는다. 관리자·로그인·기타 공개 페이지, localhost, Vercel 미리보기는 제외한다.

- 광고 측정 동의 전에는 외부 SDK를 로드하거나 PageView를 전송하지 않음. 거절해도 신청 가능.
- 사용자 요청으로 광고 측정 안내·동의 배너와 고정 설정 버튼을 제거했다. 기존 localStorage의 `malmoim-meta-consent-v1=granted`가 있는 브라우저에서만 측정한다. 동의 기록이 없거나 거절한 방문자에게 SDK를 로드하지 않으며, 동의를 자동 생성하지 않는다. 신규 방문자는 방문·신청 완료 추적 대상이 아니다.
- 동의 후 Next Script로 Meta SDK를 한 번 로드. 초기화 한 번, 같은 경로의 반복 렌더/onLoad/onReady에서 PageView 중복 방지. 언어/랜딩 경로 이동은 새로운 조회로 처리.
- 비대상 경로 진입 또는 동의 철회 시 Meta consent revoke. 이미 전송한 이벤트의 소급 삭제 기능은 아님.
- 자동 설정(`autoConfig`) 비활성화, advanced matching 데이터 전달 없음. 이름·전화번호·이메일·신청 답변을 이벤트 인자로 전달하지 않음.
- 동의 우회 방지를 위해 원본 스니펫의 noscript 추적 이미지는 넣지 않음.
- 9기 DB `accepted=true`, 할로윈 DB `saved` 성공 응답에만 `CompleteRegistration`을 전송한다. 관리자 테스트·오류·중복 신청에는 전송하지 않는다. 신청 완료는 결제나 참가 확정과 별개다.
- 개인정보 대신 행사 slug·신청 언어·무작위 submission UUID 기반 eventID만 명시적으로 전달한다. SDK는 기본 방문 URL·쿠키를 사용할 수 있다.
- 성공 응답 시 광고 측정 동의가 있어야 하며, SDK 지연 로드를 기다린다. 나중에 처음 동의한 경우 과거 성공을 소급 전송하지 않는다.
- Web Locks와 localStorage로 같은 eventID를 탭·재렌더 간 한 번만 전송한다. 저장소/잠금 API 차단 또는 SDK 차단 시 전환은 누락될 수 있으며 신청 성공 UI에는 영향을 주지 않는다. 전송 전 기록하므로 실패 시 자동 재전송하지 않으며 Meta 수신을 보장하지 않는다.
- CAPI, Lead/Purchase, 결제 전환은 구현하지 않음.

## 검증
- 모의 테스트: 운영 경로 범위, 동의·SDK 준비, 초기화/중복 방지, 성공 응답별 전환, 한·영 행사 구분, 저장소 차단·픽셀 오류 격리 검증.
- lint 오류 0(기존 suggestions.ts 경고 2), TypeScript 통과.
- 실제 광고 클릭·Meta Events Manager 수신 확인은 미검증. 실제 이벤트를 테스트하기 위해 임의의 신청이나 전환을 만들지 않음.

## 운영 확인
Meta Events Manager에서 해당 데이터 소스를 선택 → 이벤트 테스트에서 기존 측정 동의 기록이 있는 브라우저로 운영 랜딩을 열고 PageView가 표시되는지 확인한다. 동의 기록이 없거나 거절된 브라우저에서는 SDK·이벤트가 전송되지 않아야 한다. 실제 신청 성공 이후 `CompleteRegistration` 수신과 `event_slug`·`language`를 확인한다. 운영 DB에 가짜 신청을 만들거나 전환을 임의 발생시키지 않는다. 자동 고급 매칭과 이벤트 설정 도구로 별도로 만든 자동 이벤트가 있다면 담당자가 그 설정을 확인해야 한다.

참고: Next.js 설치 패키지의 scripts 가이드 및 Meta 공식 GTM 템플릿 https://github.com/facebook/GoogleTagManager-WebTemplate-For-FacebookPixel/blob/main/template.tpl . Meta 개발자 문서 직접 조회는 HTTP 429로 제한되어 읽었다고 간주하지 않음.
