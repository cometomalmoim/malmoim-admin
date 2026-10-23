# 활동 사진 업로드 영속 기록 DB 설계

상태: 설계만 완료 / SQL·RPC·권한 미구현·미검증 / 적용 및 업로드 활성화 금지.
2026-10-20. 이번 문서 작성에서는 DB·Docker·Storage에 연결하지 않았다.
대상 후보는 독립 프로젝트 malmoim-review-auth-lab, API 55421 / DB 55422뿐이다.
실제 환경·역할·객체 존재 여부는 재확인하지 않았으며 운영 환경에 동일하다고 가정하지 않는다.
기존 001·002, manifest, 실행 금지 초안, 기능 코드는 변경하지 않는다.

## 1. 비교와 추천

| 선택 | 장점 | 위험 / 판단 |
| --- | --- | --- |
| history_activity_commands 확장 | 기존 RPC 영수증 활용 | 성공 후 추가되는 append-only 감사 기록을 진행 상태로 변경하면 감사·재실행 의미가 섞임. PK도 (actor,request_id)로 전역 요청 선점과 다름 |
| 별도 작업 기록 + 파일별 기록 | 미완료·불확실 상태, CAS, 삭제 의도, 복구 조회를 독립 관리 | 새 테이블·권한·트랜잭션 어댑터 필요. 추천 |

기존 commands는 유지한다. reserve/begin/end 각각의 고유 operation ID와 영수증을 작업 기록에 연결한다.
업로드 요청 ID는 전역으로 한 번 선점하며, 다른 관리자도 같은 ID를 새 작업으로 재사용할 수 없다.
일반 중복 조회는 원래 관리자만 허용하고 복구 담당자는 별도의 서버 복구 권한으로 조회한다.
미승인·일반 회원에게 요청 ID의 존재 여부도 반환하지 않는다.

## 2. 제안 테이블과 최소 필드

아래 이름·형식은 후속 마이그레이션의 설계이며 실행 가능한 SQL은 아니다.

### history_activity_upload_jobs — 요청당 한 행

| 필드 | 형식 / 의미 |
| --- | --- |
| request_id | uuid PK, 전역 중복 금지 |
| schema_version | smallint, 현재 1만 허용 |
| bucket_id | text, history-activity-photos 고정 CHECK |
| activity_id / actor_id | uuid, 활동과 최초 실행 관리자, 변경 불가 |
| fingerprint | SHA-256 소문자 64자리, 입력 순서·내용 식별, 변경 불가 |
| revision | bigint >= 0, journal CAS 버전. 활동 revision과 별개 |
| phase / issue | 현 UploadPhase / UploadIssue의 명시적 허용 값 |
| delete_requested / delete_requested_at | false→true만 허용, 한 번 기록된 시각 보존 |
| reserve_operation_id | uuid, 최초 선점 때 고정 |
| expected_photo_count / completed_count | 1..10 / 0..expected, 완료 수 감소 금지 |
| created_at / updated_at | DB 생성 timestamptz. updated_at은 저장 시각일 뿐 종료 증거 아님 |
| last_confirmed_at | nullable timestamptz. 확인 RPC가 수락한 증거가 있을 때만 DB가 기록 |
| confirmation_kind / confirmation_photo_index | nullable, 기존 UploadConfirmation에 대응 |
| recovery_required | bool, 불확실·삭제·불일치 발견 시 설정. 성공/실패 상태라도 복구 필요 가능 |

phase 허용 값: claimed, reserved, starting, uploading, verifying, ending,
succeeded, failed, uncertain, deletion_pending.
issue 허용 값: storage_rejected, invalid_file, needs_confirmation, deletion_requested 또는 NULL.
actor_id는 신원 감사용이며 Auth 계정 삭제에 CASCADE하지 않는다. 활동 FK는 삭제 RESTRICT로 보존하고,
기존 활동 삭제 표식은 물리 삭제하지 않는 전제를 유지한다. journal만을 위해 회원 프로필을 추가하지 않는다.

### history_activity_upload_job_files — 요청의 사진 슬롯당 한 행

