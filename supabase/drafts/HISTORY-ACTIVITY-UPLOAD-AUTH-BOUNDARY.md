# 활동 사진 업로드: 관리자·서버 인증 경계와 완료 증거 계약

2026-10-20 / 설계 제안만 / 실행·활성화 금지.
코드와 로컬 Next.js data-security 가이드만 읽었다. 실제 DB 역할/배포 환경/Storage 동작은 조회하지 않았다.
기존 SQL·코드·설정은 변경하지 않는다. 아래 역할/모듈/권한은 아직 존재하거나 검증됐다고 가정하지 않는다.

## 1. 코드에서 확인한 현재 경계

- src/lib/auth.ts getAdminAccess(): 매 접근에 Supabase auth.getUser()와 admin_users를 확인한다.
  반환은 상태와 이메일이며 coordinator에 필요한 actor UUID는 반환하지 않는다.
  향후 활동 전용 인증 모듈에서 같은 검증과 user.id를 사용하되 이메일을 journal에 저장하지 않는다.
  현재 helper는 getUser 오류도 anonymous로 처리하므로 새 모듈은 인증 실패/조회 장애를 구별하고 모두 변경을 거부한다.
- src/lib/supabase/server.ts: 공개 키와 요청 쿠키 기반 사용자 클라이언트다.
  server-only import나 Server Action에서 호출했다는 사실은 DB의 서버 전용 신원이 아니다.
- src/app/actions/auth.ts: 관리자 login은 인증 후 /admin으로 이동한다.
  그 이동 자체가 관리자 인가를 증명하지 않는다. 개별 액션/Route마다 인가가 필요하다.
- src/app/api/admin/resources/files/route.ts: Origin 검사, getAdminAccess, 사용자 Supabase 세션으로 작업한다.
  재사용할 패턴은 요청 출처/인가/입력 제한이며 해당 자료 업로드의 정리·시간 기준을 활동 사진에 그대로 이식하지 않는다.
- upload-coordinator.ts: requireAdmin은 어댑터 계약이다. ServerTerminationReport는 데이터 모양뿐이다.
  검증된 서버 신원·증거의 진위를 보장하지 않는다. 실제 어댑터/Route 연결은 없다.
- 기존 001: history_manage_activity는 authenticated에게 EXECUTE가 있으며 함수 안에서 관리자 여부를 확인한다.
  begin_upload의 GUC는 실행 준비 표시일 뿐 신원 인증 수단이 아니다.
  end_upload는 관리자·photo·ticket을 확인하지만 Storage 종료 증거는 확인하지 않는다.
  관리자 브라우저에서 직접 RPC를 호출할 수 있으므로 서버 전용 종료 보고 경계로 사용할 수 없다.
- 새 journal 초안: 비노출 스키마/RLS/권한 회수/빈 search_path가 있고 require_server와 report는 상시 예외다.
  현재 상태에서는 호출 가능하다고 가정할 수 없으며 이 차단을 유지해야 한다.

## 2. 실행 방식 비교와 권장안

| 방식 | 판단 |
| --- | --- |
| 공개 키 + 관리자 사용자 JWT만 사용 | 사용자 인가에는 적합. 관리자도 같은 RPC를 직접 호출하므로 서버 증거 보고에는 부족 |
| 기존 service_role/DB 소유자 credential 사용 | 범위가 넓고 기존 RLS 우회 위험. 이 기능 때문에 채택하지 않음 |
| 전용 DB 로그인 역할 + 제한된 비노출 RPC | 우선 추천. 보고 역할을 사용자 JWT와 분리하고 EXECUTE 범위를 좁힐 수 있음. 실제 배포의 DB 연결·풀링 지원 확인 필요 |
| 별도 worker의 서명된 증거 + 제한된 검증 RPC | 대안. 키 회전/nonce/재사용 방지/검증키 신뢰/운영 체계가 추가되어 현재 단계에서는 복잡 |

권장 역할 후보는 journal 작업용 executor와 증거 보고용 reporter를 분리한다.
둘 다 스키마 USAGE와 지정 RPC EXECUTE만 가지며 테이블 직접 DML, BYPASSRLS,
CREATE, 역할 생성·전환, 소유자 역할 멤버십, 기존 일반 DB 권한은 주지 않는다.
새 로그인/credential/GRANT는 이번 작업에서 생성하지 않는다. 역할 명칭·실제 프로비저닝은 후속 승인 대상이다.
정리 scanner는 정확한 활동 버킷 경로를 대상으로 하는 별도 capability로 검토한다.

