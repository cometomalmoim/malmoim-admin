# 활동 사진 보안·저장 RPC 설계 — 실행 금지 초안

상태: 문서/SQL 설계 보완 완료, DB 문법·권한·API·동시성 실행 검증 미수행.
동반 SQL은 NOT-FOR-EXECUTION이며 BEGIN 직후 무조건 예외, 마지막 ROLLBACK을 유지합니다.
가드를 제거하거나 migrations에 복사하지 마세요. 이 파일은 재실행용 마이그레이션이 아닙니다.
이번 작업은 이 두 초안만 수정하며 DB/API/Storage에 접속하거나 SQL을 실행하지 않습니다.

## 1. 기존 구조와 보안 경계

- src/lib/auth.ts: getAdminAccess가 getUser와 admin_users 본인 행으로 관리자 확인.
- 001_admin_users.sql: 일반 회원은 자신의 관리자 등록 여부만 조회하며 등록/변경은 금지.
- 기존 프로필/게시판은 버킷 이름+admin_users로 Storage 정책을 제한합니다.
- supabase/local/history-participant-approval.sql의 restrictive INSERT 패턴을 참조합니다.
- 기존 정책은 소스 및 앞선55422 읽기 전용 점검으로 확인했습니다. 이후 변경 및 운영과의 동일성은 보장하지 않습니다.
- history_reviews/history-review-photos/참가자 인증/기타 버킷·정책은 수정하지 않습니다.
- 관리자는 기존 admin_users의 운영진만 인정. 참가 승인 회원은 관리자와 다릅니다.
- 서비스 역할, superuser, BYPASSRLS, 테이블 소유자, SQL Editor 직접 실행은 앱 권한 경계 밖.
  공개 키와 실제 관리자 로그인 JWT로만 관리 API를 호출합니다. 우회 키를 브라우저에 제공하지 않습니다.

## 2. 테이블과 상태

history_activities:
- id, title(1..120), activity_date, category(regular/special), cohort(정규는 양수, 특별은 NULL),
  description(1..2000), is_published(default false), cover_photo_id, revision(default1), created_at.
- lifecycle=draft/complete/deleting. 공개는 complete만 가능.

history_activity_photos:
- id, activity_id, storage_path, alt(1..500), position(0..9), byte_size, mime_type,
  state=pending/ready/deleting.
- 경로는 서버/DB 생성 activityUUID/photoUUID.jpg|png|webp. 사용자 URL/경로 입력 불허.
- 경로와 활동/사진 ID는 불변. 교체는 다른 사진 ID와 새 파일 경로를 예약.
- 대표 FK는 같은 활동의 사진만 참조, 대표 하나만 지정.
- 순서는 활동 내 고유. 지연 UNIQUE/FK와 검증 트리거로 순서 교환/대표 교체를 한 트랜잭션에서 허용.

history_activity_commands:
- actor, request_id, activity_id, command, result, created_at. actor+request_id 고유.
- 성공한 명령의 감사 기록 겸 재시도 응답. 활동 삭제 후에도 보존하며 활동 FK는 두지 않음.
- 사용자 입력(actor/결과 포함)을 신뢰하지 않고 RPC 내부에서 기록. 인증계정 삭제에 cascade하지 않음.
- 관리자만 읽기 가능, 앱 사용자는 수정/삭제 불가. 개인정보 최소 보관 기간은 운영진과 정해야 함.
- command에는 활동 제목/설명 등 입력 내용이 포함됨. 키·JWT·비밀번호·서명 URL은 입력/기록 금지.
- 실패한 RPC의 receipt는 트랜잭션과 함께 rollback. 실패 진단은 별도 서버 로그에서 비밀정보 없이 처리.

## 3. 화면·서버·DB·Storage 검증

- 화면: 대표1+추가9, JPG/PNG/WebP, 장당5MiB(5,242,880), 총50MiB(52,428,800), 미리보기.
- 서버: 실제 관리자 확인, MIME/시그니처/디코딩, 실제 파일 길이, 요청별 전체 목록 확인.
- DB: 예약 단계부터 pending/ready/deleting 모두 10장/총50MiB에 포함. 삭제가 완료되어야 슬롯 반환.
  각 행은 1..5MiB. 부모 행 FOR UPDATE로 수량/합계 검사와 RPC 변경을 직렬화.
- Storage: private 버킷, 5MiB/MIME allowlist. ready 전환 때 실제 storage.objects metadata.size와
  metadata.mimetype가 예약값과 같아야 함. archived_at=NULL, is_delete_marker=false,
  is_versioned=false인 현재 객체만 인정하며 크기는 숫자 문자열 형식도 검사함. 메타데이터 누락/형식 오류/부재면 실패 처리.
- DB는 이미지 자체를 디코딩하지 않음. 악성 파일 검사는 서버 책임이며 관리자도 신뢰 경계 안에 있음.
  직접 REST finalize를 호출한 관리자까지 비신뢰 대상으로 취급하려면 서버 전용 검증 증명 체계가 추가 필요.