| 필드 | 형식 / 의미 |
| --- | --- |
| request_id / slot | 부모 FK(RESTRICT) + 0..9, 복합 PK |
| begin_operation_id / end_operation_id | 각각 uuid, 재시도에도 변경 불가 |
| photo_id / storage_path | reserve 전 NULL, 이후 실제 사진 행과 서버 생성 경로에 고정 |
| byte_size / mime_type | 예약 후 실제 사진 행과 일치. 1..5242880 / JPEG·PNG·WebP |
| upload_ticket | begin 전 NULL, 발급 후 변경·제거 금지 |
| dispatch_state | not_started / intent_recorded / outcome_unknown / terminated |
| dispatch_id | 서버가 발급하는 uuid, 요청 발송 의도와 함께 한 번 고정 |
| remote_outcome | NULL / stored / rejected. unknown을 rejected로 변환하지 않음 |
| verified_at / termination_confirmed_at | 근거가 있을 때만 기록. 단순 파일 존재는 종료 근거 아님 |
| evidence_ref | 비밀정보 없는 서버 증거 ID. 원문 응답·토큰·서명 URL 저장 금지 |

부모의 슬롯 수는 expected_photo_count와 정확히 일치해야 한다. 초기 claim은 슬롯과 operation ID까지
한 트랜잭션으로 만든다. 부모 revision 하나로 자식 변경도 함께 CAS하므로 슬롯별 별도 버전은 두지 않는다.
photo_id는 기존 photo 테이블과 activity_id를 포함한 복합 FK로 연결하고 경로·크기·형식을 대조한다.
슬롯의 완료 상태가 completed_count와 일치하는지 검사한다. 순차 처리 계약에서 완료 슬롯은 앞에서부터 연속이다.

확인 근거 감사용 history_activity_upload_job_events도 추가한다: event_id, request_id, revision,
종류, 슬롯, evidence_ref, DB 기록 시각, 서버 실행 식별자. (request_id,revision) UNIQUE.
확인·삭제 의도·복구 판단 이력을 append-only로 남기되 기존 commands의 RPC 감사 역할을 대체하지 않는다.

## 3. 제약과 인덱스

- PK 및 FK, bucket/schema/phase/issue/mime CHECK, JSON 대신 정규화된 슬롯과 타입 사용.
- 고정 필드·기발급 티켓·삭제 의도·확인 근거의 역행 금지. 관리자도 일반 CAS로 이를 초기화할 수 없음.
- 단계 전이는 RPC 허용표로 제한. uncertain에서 succeeded로 일반 CAS 전환 금지.
  복구 RPC도 실제 종료·바이트 검증·SQL 티켓 종료를 각각 입증해야 한다.
- 기존 활동 행 잠금 아래 삭제되지 않은 모든 사진을 합산하여 최대 10장·50MiB를 검증한다.
  작업 한 건의 슬롯 수만 검사해서 다른 작업과 합계 제한을 우회하지 않는다. 한 장은 최대 5MiB.
- 대표 사진 1장 필수 조건은 기존 finalize/publish 검증에 남긴다. 빈 비공개 초안은 허용된다.
- operation ID는 actor와 조합하여 reserve/begin/end 간 중복도 금지한다.
  서로 다른 열의 UNIQUE만으로 교차 충돌을 막을 수 없으므로 claim RPC가
  작업 변경용 전용 advisory lock 아래 모든 operation ID와 기존 commands를 검사한다.
  기존 RPC 직접 호출까지 막기 전에는 외부 호출의 ID 선점 가능성이 남으므로 활성화 차단 사유다.
- 복구 인덱스: (created_at,request_id) WHERE recovery_required OR phase NOT IN ('succeeded','failed') OR delete_requested.
- 활동별 조사용 (activity_id,request_id), 슬롯 (photo_id), 사건 (request_id,revision).
- 마지막 확인 시각이나 updated_at에 TTL·자동 삭제·작업 소유권 만료를 연결하지 않는다.
- JS number 변환 전 bigint가 안전 정수 범위 안인지 확인한다. 넘으면 중단한다. 시각은 DB UTC→epoch ms로 매핑한다.

## 4. RPC와 원자성 계약

모든 이름은 제안이며 아직 존재하지 않는다. 서버 전용 RPC는 명시적 인자·타입만 받으며
임의 JSON 전체 교체, SQL 문자열, 클라이언트 경로·확인 boolean을 신뢰하지 않는다.