SECURITY DEFINER 안의 current_user는 함수 소유자이므로 호출자 검증에 쓰면 안 된다.
직접 DB 로그인 경로라면 신뢰할 수 있는 session_user와 실제 연결 역할을 검증하는 방향으로 설계한다.
공유 로그인 뒤 SET ROLE, PostgREST JWT role, 임의 GUC를 같은 것으로 취급하지 않는다.
풀러가 동일 로그인으로 multiplex하는 구성에서는 이 구분이 무너지므로 연결 방식이 확인되지 않으면 차단한다.
소유자는 검증된 migration 실행 소유자이며 호출 역할과 분리한다. owner/superuser의 우회 가능성은 남는다.

executor credential과 reporter credential이 같은 앱 프로세스에 있으면 완전한 프로세스 격리는 아니다.
정상 브라우저/사용자 세션으로부터의 권한 분리만 제공한다. 서버 침해까지 방어해야 한다면
별도 worker/네트워크 경계/독립 검증 주체가 필요하다. 앱이 만든 evidence UUID는 그 자체로 증거가 아니다.

## 3. 일반 사용자·관리자·서버 권한

| 주체 | 허용 범위 | 금지 범위 |
| --- | --- | --- |
| 비로그인/일반 회원 | 공개 활동/사진 조회. 기존 후기 정책 유지 | journal 접근, 활동 변경, 완료 보고 |
| 관리자 사용자 세션 | 서버 진입점에 활동 변경·업로드·삭제 의도 요청, 안전한 상태 조회 | 서버 전용 report 직접 호출, response/verified/endConfirmed 제출로 완료 확정 |
| executor | 검증된 관리자 actor에 한해 claim/일괄 예약 CAS/발송 의도/불확실 기록 | Storage 종료·검증 사실 위조, 직접 테이블 변경 |
| reporter | 자신이 수행·확인한 정확한 dispatch의 응답/검증/종료 근거 제출 | 임의 작업 변경·임의 버킷 접근·증거 없는 완료 |
| 복구 담당 서버 | 승인된 관리자 신원·범위 안에서 미완료 조회/증거 대조 | timeout만으로 티켓 해제·자동 재발송 |

브라우저가 호출 가능한 것은 향후 관리자 요청용 Server Action 또는 Route Handler뿐이다.
이는 외부 공개 엔드포인트로 취급하여 매 요청 getUser/admin_users, 입력/용량/Origin 검사를 한다.
사용자가 보낸 actor, 경로, ticket, completed, evidence_ref, report capability는 권한 근거로 신뢰하지 않는다.
서버가 세션에서 actor를 결정하고 작업 소유자와 대조한다. 조회 결과는 안전한 상태 DTO만 브라우저에 전달한다.
DB는 호출 역할에 추가하여 actor의 현재 admin_users 포함 여부, 작업의 원 actor, 활동·사진·티켓을 재확인한다.
관리자 권한 회수나 인증 서비스 실패 시 신규 변경과 완료 보고를 중단한다.
시스템에 사실을 남기는 비인가 내부 관측이 필요하다면 권한 회수 뒤 완료 허용으로 우회하지 말고 별도 계약을 만든다.

기존 history_manage_activity의 사용자 호출 권한은 후속 단계에서 action 단위로 분리해야 한다.
메타데이터 편집/비공개 등 사용자 관리 동작과 begin/end/종료 관측 같은 내부 작업을 하나의 허용 RPC에 남기지 않는다.
authenticated 전체의 EXECUTE를 일괄 변경해 다른 관리 기능을 깨뜨리지 않고, 활동 전용 wrapper/내부 함수로
분리하는 별도 SQL 리뷰가 필요하다. 이번에는 기존 001과 로그인 코드를 그대로 둔다.
기존 Storage INSERT도 관리자 세션에서 직접 가능하므로 '서버만 파일을 쓸 수 있다'고 주장하지 않는다.
기존 관리자 세션의 직접 쓰기/티켓 사용과 경합할 때의 정책 정리가 활성화 전 필수다.