- complete 저장/공개에는 ready사진 최소1장 및 해당 활동의 대표1장이 필수.
  업로드 전의 비공개 draft만 대표 없이 허용하며 이를 최종 저장 성공이라고 표시하지 않음.
- publish 때도 활동 UPDATE의 지연 검증 트리거가 사진/실제 metadata/대표/수량을 다시 검사.

## 4. 권한 정책

앱 테이블은 anon/authenticated 모두 직접 INSERT/UPDATE/DELETE 권한을 주지 않습니다.
관리자도 저장/수정/삭제는 SECURITY DEFINER RPC만 사용합니다.
RPC는 auth.uid+auth.role=authenticated+admin_users를 매번 검사하고 실패 시 차단합니다.
새 definer 함수는 search_path='' 고정, 동적 SQL 없음, 완전한 스키마 지정, PUBLIC EXECUTE 회수.
정책에서 필요한 boolean helper만 anon/authenticated에 실행권한을 줍니다.
함수 소유자는 신규 테이블과 storage metadata 조회 권한을 가진 신뢰된 마이그레이션 역할이어야 합니다.
FORCE RLS를 추가하면 소유자 동작이 달라질 수 있으므로 검증 없이 추가하지 않습니다.

표시 정책:
- 활동: 관리자 또는 published+complete만 SELECT.
- 사진: 관리자 또는 공개 활동의 ready사진만 SELECT.
- 감사/receipt: 관리자만 SELECT.

새 버킷의 permissive 정책:
- SELECT: 관리자 또는 공개+complete 활동의 ready 경로.
- INSERT: 관리자 + 정확한 pending 예약 경로 + 비공개 draft 활동.
- DELETE: 관리자 + 정확한 deleting 경로 + 비공개 활동.
- UPDATE: 허용하지 않음. upsert=false, 이동/덮어쓰기 금지.
- pending도 삭제 준비 RPC를 먼저 거쳐 deleting으로 바꾼 후 Storage API remove.

기존 permissive 정책은 OR 결합이므로 추가 정책만으로 안전하지 않습니다.
새 버킷 전용 RESTRICTIVE SELECT/INSERT/DELETE는 위 조건을 AND로 강제합니다.
RESTRICTIVE UPDATE의 USING(이전 행)과 WITH CHECK(새 행) 모두 새 버킷을 제외하여
다른 버킷→새 버킷/새 버킷→다른 버킷 이동과 경로 덮어쓰기도 차단합니다.
모든 guard는 다른 버킷에 대해 true여서 그 버킷은 기존 정책에 맡깁니다.
기존 restrictive 정책이 새 버킷을 차단할 가능성은 남으므로 실제 정책 전체 확인이 필요합니다.

Storage helper는 storage.objects를 조회하지 않아 객체 RLS 재귀를 피합니다.
INSERT/DELETE 권한 검사는 부모 FOR SHARE를 잡고 최신 상태를 재확인합니다.
RPC의 FOR UPDATE와 충돌해 진행 중인 Storage SQL 변경과 삭제/완료 전환을 직렬화하도록 설계했습니다.
다만 실제 Storage의 파일 쓰기와 metadata SQL의 순서·락/스냅샷 동작은 API 동시성 검증 필수입니다.
Storage 보호 트리거는 끄지 않으며 storage.objects에 직접 INSERT/UPDATE/DELETE하지 않습니다.

## 5. 관리자 RPC 계약

단일 진입점:
`history_manage_activity(p_action, p_activity, p_revision, p_request, p_payload)`
동작별로 명확한 action을 분리하되 동일한 관리자/락/멱등성 구현을 재사용합니다.
서버 액션은 다음 payload만 생성합니다. 알 수 없는 추가 키는 어떤 DB 열에도 반영하지 않습니다.

| action | 입력/전제 | 결과 |
|---|---|---|
| create | activity/revision=NULL, title/date/category/cohort/description | 비공개 draft 생성, revision1 |
| edit | 위 활동 정보 전체, 비공개 | 정보 변경 |
| reserve | photos:[{bytes,mime,alt}], 비공개, deleting사진 없음 | DB 생성 ID/경로의 pending 예약; 10장/50MiB 검사 |
| finalize | order:[모든 사진ID], cover:사진ID, 비공개 | 각 파일 metadata 검증 후 ready/대표/순서/complete 원자 확정 |
| layout | order:[모든 사진ID], cover:사진ID, 모두ready/비공개 | 대표 변경·전체 순서 변경 |
| publish | complete, 모든사진ready, 대표필수 | 공개 |
| unpublish | 활성 활동 | 비공개, 파일 유지 |
| begin_photo_delete | photo:해당사진ID, 비공개 | draft, 사진deleting, 대표면 대표해제 |
| finish_photo_delete | photo:사진ID, deleting, metadata부재 | 사진행만 제거; 남은사진 finalize 후 재공개 |
| begin_delete | 활성활동(공개도 허용) | 비공개+deleting, 대표해제, 모든사진deleting |
| finish_delete | deleting, 해당활동 prefix의 Storage metadata 0건 | 사진/활동행 제거, 감사receipt 보존 |

