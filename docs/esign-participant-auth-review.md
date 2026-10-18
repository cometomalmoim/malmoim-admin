# 18단계: 참가자 링크·본인 확인 서버 Adapter (가상 검증 전용)

## 조사 및 연결 범위
기존 esign-demo-flow.ts는 randomBytes 개발 링크, DEMO- 가상 코드, 요청별 30분 세션을 메모리에 보관한다. timingSafeEqual로 코드를 비교하며 만료·취소·자격 변경은 요청 조회 때 검증한다. 완료 후에는 PDF 조회를 허용하지만 새 제출은 차단한다. 기존 API의 fixture-admin 및 개발 코드는 실제 인증이 아니다. 기존 시연 코드를 수정하거나 새 adapter로 교체하지 않았다.

13~17단계 계약/검토 문서의 복합 키·서버 재검증·기본 거부·재발급 보류를 유지한다. 새 esign-participant-auth.ts는 server-only이며 Supabase/Storage/SMS SDK·키·환경변수 변경·SQL·공통 인증 변경 없음. 실제 API나 공개 경로가 설치되지 않았다. 반환 /sign/<token>은 향후 링크 경로 계약이며 현재 실제 접근 페이지를 만든 것이 아니다.

## 계약과 저장
- AdminSessionAdapter: 기존 서버 계약 재사용. 기본 denyAdminSession. 검증된 관리자만 이벤트 범위를 확인해 링크를 발급한다. fixture 참가자 코드를 관리자 권한으로 사용하지 않는다.
- SigningAuthRequests.current: 서버 소유 요청의 복합 키·pending 상태·서버 만료·generation·revision·전달 대상 번호를 제공한다. 브라우저의 상태/번호/이름을 신뢰하지 않는다. 실제 구현은 16단계 신청자 자격 조회와 최신 관리/참여/보관 상태를 결합해야 한다.
- commitSubmission: 기대 binding, operation ID, payload hash, 서버 시각을 받아 최신 요청·자격·세대·연락처·동의/서명 payload를 원자적으로 검증하는 서버 RPC 계약이다. 인증 성공은 동의/서명 검증을 대체하지 않는다. 현재 구현은 테스트 source뿐이며 실제 서명 DB 저장/PDF 생성과 연결하지 않았다.
- MemorySigningAuthStore: 토큰 SHA-256과 활성 링크 인덱스, OTP HMAC/nonce/만료, 인증 세션 hash만 관리한다. 공유 store 큐가 인증·재발송·제출을 직렬화한다. 토큰 원문과 세션 원문은 발급 응답에서 한 번만 반환하고 store에 원문으로 보관하지 않는다.
- OTP는 randomInt의 6자리 난수이며 HMAC-SHA256(서버 비밀값, 링크 hash+nonce+code)로 보관한다. 비교는 timingSafeEqual. 비밀값을 환경변수나 브라우저에 넣지 않는다. 운영에서는 승인된 서버 secret 관리·회전 정책이 필요하다.
- SigningOtpProvider.send는 서버에서 확인한 번호와 코드를 받는 전송 계약이다. FakeSigningOtpProvider는 테스트 inbox에만 보관한다. inbox를 라우트·브라우저 상태·로그에 반환하지 않는다. 실제 전송 provider는 없다.

## 개발용 제한값 — 운영 승인 아님
기존 실제 OTP 정책은 확인되지 않았다. developmentAuthPolicy는 가상 시험 기본값이다.

| 항목 | 가상 기본값 |
|---|---|
| 링크 | 최대 7일, 요청 만료를 넘지 않음 |
| OTP | 6자리, 최대 5분, 링크 만료 이내 |
| 실패 시도 | 링크 전체에서 최대 5회, 재발송으로 초기화하지 않음 |
| 발송 | 최초 포함 최대 3회, 간격 60초 |
| 인증 세션 | 최대 10분, 링크 만료 이내 |
| 링크 저장 용량 | 프로세스당 최대 1000개, 도달 시 거부 |

실제 위험 수준·트래픽·국가별 전달·비용·접근성·복구 절차를 검토해 운영값을 승인해야 한다. 현재 값이 실제 본인 확인 수준이나 법적 신원 확인을 보증하지 않는다. 번호를 소유한 사람과 신청자가 동일인인지는 별도 정책이다.