1. history_upload_job_claim: 현재 관리자 확인 → 활동 행 잠금 → 삭제 상태 확인 →
   전역 request_id INSERT ON CONFLICT DO NOTHING → 부모/슬롯/사건을 한 트랜잭션으로 저장.
   충돌이면 동일 actor·activity·fingerprint인지 검사한 뒤 existing 반환. 업로드 재개 권한은 주지 않음.
   claim 성공 응답을 받은 프로세스만 최초 실행을 계속한다. 응답 유실이면 기존 기록 조회만 한다.
2. history_upload_job_cas: 활동 행 → 작업 행 순서로 잠금, expected_revision 일치,
   next_revision=old+1 및 고정 필드·전이·삭제 상태 검사 후 부모/자식/사건을 원자 변경.
   불일치면 version_conflict로 무변경 반환. stale payload를 새 버전에 그대로 덮어쓰지 않는다.
3. history_upload_job_confirm: 동일 CAS 아래 증거 종류·슬롯·티켓·단계·근거 조회를 검사하고,
   last_confirmed_at과 사건을 원자 기록. 기본 CAS는 확인 시각을 받거나 변경할 수 없음.
   DB 자체 증명 가능한 예약/티켓 종료는 commands와 photo 상태를 함께 대조한다.
   Storage 종료·내용 검증 증거는 제한된 서버 실행 주체만 제출 가능하며 DB만으로 진위를 증명하지 못함.
4. history_upload_job_get: 관리자·요청 소유자 확인 후 detached record 또는 envelope 반환.
5. history_upload_job_recovery_page: 서버 복구 주체의 권한 확인 후 최대 100건,
   created_at/request_id keyset cursor와 scan 시작 상한 시각으로 반복 조회.
   미완료·uncertain·삭제 의도·recovery_required를 포함하며 시간 경과로 완료 제외하지 않음.
6. history_upload_job_request_delete: 활동 행 → 관련 작업 행(request_id 정렬) → 사진 행 순으로 잠금.
   기존 삭제 준비와 journal delete_requested를 같은 트랜잭션으로 반영하는 후속 wrapper 필요.
   작업 표식만 남기고 실제 사진 삭제 준비가 안 된 경우도 복구 대상으로 노출.

모든 RPC는 한 호출의 DB COMMIT 완료 후 응답한다. 외부 Storage 호출 중 DB 트랜잭션을 유지하지 않는다.
INSERT 충돌의 새 행 반환 여부는 동시 세션 테스트로 검증해야 한다. read→INSERT의 두 단계로 대체하지 않는다.
CAS 충돌 시 현재 coordinator의 제한된 재읽기만 유지하며 새 Storage 요청을 재발행하지 않는다.

### 발송 중복 방지와 기존 인터페이스의 차이

revision은 DB 쓰기의 fencing일 뿐 이미 시작한 HTTP 작업을 중단시키지 못한다.
파일 슬롯별 intent_recorded 전이를 CAS로 단 한 번 수락한 후 해당 프로세스가 한 번만
Storage upload(upsert=false, 숨은 재시도 없음)를 발송한다. 네트워크 호출 전에 의도를 commit한다.
의도 저장 뒤 서버가 죽으면 실제 발송 여부는 모를 수 있다. 새 worker는 재발송하지 않고 outcome_unknown으로 조사한다.
lease 만료·worker 교체·AbortController는 새 발송 권한이 아니다. 복구 후 원본 사진 바이트도 journal에는 없다.

현 UploadJournal에는 슬롯별 dispatch 증거와 제한 페이지 인자가 없고, coordinator는 confirm도 호출하지 않는다.
현재 CAS 재읽기가 새 버전에 과거 상태를 적용할 여지도 있어 실제 어댑터는 추가 전이 검사를 해야 한다.
따라서 단순 메서드 매핑만으로 운영 안전성을 주장할 수 없다. 후속 인터페이스/모의 테스트 보완이 먼저 필요하다.

## 5. 권한 경계

권장: 별도 비노출 스키마의 서버 전용 실행 경로. 테이블 RLS 활성화, PUBLIC·anon·authenticated·
service_role의 직접 SELECT/INSERT/UPDATE/DELETE/TRUNCATE 권한 및 기본 함수 EXECUTE 명시 회수.
일반 회원용 정책은 만들지 않는다. public 스키마에 둘 경우에도 같은 차단을 적용한다.