create 외에는 활동ID와 예상 revision 필수. 부모행 lock 후 revision 일치하지 않으면 40001.
성공마다 revision 증가. finish_delete는 삭제 전 revision을 응답하고 deleted=true로 구분.
서버는 브라우저가 요청한 다른 활동ID/파일 경로/새revision을 임의로 신뢰하지 않습니다.
대표 사진을 바꾸거나 파일을 추가하려면 우선 비공개로 전환합니다.
수정 중 기존 공개 버전을 계속 제공하는 이중 버전 모델은 1차 범위 밖입니다.

RPC에는 Storage 네트워크 호출이 없으며 파일이 없는 finalize는 완료되지 않습니다.
한 번의 finalize가 모든 현재 사진을 정확히 한번 포함하는지 검사하여 ID 누락/중복/타활동 혼입 차단.
대표 ID는 그 목록 안에 있어야 함. finalized/complete 상태만 공개 가능.
레이아웃 저장/삭제 완료 RPC도 deferred 검증 실패 시 변경/receipt 모두 rollback됩니다.

## 6. 요청 중복과 업로드/삭제 실패

- 각 논리 명령마다 UUID p_request를 발급하고 UI의 복구 목록에 보관.
- DB는 actor+request에 advisory transaction lock. 같은 입력+같은request는 과거 응답 반환,
  같은request를 다른 입력으로 재사용하면 거부. 다른request의 동시 변경은 revision으로 차단.
- 응답 유실 시 동일request/동일payload로 재전송. 과거 receipt는 최신 활동상태가 아니므로 이후 목록 재조회.
- revision 충돌 시 자동 덮어쓰기 금지. 최신 목록을 불러와 사용자 의도를 확인하고 새request로 요청.
- reserve 성공 후 응답 유실: 같은request로 ID/경로 재취득, 새로운 파일을 중복 예약하지 않음.
- 업로드가 중복 경로 오류면 성공으로 단정하지 말고 해당 경로의 실제 metadata/크기/형식과
  서버 다운로드 검증을 먼저 수행. upsert로 덮어쓰지 않음.
- 부분 업로드 실패: pending 유지. 해당 run/활동/사진의 경로만 재확인하거나 삭제 준비→remove→삭제완료.
- 정상 finalize 전까지 일반방문자 노출 금지. 예약한 슬롯은 정리 완료 전까지 계속 점유.
- Storage remove 실패: deleting 유지, 경로 목록을 보고하고 해당 경로만 재시도.
- metadata 부재 확인만으로 실제 백엔드 파일 부재를 완전히 증명할 수 없음.
  API 다운로드/목록과 metadata를 대조해 모두 부재일 때 finish 호출; 404 이외의 네트워크 오류는
  정리 성공으로 표시하지 않음. metadata 없는 고아파일은 운영진이 run ID와 백업을 확인해 별도 조치.
- finish 응답 유실/활동 삭제 후 재전송도 receipt로 동일 응답. receipt를 미리 지우지 않음.
- 자동 대량 정리/버킷 전체삭제/DBreset 금지. 다른 활동/후기/기존사진은 정리 대상 아님.
- 관리자 승인 취소/계정 비활성화로 세션이 만료되면 적법한 다른 운영진이 잔여 항목을 확인하고 이어서 처리.
  권한을 우회하거나 만료된 토큰으로 강제정리하지 않음.

## 7. 저장→공개 갤러리→상세창

기존 개발 UI를 /admin/history에 연결하는 것은 이후 담당자 합의 후 별도 구현합니다.
서버가 create/reserve→한장씩 Storage upload→서버검증→finalize→publish 순서로 실행.
브라우저에 관리용 키를 제공하거나 50MB를 Server Action 하나에 몰아서 보내지 않습니다.
일반 세션의 Storage 업로드를 사용하며 signed upload URL/S3 직접쓰기 기능은 제공하지 않습니다.
관리자의 파일내용 검증 결과를 브라우저의 boolean으로 신뢰하지 않습니다.

/history는 공개 활동과 ready사진만 서버 조회하고 기존 HistoryPhoto로 변환합니다.
대표 src/alt, 나머지는 position순 additionalPhotos로 전달. 기존 카드/슬라이드 디자인 재사용.
히어로 콜라주·후기·로그인·출석·참가승인 테이블/정책은 건드리지 않습니다.
성공 응답은 DB commit 완료 후에만 처리하고 /history의 목록 캐시를 무효화.
다음 방문/새로고침 반영이 기본이며 실시간 푸시는 범위 밖입니다.

## 8. 비공개와 서명 URL/캐시 한계

앱에서는 URL 수명을 예:60초로 짧게 설정하고 cacheControl도 별도로 짧게 설정합니다.
DB에는 Storage 경로만 저장하며 서명 URL은 저장/로그하지 않습니다.
비공개 전환은 새로운 서명 발급을 막지만 이미 발급된 URL을 즉시 취소하지 않습니다.
브라우저/CDN/Next Image 캐시는 서명만료와 다릅니다. 초기 gallery/detail은 unoptimized로
통일하거나 공개 상태 재검증 이미지 경로를 사용하여 별도 최적화 캐시를 피하도록 구현 계획.
교체 파일은 새ID/경로 사용. 다운로드한 이미지는 회수할 수 없습니다.

