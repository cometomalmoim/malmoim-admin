# 20단계 전자서명 최종 검증·운영 전환 체크리스트

20단계 완료는 운영 준비 완료 또는 실제 본인 인증·영구 저장 완료를 의미하지 않는다. 실제 DB/Storage/SMS/OTP 연결, SQL 실행, 환경변수 변경, 운영 API 활성화는 하지 않았다.

## 1. 기준과 검증 범위
- 개인 브랜치 feat/events-yewon. 19단계 커밋 7433f62에서 PR #117 병합 커밋 eacec4a로 fast-forward. 동기화 전후 트리 차이 없음.
- 운영 DB 적용 상태는 미확인. 아래 DB 설명은 저장소 SQL·코드·검토 문서의 정의다.
- 기존 개발 서버를 변경하지 않고 환경변수·.env·supabase/.temp를 복사하지 않은 work/stage20-final-38ic9qd9에서 기존 의존성으로 검증한다. 패키지 설치 없음.

## 2. 기능별 구현 구분
A는 기존 개발 UI, B는 서버 Adapter/자동 테스트, C는 운영 연결 또는 추가 개발이다. A와 B는 동일한 운영 흐름으로 연결되지 않았다.

| 기능 | A: 기존 UI 시연 | B: 서버·테스트 | C: 남은 운영 작업 |
|---|---|---|---|
| PDF 업로드·템플릿·필드 | 브라우저 PDF 업로드/모든 페이지·이름/날짜/서명 위치·수정, 메모리 템플릿 | PDF 검증·좌표·생성 테스트 | 승인 원본/버전/필드·동의 문구 영구 게시 |
| 신청자 자격 | 가상 이벤트/합격자·제외 사유·선택 | ApplicantReader 복합 키·최신 상태 계약 | 실제 일관 조회 RPC/adapter |
| 요청·상태 | 개발 API·서버 메모리 요청/취소/조회 | repository·중복·멱등·통합 처리 | DB 제약·원자 생성·감사 |
| 링크·인증 | 개발 테스트 링크와 DEMO 가상 확인 | 18단계 난수/hash 링크·OTP HMAC·제한·요청 세션 | 실제 provider·쿠키·분산 제한·SMS outbox |
| 원문·서명·동의 | 모바일 시연·초기화·필수/선택 동의·제출 | authorize·최신 binding·제출 접수 | 게시 원본 버전 고정·원자 접수 |
| 완료 PDF | 명시적 개발 테스트 PDF 생성·미리보기/다운로드 | 통합 시 원문1+기록1페이지·SHA-256·구조/readback | 실제 업로드 원본과 서버 렌더러 연결 |
| 비공개 저장 | 서버 메모리 PDF, 실제 버킷 없음 | OfflinePdfStore/PrivatePdfTransport 가상 객체 | private 버킷·파일 DB·서버 transport |
| 관리자 다운로드 | 개발 역할·메모리 완료본만 | 이벤트 scope/완료/무결성·읽기 후 재검증 | 실제 auth UID/scope·감사·스트리밍 |
| 보관·취소 | 가상 상태 시험 | 이벤트 보관/취소/만료/revision 재검사 | 운영 정책·원자 CAS/잠금 |
| 중복·실패 복구 | 이전 시연의 제한된 메모리 처리 | 동시 제출·동일 PDF 재사용·실패/응답 유실 복구 | durable job/lease·다중 서버·재시작 복구 |

근거: src/components/document-admin/{document-admin-preview,signing-target-preview,template-workspace}.tsx, src/components/pdf-fields/, src/lib/{pdf-fields,pdf-signing,esign-demo-flow,esign-demo-pdf,esign-demo-state,esign-applicant-reader,esign-participant-auth,esign-pdf-storage,esign-integration-flow}.ts.

4단계 기본 현황 표의 완료 이력은 가상 기록이며 실제 PDF가 없으면 버튼이 비활성화된다. 6단계 서버 요청 시연에서 실제 생성한 메모리 PDF와 혼동하지 않는다. 관리자 업로드 템플릿이 19단계 고정 테스트 서류를 자동 대체하지 않는다.

## 3. UI/API 연결 순서 — 제안이며 미구현
기존 /preview/document-admin, /preview/sign/[token] 및 /mobile은 개발 전용으로 유지한다. 기존 fixture 헤더·DEMO 코드를 운영 인증으로 승격하지 않는다. OfflineEsignIntegration은 development/test 전용 harness이며 그대로 운영 라우트에 설치하지 않는다.