SECURITY DEFINER 소유자는 검증된 마이그레이션 소유자(postgres는 독립 DB의 후보)이며,
search_path=''와 완전 수식 이름, 동적 SQL 금지. 함수 생성 직후 기본 EXECUTE를 회수한 뒤
별도 server-only 호출 역할에 필요한 RPC EXECUTE만 부여하는 방향이다. 기존 역할에 광범위 권한을 추가하지 않는다.
소유자의 RLS 우회 가능성을 전제로 함수 본문에서도 활동·요청·관리자·버킷을 매번 확인한다.

서버 전용 역할은 아직 없고 생성·연결 방법도 미승인이다. 최소 권한 별도 역할/연결 경로를
검증할 때까지 실제 어댑터 연결을 막는다. service_role을 일반 관리자나 일반 회원 세션으로 취급하지 않는다.
신뢰 서버가 검증한 관리자 actor를 제한된 RPC 인자로 전달하고 admin_users를 DB에서 재확인한다.
일반 authenticated에게 이 RPC 실행 권한을 주면 actor 위조가 가능하므로 허용하지 않는다.
클라이언트가 직접 호출할 수 있는 API에 이 actor 인자를 그대로 통과시키지 않는다.
복구 작업은 최초 관리자 권한 회수 시 중단하고, 별도 승인된 실제 관리자 신원으로 감사 사건을 남겨 인수한다.
최초 actor와 operation ID는 바꾸지 않으며 기존 coordinator.inspect는 다른 actor의 인수를 지원하지 않는다.

기존 001의 history_manage_activity는 실제 관리자 JWT(auth.uid/role) 확인 방식이다.
따라서 위 서버 역할로 직접 호출하면 관리자 확인이 실패한다. auth.uid를 임의 SET해서 우회하지 않는다.
향후 검증된 관리자 세션 경로와 서버 증거 경로를 분리한 wrapper/내부 함수 경계가 필요하다.
특히 기존 end_upload는 관리자 확인만 하고 종료 증거를 검증하지 않으며 begin_upload의 GUC는
보안 인증 수단이 아니다. 관리자 브라우저의 직접 호출로 종료를 확정하지 못하도록 별도 리뷰가 필수다.
이번 문서는 기존 함수 권한·본문을 바꾸지 않는다. 이 경계가 확정되기 전 활성화 금지.

## 6. 업로드·삭제·복구 흐름

정상: 관리자 검증 → claim → 기존 reserve 영수증/경로 확보 → begin 티켓 확보 →
발송 의도 CAS → Storage 한 번 발송 → 실제 종료 증거 기록 → 실제 바이트/형식 검증 →
기존 end_upload 확인 → 작업 완료. finalize/대표 사진/순서/공개는 별도 RPC와 재검증 단계다.

- reserve/begin 응답 유실: stable operation ID로 영수증·사진 행을 조회하여 대조한다.
  기존 RPC는 입력 revision까지 idempotency 비교하므로 같은 ID에 새 revision을 넣어 재실행하지 않는다.
  원래 인자·revision을 복구할 작업별 command 참조가 필요하며, 확실하지 않으면 중단한다.
- Storage 응답 유실/timeout/서버 종료: uncertain, last_confirmed_at 유지, upload_in_flight 유지.
  파일 존재·404·오래된 시각만으로 end_upload를 호출하지 않는다. 업로드 종료 증거가 없으면 대기를 유지한다.
- end 응답 유실: 영수증·티켓·현재 상태 확인. 성공 영수증을 확인하면 journal만 복구한다.
  영수증 부재는 실패 증거가 아니므로 임의 재전송하지 않는다.
- 삭제 요청: 새로운 reserve/발송 의도 차단. 실제 시작 가능성이 있는 요청은 delete_wait 유지.
  요청이 시작되지 않았다는 영속 증거 또는 실제 종료 근거가 확인된 후에만 deleting으로 진행한다.
  활동 삭제와 경합하는 dispatch CAS도 같은 활동 행 잠금을 써야 한다. 잠금 해제 후 이미 발송 허가된
  HTTP 작업은 늦게 시작할 수 있으므로 삭제는 그 티켓을 진행 중으로 취급한다.