중요: anon에게 Storage SELECT를 허용하면 익명 호출자가 직접 더 긴 expiresIn으로
서명 URL 생성을 시도할 수 있습니다. RLS만으로 앱의60초를 전세계 호출에 강제하지 못합니다.
따라서 이 초안은 '앱이 짧게 발급'하는 설계이며 '모든 기존 링크를60초 내 차단' 보장은 아닙니다.
엄격한 링크 수명/즉시 차단이 필수라면 anon Storage SELECT를 닫고, 서버가 공개상태를 매 요청
검증해 no-store로 스트리밍하는 통제 경로를 별도 보안 검토해야 합니다. 이것이 적용 전 운영 결정사항입니다.
서명 업로드 capability는 발급 이후 권한 전환을 우회할 수 있어 이 워크플로에서 발급하지 않습니다.
서비스 역할/관리자 직접 서명 발급까지 제한할 수 있다는 주장을 하지 않습니다.

## 9. 55422 적용 전 검토와 환경 보호

이번에는 적용/접속하지 않습니다. 향후 별도 승인을 받아야 하며 운영 적용도 별도입니다.
1. SQL/PLpgSQL 정적 리뷰 및 별도 DB에서 실제 컴파일·권한·동시성 검증.
   현재 로컬에 SQL 파서가 없어 문자열/구조 검사만 수행. 문법 통과라고 표시하지 않음.
2. 프로젝트 malmoim-review-auth-lab/API55421/DB55422/컨테이너 교차 확인.
3. 실제 pg_policies 전체/함수 이름/소유자/EXECUTE·테이블권한/Storage 버전·metadata 키와 postgres의 policy_grants를 적용 직전 재확인.
   기존 restrictive 정책이 새 버킷을 막는다면 기존 정책을 넓히지 말고 중단.
4. 기존55422의3002 가상계정/승인/후기/Storage 스냅샷과 복구가능 백업 확보.
   Storage 실파일과 DB는 각각 보호. 기존 인스턴스 초기화/중지 금지.
5. 적용용 별도 SQL은 가드 포함 초안을 그대로 실행하지 않고 검토된 파일로 별도 작성.
   이름 충돌 시 중단; DROP/CREATE OR REPLACE/IF NOT EXISTS로 기존 객체를 덮거나 숨기지 않음.
6. 새 객체만 단일트랜잭션 적용, 오류 시 rollback. 임의 수정·재실행 금지.
7. 화면은3001/3002를 변경하지 않고 충돌없는 새포트(예3003)·소스사본·독립패키지로 검증.
   API55421만 허용. 프로세스 환경변수 사용, 별도브라우저 프로필+서버/Proxy 동일 전용쿠키명.
8. 기존 환경 정책변경/테스트 데이터 손상이 필요해지면55422가 아닌 추가 격리DB에서 검증.

## 10. 향후 보안 테스트 매트릭스 — 아직 실행하지 않음

| 범주 | 검증/기대 결과 |
|---|---|
| 관리자 | 실제 관리자JWT RPC 성공, 관리자 회수 후 새 호출·기존 receipt 조회도 거부 |
| 일반/비로그인 | 모든 action RPC, 직접 테이블쓰기는 거부; 비공개행/사진/감사 안 보임 |
| 권한 우회 | 서비스키로 일반권한 테스트하지 않음; actor/경로/상태/revision 임의주입 거부 |
| 정책 OR | 독립DB에서 임시 broad permissive SELECT/INSERT/UPDATE/DELETE를 추가해도 새 guard가 우회 차단 |
| 다른 버킷 | 기존 후기 업로드/열람/삭제와 프로필/게시판/자료/인증서 접근결과 전후 동일 |
| 제한 | 10장/각5MiB/합계50MiB 허용; 11장,5MiB+1,50MiB+1,빈파일,MIME위조 거부 |
| 예약 우회 | 예약없는경로/다른활동경로/삭제중경로/공개활동 업로드 차단 |
| 완료 | 미업로드·metadata불일치·잘못된형식 finalize 차단; 대표없음/타활동대표 거부 |
| 순서 | 전체ID 정확히한번, 중복/누락/NULL/타활동ID/범위초과 거부; 순서교환 성공 |
| 공개 | complete만 공개; pending/deleting 섞이면 거부; 비공개는 신규익명조회·서명발급 차단 |
| 덮어쓰기 | upsert·동일경로UPDATE·버킷간이동 양방향 거부 |
| 동시성 | 9장상태 두예약 경쟁, 동일revision 수정/공개경쟁, 저장중삭제 경쟁에서 한쪽충돌/한도유지 |
| Storage 경쟁 | upload 진행중 begin_delete/finalize, remove 진행중 finish, 부모 lock대기와 교착/재시도 검증 |
| 중복 | 같은request동일입력 재전송 추가생성없음; 다른입력거부; 동시동일request 응답동일 |
| 응답 유실 | reserve/finalize/finish_delete 응답유실 후 재전송, 이전receipt와 최신상태 구분 |
| 삭제 실패 | 일부remove실패·timeout·404·metadata불일치에서 deleting유지/잔여보고, 기존파일손상없음 |
| 늦은 업로드 | 삭제준비 이후 업로드 거부, 완료RPC이후 잔여파일 없음, 필요시 별도정리 |
| URL/캐시 | 기존서명URL과 새발급거부 구분,60초 앱발급·직접긴TTL 시도 한계검증, CDN/브라우저캐시 점검 |
| 회귀 | 카드/콜라주/슬라이드/후기/로그인/3001/3002 동작·기존데이터 동일 |
| 정리 | 고유run의 파일만Storage API삭제 후 메타데이터/다운로드/목록 부재, DB테스트 rollback 별도확인 |