## 4. 완료 증거 계약

증거는 같은 request/activity/photo/slot/dispatch/ticket/bucket/path 및 입력 지문에 연결한다.
API 키·세션·원문 헤더·서명 URL·파일 원문을 journal/로그에 저장하지 않는다.

1. 예약 근거: 기존 reserve operation ID, 원본 활동 revision, 정확한 영수증과 사진 행.
2. begin 근거: begin operation ID/원본 revision, 발급 ticket, upload_in_flight 상태.
3. 발송 의도: CAS commit 성공. 오직 의도 선점 승자만 다음 단계에 진입한다.
4. 호출 직전 표시: 영속 저장 후 Storage 어댑터 한 번 호출. 이는 실제 원격 수신 증거가 아니다.
5. 응답 근거: 신뢰 reporter가 고정 대상·버킷·경로의 한 번 요청에서 종결된 결과를 확인한 기록.
   SDK의 error=null 또는 임의 HTTP 오류 코드만으로 충분하지 않다. SDK 숨은 재시도/비동기 저장 의미를 검증해야 한다.
   성공 응답이 영속 저장 및 요청 종결을 의미하는지 실제 Storage 버전에 맞는 후속 검증이 필요하다.
6. 파일 검증 근거: 해당 정확한 경로의 다운로드 바이트를 입력 지문/바이트 길이와 비교하고,
   파일 signature·실제 디코딩·허용 MIME·크기를 확인한다. metadata만 또는 브라우저 boolean만 사용하지 않는다.
   취소/삭제/교체 상태와 버킷 STANDARD·버전 DISABLED 전제도 대조한다.
7. 종료 근거: 실제 요청 종결이 입증된 뒤 서버 전용 경로에서 SQL ticket 종료와 영수증을 확인한다.
   end RPC 응답 유실은 원래 command ID/원본 revision으로 영수증과 사진 상태를 조회한다.
8. 사진 완료: stored + valid + ticket 종료 확인을 같은 작업 revision에서 원자 반영한다.
   완료 수는 검증된 연속 슬롯 prefix만 증가한다. 활동 전체 succeeded는 모든 슬롯이 완료됐을 때만 허용한다.
   succeeded는 업로드 과정 완료이며 finalize/대표 사진/공개는 별도 검사다.

Storage 거부로 종결됐다는 검증된 근거 또는 stored 후 실제 검증 invalid가 있고 ticket 종료도 확인된 경우에만
실패를 확정한다. 일반 4xx/5xx·연결 종료·로컬 abort·timeout은 자동 rejected 근거가 아니다.
현재 문자열 stored/rejected와 verify boolean 인터페이스는 이 근거 묶음을 담지 못하므로 확장이 필요하다.
DB는 원격 네트워크 사실을 직접 증명하지 못한다. 허용된 reporter를 신뢰하는 한계와 그 관측 책임을 명시한다.

last_confirmed_at은 수락된 증거 사건의 DB 시각이고 completed_at처럼 해석하지 않는다.
확인 종류/슬롯을 함께 반환한다. 단순 CAS, 재조회, heartbeat, timeout, 동일 증거 재전송은 시각을 갱신하지 않는다.
사진 검증 완료와 ticket 종료 시각을 각각 보존하며 최초 근거 시각을 중복 보고로 덮어쓰지 않는다.

## 5. 오류·경합 규칙

- timeout/연결 종료: uncertain 유지. end_upload·completed 증가·자동 재발송 금지.
- 서버 종료: 발송 의도가 있으면 실제 발송을 모를 수 있다. 복원은 조회이며 실행권 인수가 아니다.
- 늦은 성공: 이미 종료된 요청 Promise의 응답만으로 자동 상태를 덮어쓰지 않는다.
  증거를 보존할 수 있는 복구 경로에서 동일 dispatch 검증·인가·CAS로 수락 여부를 판단한다.
  근거가 유실되면 파일이 보여도 계속 불확실로 남을 수 있다.
- 중복 보고: evidence ID+내용의 고정 fingerprint를 비교한다. 동일 증거는 idempotent 결과 조회,
  다른 내용·다른 ticket·다른 dispatch는 거부한다. 동일 증거 재시도는 원 revision의 결과 영수증을 먼저 확인한다.