## 상태·경합·재발급
토큰 hash가 없거나 만료/비활성화/완료/취소/요청 변경이면 기본 거부한다. binding에는 이벤트/source/application/request ID와 generation/revision/번호/만료가 포함되어 다른 요청·신청 경로·연락처 변경에 재사용할 수 없다. 서명 완료 후 새 OTP·새 제출은 차단한다. 완료 PDF 재다운로드는 17단계의 별도 권한 경계이며 이 세션을 자동 재사용하지 않는다.

재발급은 기본 REISSUE_POLICY_HOLD다. 가상 테스트에서만 allowTestReissue를 명시하면 새 활성 hash로 교체해 기존 링크·세션을 막는다. production에서는 이 플래그로도 재발급을 허용하지 않는다. 실제 UI/API는 연결하지 않았으며 승인된 운영 재발급 정책을 새로 만든 것이 아니다.

OTP 발송 횟수는 provider 호출 전에 예약하고 실패/응답 유실 때 되돌리지 않는다. 재발송 시 challenge를 교체한다. provider 실패 후 정답을 검증할 수 없게 challenge를 지우고 실패 응답은 통일한다. 비동기 전송 뒤 요청 상태를 다시 확인한다.

인증 시도·재발송·제출은 공유 store에서 직렬화한다. 인증 성공은 한 요청의 한 세션에 귀속된다. 제출에 소비된 세션은 재사용하지 않는다. commit 응답이 유실되면 세션을 다시 열지 않으며 서버의 영구 멱등 기록/작업 상태 조회로 해결해야 한다. 현재는 그 복구 API가 없다. 실제 commitSubmission이 원자 재검증을 구현하지 않으면 사전 검사만으로 상태 변경 경합을 막을 수 없다.

## 개인정보·오류·로그
번호는 서버 source에서 일시적으로 전송 provider에 전달하고 auth store에는 번호 원문 대신 binding hash만 남긴다. 참가자 오류는 SIGNING_ACCESS_DENIED로 통일하며 provider 내부 오류·신청자 존재·전화번호·OTP를 노출하지 않는다. 인증 전 이름/문서/경로/PDF를 반환하지 않는다. 코드에 console/logger 호출이 없고 테스트도 확인한다. 이는 실제 호스팅 접근 로그 검증을 대신하지 않는다.

실제 링크 배포 전 URL access log·analytics·리퍼러의 토큰 유출 차단, no-store/referrer-policy, 토큰 교환 후 URL 정리, 요청 전용 httpOnly/secure/sameSite 세션 쿠키·CSRF, IP/번호/요청 단위 분산 rate limit을 설계한다. 현재 session은 adapter 반환값일 뿐 브라우저 쿠키/API로 연결되지 않았다. 원문 토큰·OTP·인증 비밀은 서버 메타데이터·감사 로그에 기록하지 않는다.

## 실제 DB·SMS/OTP 연동 전 승인·구현
1. 별도 테스트 프로젝트·계정·키·비용·발신번호·문자 업체/인증 수준 승인. 실제 개인정보를 테스트에 복사하지 않는다.
2. esign_access_tokens/challenges/sessions 및 요청 generation·auth revision·멱등 제출 ledger의 영구 저장·RLS/권한·트랜잭션 설계 승인.
3. 실제 관리자 scope 인증, 신청자 자격/연락처 최신 조회와 원자적 제출 RPC, OTP provider의 idempotency/delivery/outbox 계약 구현.
4. 분산 서버의 실패 시도/재발송 수/세션 소비 CAS·잠금, 서버 시계, secret 회전, 재시작·장애 복구·재발급 정책 검증.
5. 보관·파기·민감 로그 처리·미수신/번호 변경·계정 복구·완료 PDF 재접근 정책 승인.

현재 메모리는 재시작 시 사라지고 서로 다른 store/서버는 공유하지 않는다. 프로세스 큐는 DB 원자성이나 분산 rate limit을 보장하지 않는다. 새로운 adapter는 기존 개발 시연의 보안을 자동 강화한 것이 아니며 실제 서버 인증·영구 보관·업체 본인 확인 연동을 완료했다고 간주하면 안 된다.