| 순서/API 제안 | 서버 필수 검사 |
|---|---|
| 관리자 GET /api/admin/esign/targets | 실제 세션 UID·동작 권한·이벤트 scope, 최신 복합 키·관리/참여/보관 |
| 관리자 POST /documents, /versions/:id/publish | 업로드 형식/크기/암호화·위험 PDF, 원본 hash·좌표·동의 버전 불변화 |
| 관리자 POST /requests | 서버 조회 자격·이벤트 보관·게시 버전·연락처, 멱등 키/hash·중복을 한 RPC에서 검증 |
| 관리자 GET /requests, /:id | scope 제한·페이지 처리·안전한 DTO, 토큰/OTP/내부 경로 제외 |
| 관리자 POST /:id/cancel, /:id/reissue | 최신 상태·generation 교체·세션 폐기·감사; 재발급 정책 미승인 시 거부 |
| 참가자 POST /api/esign/access, /otp, /verify | 토큰 hash·만료/취소/세대·요청 귀속, 분산 속도 제한·OTP 제한 |
| 참가자 GET /document, POST /submit | 요청 전용 서버 세션, 필수/선택 응답·서명·문서 hash, 최신 자격/연락처/보관, 단일 접수 |
| 참가자 GET /status, /pdf | 자기 요청만, PDF ready 상태, 별도 승인된 완료 후 재접근 세션 |
| 관리자 GET /requests/:id/pdf | 다운로드 직전 실제 권한·scope·ready·hash 재확인, 감사 |

공통: 상태변경은 동일 출처/CSRF·입력 한도·멱등·no-store. 참가자 오류는 존재 여부를 추측할 수 없게 처리. 토큰 교환 후 URL 정리, HttpOnly/Secure/SameSite 쿠키, Referrer-Policy, 안전한 Content-Disposition/nosniff. 토큰 경로·인증 비밀은 analytics/access log에서 제거한다. 향후 운영 경로는 src/proxy.ts 및 공통 인증 경계를 별도 검토하며 이번에는 수정하지 않았다.

## 4. DB와 Storage 준비
신청자 식별은 (event_id, source, application_id), source는 season9/registration/manual. 통합 뷰는 FK 대상이 아니므로 원본별 소속 검증·참조 무결성 전략 승인이 필요하다. 기존 신청자 테이블은 변경하지 않는 구조를 우선한다.

- 문서: esign_documents, esign_document_versions, esign_consent_items. 게시 원본 hash·필드·문구와 버전을 고정한다.
- 요청: esign_requests, esign_audit_events. 복합 키/문서 중복 제약, generation·revision·연락처 binding·만료·생성자·변경 이력.
- 인증: esign_access_tokens, esign_verification_challenges, esign_sessions. hash/HMAC·시도/재전송 수·만료·소비·무효화 상태 영구 저장.
- 제출/복구: esign_submissions, esign_consent_responses, esign_files, esign_pdf_jobs 및 멱등 ledger. 접수와 PDF ready를 구분, 작업 lease/retry/오류·orphan 추적.
- 문자: esign_message_outbox, esign_message_attempts. 실제 발송은 승인된 worker만, 중복 전송·응답 유실 결과 추적.

private 버킷 제안은 esign-staging/originals/completed, signatures는 별도 이미지 보관 승인 시에만. 경로는 UUID/source/request/submission/file ID로만 구성하고 이름/전화/토큰 금지. file ID와 내용 SHA-256을 구분한다. bucket/path UNIQUE, MIME/크기/hash/pageCount/원본 버전 관계를 DB로 관리한다. RLS 기본 거부·동작별 scope, 공개 직접 쓰기 금지, 브라우저 서비스 키 금지. 기존 certificate 버킷/정책을 재사용·변경하지 않는다.

원자 RPC 필요: 자격 확인+요청 생성, 세션 소비+제출 예약, job claim/lease, ready 확정+동의/파일/감사, 취소/재발급. 독립 HTTP SELECT 여러 개는 일관 snapshot 계약을 충족하지 않는다. 파일/DB는 단일 트랜잭션이 아니며 실제 원자성을 현재 구현이 보장하지 않는다.

근거: docs/esign-request-storage-review.md, esign-production-readiness-review.md, esign-server-integration-review.md, esign-offline-recovery-review.md, esign-applicant-adapter-review.md, esign-pdf-storage-review.md, esign-participant-auth-review.md, esign-integrated-recovery-review.md.

