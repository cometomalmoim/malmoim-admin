# 실제 문자·신청 알림 연결

## 범위
- 기존 `/admin/messages`의 이벤트 대상·직접 번호 입력·템플릿 UI를 재사용.
- 수동 문자는 국내 휴대폰 대상 LMS, 1회 최대 50개 수신번호. 해외/인스타그램 연락처는 제외.
- 서버에서 실제 이벤트·대상·전화번호·신청 revision을 다시 조회하고 개인화. 발송 직전과 worker claim에서도 대상 변경/보관 상태 확인.
- 발송 전 실제 계정 단가와 대상별 본문을 확인하고 별도 체크박스·최종 버튼으로 유료 발송 승인.
- 신규 9기/할로윈 신청은 DB trigger가 같은 transaction에 알림 작업을 생성. 활성화 이전 신청·테스트 이벤트는 자동 알림 대상 아님.
- 운영자 알림은 이벤트명·신청자명·이벤트 신청자 목록 링크를 전송. 연락처와 신청 답변은 포함하지 않음. 90 UTF-8 바이트 이하는 SMS, 초과는 LMS로 전송. 수신번호는 서버 환경변수에서만 결정.
- 실제 API 발송은 응답 후 Next.js `after`에서 수행. 외부 업체 오류가 신청 접수 성공을 취소하지 않음.

## 환경과 초기 설정
기존 사용자 등록 Production 변수: `SOLAPI_API_KEY`, `SOLAPI_API_SECRET`, `SOLAPI_SENDER_NUMBER`, `SOLAPI_ADMIN_NOTIFY_NUMBER`.
`NEXT_PUBLIC_` 금지, 실제 값·토큰·번호·문자 내용 로그 출력 금지. 서버 코드만 읽으며 UI에는 마스킹 번호와 설정 여부만 표시.
추가 Supabase secret/service_role 키, 새 프로젝트 패키지, 별도 worker 비밀값은 필요 없음.

1. `supabase/036_messaging.sql`을 검토해 SQL Editor에서 적용. 기본 실제 발송/자동 알림은 false.
2. 어드민 메시징 하단의 서버 연결 설정. SOLAPI secret·key·등록 번호들로 도출한 서버 worker 토큰의 단방향 hash만 DB에 등록. 원본 API secret은 DB에 저장하지 않음.
3. 본인 번호 테스트 준비 → 계정 LMS 단가·마스킹 수신번호·테스트 본문 확인 → 사용자 본인이 최종 버튼 클릭.
4. 발송 기록에서 도달 결과 확인. 업체 접수와 도달 성공을 구분. 실제 휴대폰 수신까지 사용자가 확인.
5. 최근 서버 설정 이후 테스트 도달 성공이 있어야 실제 발송 켜기 가능. 그 다음 새 신청 알림 켜기.
6. 등록 번호·키 변경 시 서버 연결 설정을 다시 실행하면 실제 발송/알림이 꺼지고 새 테스트가 필요.

SQL은 자동 실행하지 않으며, 에이전트가 테스트 문자·유료 발송·기능 활성화를 실행하지 않는다.

## DB·권한
- sms_settings: 기능 스위치와 worker hash. 관리자는 스위치 열만 SELECT 가능, hash는 읽을 수 없음.
- sms_batches: 운영자의 최종 확인 대상/시각/계정 단가. 10분 미리보기 유효시간, 승인자 일치 확인.
- sms_jobs: 발송 본문·수신번호·업체 그룹·상태·시각. 기존 admin_users 기반 RLS.
- sms_daily_usage: 한국 시간 일별 발송 시도 수, 초기 제한 200건. SQL lock으로 여러 worker의 중복 claim/한도 우회 방지.
- 비회원·일반회원은 조회/작성/승인 불가. 공개 worker RPC는 서버만 아는 token 검증 후 동작하며 테이블 공개 접근은 없음.
- 자동 알림 unique key는 application_source + application_id로 신규 신청마다 한 번만 생성.