합계초과는10장×5MiB 조건과 중복이지만 DB합계가 독립적으로 거부되는지도 별도 검증합니다.
DB테스트는 transaction+rollback, Storage API테스트는 별도 가상리소스+명시적 정리가 필요합니다.
테스트를 작성/실행한 것으로 간주하지 않습니다.

## 11. 남은 불확실성 — 적용 승인 조건(아래 실제 점검 보완과 함께 해석)

- 55422는 앞선 읽기 전용 점검에서 확인했으나 이후 변경 가능. 운영은 미조회. DB 소유자·service키는guard대상 밖.
- SQL/PLpgSQL 본문 컴파일, 지연트리거/FK와 버전검사, advisory락·Storage락의 실제순서 미검증.
- 점검 당시 Storage1.82.1의 실제 객체3건에서 metadata.size/mimetype를 확인. delete API의SELECT/DELETE 경로와 signed-upload 우회 경로는 새 기능으로 미검증.
- 객체파일 IO와 metadata commit의 비원자성/고아파일 탐지. DB만으로 실파일부재 보장 불가.
- '짧은 앱서명URL' vs '엄격한60초차단' 중 운영 요구 선택. 후자면 통제 이미지 경로로 변경 필요.
- RPC 요청크기/사진 디코딩 메모리 제한·감사보존기간·원본 사진 공개동의 확인은 서버 구현 전 확정.
- 공개목록의 서명 만료 시 재조회와 갤러리 캐시 무효화는 이후 앱 코드에서 구현/검증.

## 공식 근거

- PostgreSQL 정책은 permissive OR + restrictive AND 결합:
  https://www.postgresql.org/docs/current/sql-createpolicy.html
- Supabase upsert는 SELECT/UPDATE 권한을 추가로 요구:
  https://supabase.com/docs/guides/storage/security/access-control
- private 버킷과 서명 URL:
  https://supabase.com/docs/guides/storage/buckets/fundamentals
- 서명URL 만료와 캐시TTL의 구분:
  https://supabase.com/docs/guides/storage/cdn/smart-cdn

## 12. 실제 독립 환경 점검 결과를 반영한 보완

이번 보완에서는 어떤 DB에도 연결/SQL실행하지 않았습니다. 이전 읽기 전용 점검 결과만 사용했습니다.
관측 대상은 malmoim-review-auth-lab / 호스트55422 / PostgreSQL17.11 / Storage1.82.1입니다.
이 사실은 운영 DB 또는 이후 시점의 상태를 보장하지 않습니다.

### 버킷·현재 객체 전제

- 새 버킷을 private + STANDARD + versioning_status=DISABLED로 명시적으로 생성하도록 초안 변경.
- lifecycle_configuration/generation은 NULL 유지. 기존 보호 트리거를 우회/비활성화하지 않음.
- history_activity_assert_bucket()이 이름/비공개/type/버전상태/용량/MIME집합/lifecycle의 전제를 검사.
  관리자 RPC/ready검증/새 버킷 Storage helper가 전제가 달라지면 실패하도록 설계.
- 기존 버킷을 UPDATE하거나 기존 설정을 정상으로 강제 맞추지 않음. 불일치는 중단/리뷰 대상.
- ready 인정 조건은 현재 경로 + archived_at IS NULL + is_delete_marker IS FALSE +
  is_versioned IS FALSE + JSON metadata object + 예약 size/mimetype 일치.
- NULL/잘못된size/metadata누락/삭제표식/이전버전은 유효업로드로 인정하지 않음.
- 이 조건만으로 실제 파일 업로드가 완전히 끝났다고 보장하지는 못함.
  현재 카탈로그에서 범용 '업로드완료' 플래그는 확인하지 않았음. 서버가 Storage API로
  업로드 응답 후 다운로드한 실제바이트/크기/형식/디코딩까지 확인한 다음 finalize 호출해야 함.
  metadata만 존재하는 실패/중단/부분업로드가 이 서버 검증을 통과하지 못하는지 향후 API검증 필수.
- 관리자가 직접 RPC를 호출해 서버 검증을 생략하는 것까지 막는 증명 체계는 미구현.
  현재 경계는 신뢰된 관리자이며, 비신뢰 관리자까지 고려한다면 서버전용 attestation 설계를 추가해야 함.