## 5. 복구·동시성·데이터 유지
현재 모든 가상 저장소는 서버 재시작 시 소실되고 다중 서버 간 공유되지 않는다. 기존 UI는 브라우저 테스트 세션 ID도 필요하며 같은 프로세스/세션에서만 재조회한다. 새 통합 harness는 API가 없으므로 브라우저 새로고침으로 접근하는 저장소가 아니다.

운영 순서: 원자 제출 예약 → durable PDF job → 불변 객체 put-if-absent → readback/hash → 최신 자격·권한·revision CAS → ready/감사 원자 확정. 실패 시 완료 표시 금지. 동일 제출/작업 키는 기존 bytes/파일/결과를 재사용한다. 저장 성공 응답 유실은 readback, DB 확정 응답 유실은 ledger/상태 조회로 판정한다. 불확실한 파일을 새 키로 반복 생성하지 않는다.

취소/보관/권한 변경 뒤 업로드된 객체는 공개하지 않고 orphan으로 추적한다. 정리 전 활성 job/ready 참조/법적 보존 여부 대조, 유예·삭제 승인·감사·재시도 필요. 자동 삭제 기간은 미정이다. 서버 재시작·DB 확정 장애·다중 worker 경합·백업 복원은 실제 테스트 환경에서 추가 검증해야 한다.

## 6. 보안·정책 승인 대기
- accepted+다른 조건 충족만 임시 허용. received/reviewing+confirmed는 보류, waitlisted/declined/withdrawn/cancelled·불명확 보관/최신 상태는 거부. 합격 취소·참가 확정 운영 조합 확정 필요.
- 이벤트 보관 시 신규 요청/재발급/미완료 처리 차단, 기존 완료본은 scope 확인 후 조회하는 가상 정책. 실제 archived 의미·archive_revision 매핑과 운영 정책 승인 필요.
- 링크 최대7일·OTP6자리/5분·실패5회·발송3회/60초·세션10분은 18단계 개발 기본값이며 운영 승인값이 아니다. 19단계 테스트 요청 만료1일과 구분한다.
- 재발급은 기본 보류. 연락처 변경 후 새 확인, 완료본 재다운로드 인증, 재서명은 별도 generation/새 제출 이력 정책 승인 필요. 완료 증적 덮어쓰기 금지.
- 관리자 ID/eventIds는 실제 세션/권한 DB로 도출해야 한다. 공통 getAdminAccess는 email/admin 여부를 반환하며 전자서명 계약의 id/eventIds를 제공하지 않는다. 전체 관리자를 모든 이벤트 관리자라고 가정하지 않는다.
- 개인정보 수집 목적/항목/기간/거부 안내와 촬영·홍보 선택 동의를 별도 승인한다. 활동 규칙/환불 확인이 적법한 개인정보 동의를 자동 대체하지 않는다.
- 원본/서명/완료본/동의/감사/실패 객체/백업별 보관·파기·법적 보존·다운로드 감사 정책 미정. SHA-256은 변경 탐지이며 법적 신원 증명 자체가 아니다.
- Adapter에 민감 로그 출력이 없다는 코드 검사는 호스팅·프록시·업체 로그 안전성을 증명하지 않는다. 실제 로그/백업·접근권한 점검 필요.

## 7. 기존 기능 호환성
이번 동기화는 같은 파일 트리의 병합 커밋만 반영했다. 이벤트·신청자·설문·수료증·납부/환불·실제 문자·공통 인증 코드는 수정하지 않았다. 자동 테스트 통과는 실제 운영 DB에서 이 기능들을 실행 검증한 결과가 아니다.

신청자 관리의 effective status/participation/archive와 기존 revision을 재사용해야 한다. 최신 src/lib/recruitment.ts는 event_application_language_list를 사용하고, 16단계 reader는 event_application_admin_list 계약이다. 선택 필드·원본 뷰 관계와 실제 적용 상태는 실제 연동 전 담당자 확인이 필요하다. 이벤트는 is_archived/archive_revision을 TestEvent.archived/revision으로 서버에서 명시 매핑해야 한다.

src/proxy.ts의 matcher에 /preview는 없고 개발 페이지/API는 development 제한이다. 새 운영 경로를 만들 때 인증 우회·참가자 경로의 관리자 강제 리다이렉트를 모두 검토한다. 실제 solapi/sms-worker와 가상 OTP는 import/전송 계약이 분리돼 있다. 지금의 Fake provider를 운영 서비스에 등록하지 않는다.