## 상태·복구
- draft → queued → dispatching → accepted → delivered / failed.
- provider 접수 ID만으로 도달 성공을 표시하지 않는다. 관리자의 도달 결과 확인에서 SOLAPI 그룹 상태 조회.
- 타임아웃·5xx·결과 형식 불일치 등 불확실 결과는 unknown. 자동 재발송 금지, SOLAPI 내역에서 작업 ID/시각을 대조해야 함.
- worker가 dispatching 중 중단되면 다음 claim에서 15분 경과 작업을 unknown으로 전환. 요청을 자동 재실행하지 않음.
- 명확한 실패 건은 내역 확인 후 새 발송 확인 절차를 거쳐 처리. 자동 재발송 구현 없음.
- 알림 대기열은 신규 접수 이후와 관리자 ‘대기 중 신청 알림 처리’로 처리. 별도 정기 스케줄러는 없음. 신규 접수가 없고 응답 후 worker 실행이 중단되면 관리자의 처리가 필요.
- 하루 한도에 걸린 작업은 대기 상태로 남으며 성공으로 표시하지 않음. 수동 확인은 10분 유효시간 이후 다시 준비해야 함.
- 본문과 전화번호는 운영 DB의 관리자 전용 발송 기록에도 저장됨. 행사/프로그램 종료 후 폐기할 때 발송 기록도 포함해야 함. 자동 폐기 구현은 기존 합의대로 후속 범위.

## 검증
- 테스트 업체는 fetch mock만 사용, 실제 SOLAPI 발송 없음.
- tests/sms.test.mjs: 국내 번호, 문자 길이, HMAC/발신번호, 업체 접수·도달·실패·불명, worker 중복/설정 누락.
- tests/sms-db.test.mjs: 격리 PostgreSQL에서 실제 migration 실행, 권한·기본 off·테스트 확인·잠금·자동 알림 중복·개인정보 최소화·revision·만료·일별 제한 검증.
- 실제 Production 키 인증·단가·발신번호·문자 도달·신규 신청 알림은 사용자 테스트 전 미검증.
- 기존 메시징 문서의 ‘실제 발송 미연결’ 설명은 이 문서로 대체. 가상 미리보기와 실제 발송은 분리 유지.

## 공식 API 근거
- https://solapi.com/developers/api/authentication-api-key
- https://solapi.com/developers/api/messages
- https://solapi.com/developers/api/msg-groups-getGroupInfo
- https://solapi.com/developers/api/pricing-getMessagePricing

## 이벤트명·신청자명 알림 변경
- 먼저 새 서버 버전을 배포하고 `supabase/manual/update_application_sms_details.sql`을 SQL Editor에서 실행. 운영 DB 자동 실행 없음.
- 기존 트리거 함수 본문만 교체. 이후 생성되는 신청 알림에 이벤트명·신청자명을 포함하며 기존 발송 기록/대기열은 다시 만들거나 발송하지 않음.
- 알림 수신자는 기존 서버 환경변수로 고정. 관리자 읽기 RLS·중복방지·발송 스위치·일일 제한 유지.
- 이름이 포함된 본문은 SOLAPI와 운영자 휴대폰으로 전달됨. 문자 기록도 기존 관리자 전용 자료와 함께 행사 후 정리 대상.
- 긴 알림은 LMS 과금. 현재 계정 조회 단가를 어드민에서 확인할 수 있으며 고정 요금을 코드에 넣지 않음.
- 실제 개인정보를 포함한 유료 문자 테스트는 실행하지 않음. 새 신청에서 실제 수신 여부는 SQL 적용 후 확인 필요.
- 검증: SMS 모의 테스트 10개 통과, 격리 PostgreSQL에서 9기·할로윈 이름 포함/연락처 제외/중복 방지/RLS/일일 제한 통과. lint 오류 0(기존 경고 2), TypeScript 통과, 별도 검증 worktree build 종료 코드 0.