- 삭제완료에서는 이전버전/삭제표식도 metadata 잔여로 취급하여 엄격히 차단.
  API에서 보이지 않는 잔여행을 직접삭제로 우회하지 말고 중단 후 Storage버전에 맞는 절차 검토.

### 역할 구분과 적용 책임

| 역할/경로 | 점검에서 확인된 사실 | 의미 |
|---|---|---|
| postgres | superuser=false, BYPASSRLS=true, public CREATE가능 | RLS조회우회가 가능하지만 모든 테이블의 DDL권한을 뜻하지 않음 |
| supabase_storage_admin | objects/buckets 소유자, BYPASSRLS=false | Storage 객체의 소유권에 따른 정책관리 권한이 있음. public 함수관리까지 된다는 보장은 없음 |
| postgres→storage 소유역할 | MEMBER=false, SET=false, USAGE=false | postgres가 임의 SET ROLE해서 해결할 수 있는 것으로 가정하지 않음 |
| 기존 definer RPC | postgres소유, search_path='', authenticated실행, 실제관리자확인 | 앱 RPC의 소유자/권한 설계에 참고. Storage CREATE POLICY 권한의 증거는 아님 |
| supautils | postgres가 supabase_privileged_role 멤버이며 policy_grants에 objects/buckets 포함 | postgres의 정책관리 설정 근거. 실제 CREATE POLICY 성공은 아직 미검증 |

저장소의 기존 SQL(001/005/020/023 및 local 참가자승인 SQL)은 CREATE POLICY를 사용하지만
실제로 어떤 세션/권한으로 적용됐는지 그 파일만으로 알 수 없습니다.
CLI 또는 SQL Editor라는 도구 이름만으로 current_user/session_user와 정책생성 권한을 증명할 수 없습니다.
후속 읽기 전용 조사에서는 postgres의 public CREATE, Storage bucket INSERT,
supautils.policy_grants의 storage.objects/storage.buckets 정책관리 설정을 확인했습니다.
따라서 독립55422의 우선 적용 역할은 postgres로 정합니다. 역할전환/권한상승/소유자변경은 하지 않습니다.
실제 DDL 성공까지 확인된 것은 아니며 적용 직전 같은 설정인지 다시 확인해야 합니다.
앱 객체와 Storage 정책은 책임상 구분하되, 현재 독립환경에서는 반드시 다른 실행역할로 나눌 근거가 없습니다.
세부 단일트랜잭션 계획과 권한표는 아래13절이 최종 기준입니다.

SECURITY DEFINER 함수를 반드시 신뢰된 소유자로 만들며 무조건 Storage 소유자에게 맡기지 않습니다.
빈 search_path/스키마지정/관리자재확인/호출자 지정불가/직접쓰기회수는 유지합니다.
명시적 PUBLIC/anon/authenticated/service_role REVOKE로 신규 함수의 기본 EXECUTE를 회수하고
필요한 역할만 다시 허용합니다. pg_default_acl과 최종 유효 권한도 재확인합니다. 현재 기존 함수에는 service_role 직접 EXECUTE도 확인되었으나
새 RPC는 auth.role=authenticated+실제 admin_users 조건으로 다시 차단하는 설계입니다.
검증함수/트리거함수에는 앱 직접 실행권한을 주지 않으며, 정책용 boolean helper만 필요한 공개실행을 허용합니다.
다른역할로 정책을 생성한다면 helper 실행권한·함수소유자·부트스트랩순서도 확인해야 합니다.

### 기존 버킷과 분리 및 실제 적용 전 검증

점검 당시 objects 정책은 후기버킷용 permissive3개+restrictive INSERT1개이고 buckets 정책은 없었습니다.
후기 guard는 다른버킷을 통과시키므로 새버킷을 막지 않으며, 기존 permissive3개는 새버킷을 허용하지 않음.
새 guards는 CASE로 새버킷일 때만 helper를 호출하고 다른버킷은 true로 통과시킵니다.
새 permissive정책은 다른버킷에서 false. 새 설정검사 실패가 기존후기버킷을 막지 않도록 분기합니다.
UPDATE는 이전행/새행 모두 새버킷을 제외하여 덮어쓰기와 버킷이동 차단을 유지합니다.
기존후기정책을 DROP/ALTER/재생성하거나 기존버킷을 UPDATE하지 않습니다.

정적 구조확인(이번 수행 가능): 실행차단 위치, 마지막ROLLBACK,4개guard,버킷분기,
수량/용량/대표제약 유지,명시적STANDARD/DISABLED,활성객체검사,기존객체 변경명령 미포함.
미수행: SQL파서/PLpgSQL 컴파일,소유자별 CREATE POLICY 실행,함수기본ACL 적용,Storage API/실파일검증,
동시업로드/삭제경쟁,직접긴서명URL/캐시,현재객체만다운로드 동작.
이 미수행 항목을 통과했다고 표시하지 않으며 가드와 NOT-FOR-EXECUTION을 계속 유지합니다.

추가 테스트: 버킷type/버전/lifecycle불일치 차단,삭제표식/보관행/버전화행 거부,
metadataNULL/size문자열위조/실파일부재/부분업로드 거부,다른버킷회귀,
단계별 적용중단과 잘못된함수소유자/기본EXECUTE권한 검출.

