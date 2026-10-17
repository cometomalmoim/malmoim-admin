# 17단계: 완료 PDF 서버 Storage Adapter 검토

## 범위와 기존 구조
실제 DB/Storage/버킷/문자/OTP 연결·SQL 실행 없음. src/lib/esign-pdf-storage.ts는 server-only 모듈이며 SDK·키·다운로드 URL 생성이 없다. 운영 라우트나 기존 시연에는 연결하지 않았다. 기본 인증은 기존 denyAdminSession을 재사용해 거부한다.

기존 esign-demo-pdf.ts는 1페이지 원문에 이름·날짜·동일 서명 2곳을 적용하고 완료 기록 1페이지를 추가한다. esign-demo-flow.ts는 제출·필수/선택 동의·취소/만료를 검증해 메모리 요청을 완료 처리하고 메모리 PDF를 제공한다. 관리자 개발 API의 demo-pdf도 같은 메모리 PDF를 반환한다. 이 코드는 수정하지 않았다. 14~16단계 검토 문서의 영구 저장·권한·스냅샷 제한은 유지한다.

## 계약과 신뢰 경계
- CompletedPdfReader: 서버가 관리하는 요청/복합 신청 식별자/제출 ID/완료 시각/기대 PDF SHA-256/페이지 수를 조회한다. 브라우저가 보낸 completed나 hash로 대체하지 않는다. 실제 DB 구현은 없다.
- PrivatePdfTransport: 비공개 객체의 원자적인 putIfAbsent와 get. upsert 금지. 실제 Supabase transport는 없다.
- EsignPdfStorage.save: 내부 서버 작업 전용. 유효한 UUID, 완료된 서버 기록, 크기·PDF 표식·기존 pdfStructure의 암호화/위험 동작 검사·페이지 수·hash를 검증한다. 한도 20MiB는 이 offline adapter의 기술적 제한이며 운영 업로드 정책 승인값은 아니다.
- 서명이 실제로 존재하는지 파일 모양만으로 판정하지 않는다. 기존 서버 제출 검증이 발행한 신뢰 가능한 완료 기록과 기대 hash가 필요하다. 이 기록을 위조 가능한 호출자 입력으로 만들면 안전하지 않다.
- 저장 후 readback으로 bytes/hash를 확인한 뒤에만 서버 파일 참조를 반환한다. 반환 참조를 DB에 영구 기록하거나 요청의 저장 완료를 확정하는 RPC는 아직 없다. 저장 완료와 서명 접수 완료는 별도 상태로 설계한다.
- OfflinePrivatePdfTransport는 기존 OfflinePdfStore를 재사용한다. 메모리 객체 키는 내부 경로 hash이며 디스크 파일·실제 버킷 생성 없음. 실패·응답 유실·확인되지 않은 성공을 주입해 시험한다.

## 버킷·경로·DB 참조 제안
전용 esign-completed는 private로 구성하고 기존 certificate-* 버킷을 재사용하지 않는다. 원본은 esign-originals, 임시는 esign-staging, 서명 이미지 별도 보관 승인 시 esign-signatures를 분리한다. 실제 버킷은 생성하지 않았다.

경로: event UUID/source/application UUID/request UUID/submission UUID/fileId.pdf. fileId는 이 조합을 정규화한 SHA-256으로 결정한다. 파일 내용 hash와 파일 식별자는 별개다. 이름·전화번호·토큰은 경로에 넣지 않는다. 같은 제출 키는 동일 경로를 재사용하며 다른 내용 덮어쓰기를 허용하지 않는다.

esign_files에는 fileId, request/submission/version 관계, bucket/path UNIQUE, MIME, size, content SHA-256, staged/ready/orphaned 상태·시각을 저장하는 안을 권장한다. 신청자 복합 키는 요청과 연결하고 서버에서 이벤트 소속을 확인한다. 파일과 요청·제출 관계의 무결성, pageCount, 완료 receipt hash, 보관 기한을 DB 담당자가 승인해야 한다. 현재 adapter의 파일 참조는 서버 내부 값이며 브라우저 응답 DTO가 아니다.

## 실패·재시도
같은 키·같은 PDF는 파일을 재사용한다. 원자적인 create-if-absent가 다중 서버에서도 보장돼야 한다. 업로드 예외 뒤 동일 경로를 읽어 동일 hash이면 응답 유실을 복구한다. 객체가 없으면 재시도 오류이며 저장 완료로 반환하지 않는다. 다른 hash면 충돌 차단한다. 정상 업로드 응답이어도 readback에 파일이 없거나 hash가 다르면 완료 참조를 반환하지 않는다.

네트워크 오류와 존재하지 않음은 실제 transport에서 구분해야 한다. readback 자체 실패도 성공으로 취급하지 않는다. 객체 확인 후 요청/제출 binding이 변경됐으면 참조 반환을 중단한다. 생성된 고아 파일은 즉시 삭제하지 않고 durable job으로 추적해야 한다. 업로드 성공→DB 확정 응답 유실은 15단계의 멱등 확정/상태 재조회 계약으로 처리하며 이번 adapter만으로 DB transaction까지 해결하지 않는다.

## 다운로드 권한
AdminSessionAdapter.currentAdmin을 요청마다 호출한다. 인증 실패는 기본 거부. 서버 요청의 이벤트 scope가 없는 관리자는 객체 읽기 전 거부한다. 완료 기록·파일 무결성·최신 binding을 확인하고 비동기 읽기 이후 권한을 다시 검사한다. 반환값은 bytes/안전한 filename/MIME뿐이며 path·bucket·service key·signed URL을 브라우저에 반환하지 않는다.

실제 API는 서버 프록시 스트리밍, private/no-store, nosniff, 안전한 Content-Disposition과 다운로드 감사 기록을 추가해야 한다. 프로세스 안 재검사 이후의 권한 회수까지 절대적인 즉시 차단을 보장하지 않는다. 실제 인증·scope/RLS 및 요청별 감사 기록 검증이 별도로 필요하다. 참가자 본인 다운로드는 이번 관리자 adapter의 범위 밖이며 별도의 요청 전용 인증 세션 계약이 필요하다.

## 삭제·만료·보관 정책 — 결정 대기
서명 요청 링크 만료와 완료 PDF 보관 만료를 동일시하지 않는다. 원본·서명·완료 PDF·동의·감사·백업의 보관 기간, 취소 후 고아 파일 정리 시점, 법적 보존 예외, 파기 권한·로그·복구 절차는 승인 대기다. 자동 삭제나 재서명 허용을 이번에 추가하지 않았다.

## 실제 연결 전 승인·구현
1. 별도 테스트 프로젝트·신규 키·비용·private 버킷·파일 크기/MIME 정책 승인.
2. 실제 관리자 세션 UUID와 이벤트 권한, 다운로드 audit 및 최소 권한 서버/worker 역할 검토.
3. 서버 제출 receipt·기대 hash·pageCount의 신뢰 가능한 원자 저장, esign_files FK/UNIQUE/RLS 승인.
4. 실제 create-if-absent와 읽기 transport, 동시 업로드 충돌·응답 유실·정합성·다중 서버 테스트.
5. durable PDF job·DB 완료 확정 RPC·재시작 복구·고아 객체 정리·보관/파기 절차 승인.
6. 기존 시연을 운영 기능으로 단순 활성화하지 않으며 참가자 인증·SMS/OTP 연동은 별도 승인.

모든 현재 저장·실패 시험은 가상 메모리다. 서버 재시작 시 사라지고 운영 접근 보안·영구 보관·백업·법적 증명 완료를 의미하지 않는다.