- 버전 충돌: 증거 사건과 상태 갱신이 원자적이어야 한다. stale payload를 새 버전에 강제 적용하지 않는다.
- 삭제: 활동→작업→사진 순서로 잠금. 삭제 의도 이후 새 발송 불가, 기존 진행 중은 delete_wait 유지.
  종료 사실 기록은 삭제 의도를 지우지 않는다. 업로드 성공이 와도 deleting/deleted를 ready로 되돌리지 않는다.
- scanner: 실제 종료/정리와 부재 관측·표식 보존을 분리한다. 매우 늦은 저장에 대한 미래 부재는 보장 불가.
  직접 Storage 테이블 삭제 금지, 다른 버킷/기존 후기 경로 접근 금지.
- DB 기록과 Storage 작업은 원자적이지 않다. 정확히 한 번 외부 실행을 보장한다고 주장하지 않는다.
  의도 이후 재발송하지 않는 보수적 정책은 crash 이후 실제 미발송 작업도 수동 조사로 남길 수 있다.

## 6. SQL 보안 검토와 미완성 의존성

SECURITY DEFINER/빈 search_path/수식 이름/EXECUTE 회수 방향은 적절하지만 인증 완료를 뜻하지 않는다.
서버 전용 스키마 비노출·RLS도 owner/definer 자체를 제한하지 않는다.
require_server(p_actor,p_report)의 p_report boolean은 capability가 아니며 실제 활성화 조건으로 쓰면 안 된다.
p_actor, evidence UUID, response 문자열, expected revision, clock 시각은 모두 전달 입력이므로
호출 신원·기존 작업·증거 원본과 결합해야 한다. SQL 초안의 상시 예외는 계속 유지한다.

후속 SQL은 중복 증거 idempotency, 증거 종류별 허용 역할, DB 생성 시각과 원래 명령 revision,
명령 원본 digest·영수증 검증, 사진별 완료 prefix를 한 트랜잭션으로 구현해야 한다.
일괄 예약 CAS는 전체 photos·slot/operation 매핑을 한 번에 검증·저장하고,
활동 전체 10장/5MiB/50MiB 및 대표 사진 규칙을 기존 SQL과 함께 유지해야 한다.
현재 슬롯별 reserve와 마지막 complete만으로는 현 coordinator의 다중 사진 흐름을 충족하지 못한다.
외부 RPC 명령의 operation ID 선점 경합과 삭제 준비+journal 표식의 원자 wrapper도 미완성이다.

## 7. 최소 모듈·테스트와 순서

제안 모듈(아직 추가하지 않음):
- admin-context.ts: 검증된 사용자 UUID/인가 결과. 장애와 비로그인 구분, no shared cache.
- server-capabilities.ts: 실제 서버 호출 신원과 journal/report 권한 경계. 미구성은 거부.
- upload-evidence.ts: 증거 식별·binding·중복 비교·허용 단계와 완료 prefix의 순수 계약.
- db-upload-journal.ts: typed RPC mapping, batch CAS, bigint/시각 변환, 원래 명령 보존.
- storage-upload-adapter.ts: 대상 고정·한 번 발송·관측·실제 바이트 검증. 실제 SDK 의미 검증 전 비활성.
- cleanup-scanner.ts: 승인된 정확한 경로/표식만 조사. 독립 후속 작업.

다음 한 단계는 upload-evidence의 **순수 타입/모의 capability 계약과 거부 테스트**를 구현하는 것이다.
브라우저 입력 actor/report 위조, 관리자 세션만으로 보고 시도, 미구성 서버 역할, 권한 회수,
다른 ticket/dispatch/바이트, 증거 없는 완료/실패, 중복 보고·충돌, timeout·삭제·재시작을 테스트한다.
그 다음 배포/DB 연결의 역할 식별 가능성을 별도 승인된 조사로 확인하고 SQL/어댑터 초안을 보완한다.
독립 DB 적용·실제 Storage 테스트·Route 연결은 각각 별도 승인/검증이 필요하다.
현재는 모든 활성화 차단 유지. 원본/3001/3002/기존 DB/운영 환경의 안전성이 새로 확인됐다고 주장하지 않는다.