## 13. 최종 독립 테스트 적용 계획과 객체별 권한표

### 적용 역할 결정과 전제

우선 역할은 **postgres**, 대상은 **malmoim-review-auth-lab / 127.0.0.1:55422**로 한정합니다.
이 결정은 이전 읽기 전용 조사에 근거하며, 이번 문서 보완에서 DB 접속/SQL실행은 하지 않았습니다.
postgres는 storage 소유자 역할의 멤버가 아니지만, 현재 supautils.policy_grants는 postgres에
storage.objects/storage.buckets의 정책관리를 허용하도록 설정되어 있습니다.
public 객체 생성권한, buckets INSERT권한, 정책관리 확장 설정은 서로 다른 근거입니다.
storage 스키마의 CREATE권한은 없지만 이번 설계는 그 스키마에 새테이블/함수를 만들지 않습니다.
Storage 정책이 테이블 소유자 아닌 postgres로 생성되는 실행 경로는 설정상 타당한 후보이며,
그 동작을 실제DDL로 검증한 것으로 표현하지 않습니다. 실패하면 역할을 바꾸지 않고 중단합니다.
기존 supabase_migrations 이력스키마/테이블은 조사 당시 없었습니다. 과거 SQL의 실제 실행역할은
현재 함수소유자와 기존스크립트만으로 확정하지 않습니다. RUNBOOK의 초기상태 설명도 실제최신상태 증거로 삼지 않습니다.
운영에서는 이 결정과 설정을 재사용하지 않고 별도 읽기 전용 확인/승인부터 진행합니다.

### 객체별 생성·소유·접근 권한

| 객체 | 생성 역할 / 최종 소유 | 허용 접근 |
|---|---|---|
| history_activities | postgres / postgres | anon·authenticated SELECT(공개 또는 관리자 RLS); 앱 직접쓰기 없음 |
| history_activity_photos | postgres / postgres | anon·authenticated SELECT(공개ready 또는 관리자 RLS); 앱 직접쓰기 없음 |
| history_activity_commands | postgres / postgres | authenticated SELECT+관리자 RLS; 공개조회·직접쓰기 없음 |
| 새 인덱스·FK·검증트리거 | postgres / 테이블 및 함수 소유권에 종속 | 일반 사용자 별도관리권한 없음 |
| public의 신규 함수6개 | postgres / postgres | 아래 EXECUTE표 적용 |
| history-activity-photos 버킷 행 | postgres가 INSERT / 행 자체의 DB소유자 개념 없음 | Storage API/RLS만 사용; private STANDARD DISABLED |
| storage.objects·storage.buckets | 기존 supabase_storage_admin 소유 유지 | 기존 테이블권한/정책을 전역변경하지 않음 |
| 앱 테이블 SELECT 정책3개 | postgres / 정책 독립소유자 없음 | 연결된 테이블 소유권에 종속 |
| 새버킷 permissive 정책3개 | postgres(policy_grants 경로) / 독립소유자 없음 | SELECT 공개ready/관리자, INSERT pending관리자, DELETE deleting관리자 |
| 새버킷 restrictive guard4개 | postgres(policy_grants 경로) / 독립소유자 없음 | 다른버킷 통과, 새버킷 제한 강제; UPDATE 이동/덮어쓰기 차단 |

버킷 행의 owner/owner_id 열은 PostgreSQL 테이블소유자와 다릅니다. 소유권을 바꿔 문제를 해결하지 않습니다.
postgres(소유자)·superuser 등 플랫폼 운영권한은 신뢰 경계 밖이며 회수 대상으로 다루지 않습니다.

### 신규 함수 EXECUTE 최종 목록

| 함수 | 방식 | anon | authenticated | service_role |
|---|---|---|---|---|
| history_manage_activity(text,uuid,bigint,uuid,jsonb) | DEFINER + 매호출 관리자 재확인 | 차단 | 허용, 실제 관리자만 성공 | 차단 |
| history_activity_is_admin() | DEFINER, 본인 관리자 여부 boolean만 | 허용 | 허용 | 차단 |
| history_activity_storage_allowed(text,text) | DEFINER, 권한 boolean만 | 허용(읽기조건만 성공) | 허용, 쓰기조건은 관리자만 | 차단 |
| history_activity_assert_bucket() | DEFINER, 내부 설정검증 | 차단 | 차단 | 차단 |
| history_activity_validate() | DEFINER, 지연 검증트리거 | 차단 | 차단 | 차단 |
| history_activity_photo_lock() | INVOKER, 부모잠금 트리거 | 차단 | 차단 | 차단 |

모든 신규 함수는 search_path='' 고정. 실제 앱 쓰기는 관리 RPC의 definer 문맥에서만 이루어집니다.
관리자 helper는 NULL을 false로 처리하며 auth.uid, auth.role=authenticated, admin_users를 확인합니다.
일반회원에게 EXECUTE가 있어도 관리자 RPC는 성공할 수 없습니다. 내부함수를 직접호출해 우회할 수도 없습니다.
정책 helper의 공개실행은 정책평가에 필요한 예외이며 타인 관리자정보/비공개 경로내용을 반환하지 않습니다.