## 8. 우선순위 운영 전환 체크리스트
### P0: 승인과 차단 조건
- [ ] 팀장/DB 담당자: 별도 테스트 프로젝트·새 키·비용·권한·스키마/RPC 적용 현황 승인
- [ ] 관리자 scope·참가자 본인 확인 수준·합격/보관/연락처/재발급/재서명 정책 승인
- [ ] 개인정보 문구·보관/파기·감사·업체/발신번호/로그 정책 승인
### P1: 분리된 테스트 환경 구현
- [ ] 전자서명 전용 테이블/제약/RLS·원자 RPC·durable job/ledger 설계 검토 후 적용
- [ ] 실제 세션·일관 신청자 source·private Storage adapter, 파일 DB 참조 구현
- [ ] 운영과 분리된 UI/API·요청 전용 쿠키·속도 제한·SMS outbox 연결; feature 기본 꺼짐
### P2: 운영 전 통합 시험
- [ ] 승인 가상 데이터로 관리자→참가자→PDF ready→다운로드 검증
- [ ] 타 이벤트/타 참가자/권한 회수·보관·취소·번호 변경·선택 동의 거절 검증
- [ ] 동시 요청·다중 서버·재시작·OTP 제한·전송/저장/DB 응답 유실·orphan 정리 검증
- [ ] 모바일 실기기·다운로드 파일·PDF 시각 배치/원본 버전·접근성·부하·로그·복원 훈련
### P3: 승인 후 제한 배포
- [ ] 배포 창/담당자·알림·감사/개인정보 로그 마스킹·운영 전용 설정 검토
- [ ] 소규모 허용 범위부터 활성화, 실패율/중복/job 지연/orphan/인증 실패 관찰
- [ ] 장애 시 신규 요청·발송·worker 중지, 증적 보존 후 전진 복구; 기존 신청자 DB 되돌리기/완료 증적 삭제 금지

현재 판정: 개발 시연·가상 통합 검증 완료 범위이며 실제 운영 전환은 차단 상태다. P0~P2와 별도 서비스 활성화 승인이 필요하다.

## 9. 20단계 최종 검증 결과
- 외부 DB/SQL 없는 전체 자동 테스트 350개 통과. intake-db.test.mjs/sms-db.test.mjs 및 별도 DB 실행 스크립트는 제외했다.
- 전자서명·PDF·대상 선정 관련 묶음 114개 통과(전체 350개에 포함). 신규 테스트 추가나 기능 코드 수정은 없다.
- TypeScript: 최초 격리 복사본에 생성된 Next 타입이 없어 LayoutProps 오류 발생. 프로덕션 빌드의 타입 생성 후 tsc --noEmit --incremental false 재검사 통과. 소스 수정 없음.
- ESLint: 오류0, 기존 src/app/actions/suggestions.ts의 미사용 인자 경고2. 프로덕션 next build --webpack 통과. 격리 복사본의 다중 lockfile 경고는 기능 오류가 아니다.
- 격리 localhost:3194에서 관리자 요청 생성→개발 링크 준비→참가자 가상 확인→PDF 원문→촬영 선택 동의 거절/필수 항목 확인→테스트 모양 서명→최종 확인→제출 완료→완료 PDF 표시 및 관리자 재조회/완료 PDF 링크 확인. 기존 UI 시연의 회귀이며 19단계 harness의 UI 연결 검증이 아니다.
- 브라우저 참가자 콘솔 수집 범위에서 error 없음. 실기기 모바일 전체 조작·모든 PDF 편집 조작은 이번 수동 점검 범위 밖이며 자동 회귀 테스트와 코드 확인으로 구분한다. PDF 다운로드 링크는 제공되나 자동화 timeout으로 디스크 저장 성공은 미확인이다.
- 최초 격리 개발 서버는 OS 파일 감시 EMFILE로 페이지 이동 실패. 이번에 띄운 서버만 종료하고 WATCHPACK_POLLING=true로 3194에 재실행해 화면 확인했다. 기존 서버는 종료/변경하지 않았다.
- 새 문서는 docs/esign-final-transition-checklist.md 하나. 추적 중인 소스/다른 조원 파일 변경 없음. work 아래 검증 산출물은 Git에서 제외된다.
- cli-latest SHA-256은 전후 e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855로 동일. Git 커밋/push/PR/main 병합 없음.