- 삭제 RPC→journal 반영 사이 실패: SQL 삭제 표식이 우선이다. wrapper가 없으면 매 작업 전 두 상태를
  재조회하고 어느 한쪽이라도 삭제 의도가 있으면 차단한다. 향후 원자 wrapper와 대조 scanner 필요.
- scanner는 삭제 대기/표식 및 정확한 기록 경로만 조사. 별도 승인된 Storage API remove만 사용.
  목록·다운로드·메타데이터 부재를 확인하고 기존 observe_cleanup 두 차례(최소 60초) 규칙 유지.
  인증 실패/네트워크 오류를 부재로 간주하지 않는다. 재등장하면 관측 초기화 후 그 경로만 재정리한다.
- 미등록 파일 발견은 먼저 격리 보고한다. 작업/사진/표식과 소유 근거가 없는 경로를 자동 삭제하지 않는다.
  다른 버킷과 history-review-photos는 scanner 입력으로도 허용하지 않는다.
- deleted 경로와 작업·감사 기록은 자동 만료시키지 않는다. 매우 늦은 쓰기에 대한 반복 관찰이 필요하다.

DB COMMIT과 Storage API는 원자적이지 않다. 모든 서버가 죽은 상태에서 원격 요청 종료를 증명할
방법이 없을 수 있으며 이 경우 자동 복구보다 무기한 차단/수동 조사를 택한다.
두 번의 부재 확인도 미래의 늦은 쓰기 부재를 증명하지 않는다. scanner/모니터링 없이는 업로드 활성화 불가.
비공개 전환은 파일 손상이나 journal 정지와 무관하게 실제 관리자가 수행 가능해야 한다.
이미 발급된 서명 URL/브라우저 캐시의 즉시 회수는 보장하지 못한다.

## 7. 기존 마이그레이션·문서에 미치는 영향

현재 001의 3개 테이블·6개 함수와 002의 정확한 객체/권한 검사는 그대로 보존한다.
이 문서를 기존 manifest의 실행 파일로 추가하거나 기존 해시를 재작성하지 않는다.
후속 별도 pending-approval 마이그레이션에 3개 journal 테이블과 RPC·인덱스·권한을 추가하고,
새 전용 검증 SQL/manifest/복구 안내를 함께 작성하는 방식을 추천한다. 아직 파일을 만들지 않는다.
001과 함께 적용할지 후속 적용할지, wrapper를 위해 어떤 기존 활동 함수의 변경이 필요한지는
서버 역할 경계를 확정한 뒤 별도 승인된 변경 목록으로 리뷰한다. 001이 적용됐다고 가정하지 않는다.

후속 검증은 테이블·FK·제약·인덱스·함수 소유자/search_path/ACL/RLS와 함께
일반 회원·anon·service_role 직접 접근 거부, 전역 claim 경합, CAS 충돌, 활동 삭제 경합,
권한 회수·서버 종료·응답 유실·원격 늦은 성공·증거 위조·발송 의도 후 crash를 검사해야 한다.
기존 활동/후기/관리자 로그인 회귀 및 10장/5MiB/50MiB/대표 사진 규칙도 유지한다.

복구 안내에는 작업·슬롯·사건·사진 표식·Storage 파일의 비공개 비교 기준과 백업을 추가해야 한다.
DDL 트랜잭션 실패는 rollback하되, commit 응답 유실은 객체 조회 전 재실행하지 않는다.
실사용 기록이 생긴 뒤 테이블을 DROP하거나 기존 DB 전체를 복원해서 맞추지 않는다.
파일은 해당 실행의 검증된 경로만 Storage API로 정리하고 journal·표식·감사는 보존한다.
후기 테이블·후기 버킷·기존 정책·인증 계정·3001/3002는 복구 대상에서 제외한다.

## 8. 다음 구현 단계 하나

실제 연결보다 먼저, dispatch 의도/확인 근거/복구 페이지/명령 원본 revision을 포함하도록
저장 계약과 모의 어댑터 테스트를 확장한다. 그 계약을 기준으로 별도 실행 금지 journal
마이그레이션을 작성·정적 리뷰하고, 대상 확인·백업·명시적 적용 승인을 받은 뒤에만 DB 검증한다.