현재 기본 ACL에는 postgres가 만든 함수의 anon/authenticated/service_role EXECUTE가 포함됩니다.
초안은 **신규 함수마다 PUBLIC·anon·authenticated·service_role의 기본권한을 먼저 명시적으로 회수**하고
표에 필요한 것만 GRANT합니다. 전역 ALTER DEFAULT PRIVILEGES는 사용하지 않습니다.
신규 테이블도 service_role을 포함한 기본권한을 회수하고 표의 SELECT만 다시 허용합니다.
BYPASSRLS 자체가 테이블/함수 접근권한을 생성하지는 않습니다. 서비스키 기반 작업은 이1차 설계에 없습니다.
기존 함수·테이블·역할의 grant/owner/default ACL은 손대지 않습니다.
향후 cleanup worker가 service_role을 필요로 하면 별도권한 설계와 승인 대상입니다.

### 향후 별도55422 테스트 마이그레이션 준비 절차(이번에는 파일 생성/실행 안 함)

1. 이 NOT-FOR-EXECUTION 파일은 그대로 보존하고 검토완료된 내용을 별도 테스트용 파일로 추출.
   예시 위치는 전용lab의 activity-photo-migrations/001_history_activity_photos.reviewed.sql.
   기존 manifest/SQL1~15/레포 자동 migrations/운영배포 경로에 임의추가하지 않음.
2. 테스트 적용본의 예상 객체목록·순서·해시·postgres역할·접속55422·복구대상을 실행안내와 함께 작성.
   문법/PLpgSQL 본문 리뷰를 먼저 하고 실제 적용 허가는 별도로 받음.
3. 실행직전 Docker 컨테이너ID/프로젝트/호스트55422/DB식별정보와 session_user=current_user=postgres를
   재검증. public CREATE, buckets INSERT, policy_grants 대상2개, 기본ACL·소유자·이름충돌 확인.
   설정불일치/이름충돌이면 기존객체를 덮어쓰지 않고 중단. 역할전환/권한추가로 우회하지 않음.
4. 승인 후 새 DB객체와 버킷 행·정책만 **단일 트랜잭션**으로 적용하는 계획을 우선 사용.
   순서: 전제검사 → 내부검증함수 → 앱테이블/FK/트리거 → 명령기록테이블 →
   관리자helper/RPC → 앱권한/RLS → Storagehelper → private버킷 생성/설정확인 →
   Storage permissive3개/restrictive4개 → 최종소유자/search_path/유효권한 검증 → commit.
   내부검증함수는 정의시 버킷을 조회하지 않으므로 버킷행 생성 후에만 호출되도록 유지.
5. SQL초안은 맨앞예외+마지막ROLLBACK을 유지한다. 별도승인된 적용본만 명확한 commit/실패rollback
   절차를 가진다. SQL초안을 직접 실행하기 위해 즉석에서 가드를 지우지 않음.
6. psql 등 적용 도구의 오류중단 옵션과 전체트랜잭션을 사용하도록 실행계획에 명시.
   중간오류/정책DDL권한오류/권한검증실패는 rollback하고 즉시중단, 자동수정·재실행 금지.
7. commit 후 SELECT로 신규객체/정책/권한 및 기존데이터 보존을 확인한 다음 권한/API 테스트를 별도승인.
   실제 Storage 파일 생성은 DDL 트랜잭션 밖의 작업이며 자동롤백되지 않음.

### 실패 시 중단·복구

- commit 이전 오류: 트랜잭션 rollback. 변경된 신규객체도 남지 않아야 하며 읽기 전용으로 확인.
- 도중 연결단절: 결과를 추측해 재실행하지 않고 트랜잭션/신규객체 상태를 먼저 조회.
- commit 이후 테스트실패: 새기능 사용을 중단하고 생성객체·run리소스 목록을 기록.
  자동DROP/전체DBreset/컨테이너초기화/기존정책수정 금지. 신규객체만 대상으로 복구SQL을 별도리뷰·승인.
- 이후 생성된 파일은 해당실행 경로만 Storage API로 제거하고 파일/metadata 부재 확인 후 DB정리.
  Storage 보호트리거 해제·직접SQL삭제·전체버킷삭제로 우회하지 않음.
- 기존 후기/승인/계정/Storage의 스냅샷과 비교. 3001/3002는 재시작하거나 설정변경하지 않음.

### 완료와 미검증 구분

완료: 설계와 실행권한표, postgres 우선 적용근거, 명시적 신규권한회수, 실패중단계획 정리.
정적확인: 초안차단장치/ROLLBACK,6개함수의 최소권한,4개guard,기존버킷분리,10장/5MiB/50MiB/대표필수 유지.
미검증: SQL문법/PLpgSQL 컴파일,실제정책생성 및 적용완료,트리거/RPC/Storage API/동시성/브라우저.
현재 파일은 실행가능 승인본이 아니며 운영에는 적용하지 않습니다.
