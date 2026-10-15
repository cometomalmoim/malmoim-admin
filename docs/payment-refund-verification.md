# PR #28 검증 결과와 문자 연동 기준

운영 DB 적용·main 병합·운영 배포는 보류합니다. 기능 코드 `94849f7`을 기준으로 확인했고 이 문서와 재현 스크립트를 추가했습니다. 실제 문자 발송 기능은 구현·실행하지 않았습니다.

## 검사 결과

| 검사 | 결과 | 범위·한계 |
| --- | --- | --- |
| 코드 테스트 | 37개 통과 | 참가비·신청자·납부·환불·참여 이력·검색·필터·페이지 이동 |
| ESLint | 오류 0개, 기존 경고 2개 | `suggestions.ts`의 기존 미사용 인자 |
| TypeScript | 통과 | `tsc --noEmit --incremental false` |
| 프로덕션 빌드 | 미완료 | Turbopack CSS 처리 자식 프로세스의 포트 바인딩이 `Operation not permitted`로 차단됨 |
| 일반 PostgreSQL 임시 서버 | 실행 불가 | initdb의 `shmget` 공유 메모리 생성이 `Operation not permitted`로 차단됨 |
| 임베디드 PostgreSQL SQL 테스트 | 통과 | PGlite 0.5.10 / PostgreSQL 18.6 WASM, 일회용 메모리 DB, 합성 Auth·역할 |
| 독립 연결 간 동시 처리 | 미완료 | PGlite는 단일 연결이므로 실제 경합·대기·교착을 검증하지 못함 |
| 실제 Supabase Auth·PostgREST | 미완료 | 테스트 프로젝트·JWT·관계 조회 환경을 사용하지 않았음 |

실행 결과 원문: [격리 DB 검증 JSON](verification/payment-db-report.json).

## DB에서 실행해 확인한 내용

운영 데이터·운영 연결 설정을 가져오지 않고, 합성 `auth.users`, `auth.uid()` 및 `anon`/`authenticated` 역할을 만들었습니다. 필요한 기존 스키마와 참여 이력 011을 구성한 뒤 SQL 012→013→014→015를 실제 PostgreSQL 엔진에 적용했습니다. 혼합 초안·경계 변경용 SQL은 실행하지 않았습니다.

- 참여 이력 뷰·RPC 정의가 012→015 전후 동일하고 기존 참여 이력 SQL 회귀 테스트가 통과했습니다.
- 기존 납부·환불 SQL 회귀 테스트 2개가 통과했고, 각 테스트의 신청자·환불·감사·참여 관련 가상 데이터가 롤백됐습니다.
- 관리자 참가비·가상 계좌 안내 저장 및 재조회, 실제 납부액과 기록 관리자·일시 저장을 확인했습니다.
- 납부액 미확인·0원, 오래된 revision, 직접 금액 UPDATE, 환불 시작 후 금액 정정을 차단했습니다.
- 납부액 동일 금액 재저장의 감사·revision 중복 방지와 금액 정정 전후 감사 기록을 확인했습니다.
- 요청·승인은 납부 상태를 유지하고, 외부 송금 확인을 거친 동일 금액의 전액 환불만 완료됩니다. 0원·부분 금액·초과 금액·승인 전 완료·중복 요청·중복 완료를 차단했습니다.
- 일반 신청자 수정 RPC의 환불 상태 진입·해제 차단, 납부액 기록 후 미납으로의 상태 변경 차단, 기존 프로필 수정·legacy 미기록 값 보존을 확인했습니다.
- 비관리자의 환불 조회·금액 저장·환불 요청 및 익명의 RPC 호출이 차단됐습니다. 이는 합성 역할 기반 DB 권한 검증이며 실제 Supabase JWT 연동 검증과는 구분합니다.
- 환불 완료 감사 INSERT를 의도적으로 실패시키자 환불 상태·납부 상태·revision이 모두 원래 값으로 롤백됐습니다.
- 별도 임시 DB에서 015 끝에 오류를 주입하자 추가 컬럼·함수 생성이 롤백됐습니다. 이는 015 실패 원자성 검증이며 운영 적용 후 복구 스크립트를 검증한 것은 아닙니다.

실제 다중 연결 동시 처리와 운영 환경 호환성이 미확인인 만큼 **운영 적용 승인으로 해석하면 안 됩니다.** 런타임·버전·Auth 구성 차이도 남아 있습니다.

## 재현

```sh
npm ci
node --test tests/*.test.mjs
npm run lint
npx tsc --noEmit --incremental false
npm run test:db:embedded
NEXT_TELEMETRY_DISABLED=1 npm run build
```

`test:db:embedded`는 네트워크 DB에 연결하지 않고 매번 새 메모리 DB를 만들며 종료 시 닫습니다. 합성 데이터만 사용하고 JSON 결과를 OS 임시 폴더에 남깁니다. 실패한 검사가 있으면 종료 코드 1을 반환합니다. [PGlite 공식 문서](https://pglite.dev/docs/)의 단일 연결 제한 때문에 병렬 호출을 동시성 통과로 처리하지 않습니다.

## 미완료 검증을 위한 조치

1. 포트 바인딩과 PostgreSQL 공유 메모리가 허용된 별도 로컬 터미널·CI 또는 일회용 테스트 컨테이너를 준비합니다. 운영 DB 접속 정보를 사용하지 않습니다.
2. 실제 테스트 DB 버전을 기록하고 합성 데이터로 012→015를 적용합니다. 네이티브 PostgreSQL의 독립 세션 두 개로 중복 요청·완료 경쟁, 금액 정정 대 환불 완료 경쟁, 오래된 신청자 수정 경쟁을 검사합니다.
3. 두 세션 중 하나가 잠금 대기한 뒤 유일한 완료·감사·revision만 남는지, 실패 시 부분 변경이나 교착이 없는지 확인합니다.
4. 별도 Supabase 테스트 프로젝트에서 관리자·비관리자·익명 JWT 및 PostgREST 관계 조회, 전체 참가비·납부·환불 UI 저장 경로를 확인합니다.
5. 프로덕션 빌드를 동일 잠금 파일로 다시 실행하고 결과를 PR에 추가한 뒤 운영 적용 여부를 별도로 검토합니다.

## 문자 기능에서 읽을 필드

관리자 서버에서 기존 Supabase 세션과 RLS로 조회합니다. 브라우저 발송 대상 배열이나 납부액을 신뢰하지 않고 발송 직전에 재조회해야 합니다. 신청자 키는 **`event_id + source + id`**이며 `id`만으로 연결하지 않습니다.

| 조회 대상 | 필드 | 의미 |
| --- | --- | --- |
| `event_application_list` | `event_id`, `source`, `id`, `name`, `contact`, `contact_type` | 이벤트별 신청자·수신 연락처 |
| 동일 뷰 | `status` | 선발 상태. 입금 요청은 기본 `accepted` 대상 |
| 동일 뷰 | `payment_status` | `unknown` 미확인 / `unpaid` 미입금 / `pending_confirmation` 확인 대기 / `paid` 입금 완료 / `refunded` 환불 |
| 동일 뷰 | `paid_amount_krw` | 확인된 실제 납부액. NULL은 미기록이며 미납이라는 뜻이 아님 |
| 동일 뷰 | `payment_confirmed_by`, `payment_confirmed_at` | 납부 상태 확인 관리자·시각 |
| 동일 뷰 | `paid_amount_recorded_by`, `paid_amount_recorded_at` | 실제 금액 기록 관리자·시각 |
| `recruitment_events` | `fee_amount_krw`, `payment_method`, `payment_bank_name`, `payment_account_number`, `payment_account_holder`, `payment_due_at`, `payment_notice` | 입금 안내에 사용할 이벤트 설정. 금액 NULL·0은 입금 요청 제외 |
| `event_application_refunds` | `event_id`, `source`, `application_id`, `status` | 신청자 키로 연결. `requested`, `approved`, `processed`가 하나라도 있으면 입금 요청 제외 |
| 동일 테이블 | `reason`, `requested_at`, `decision_by`, `decision_at`, `processed_amount_krw`, `processed_by`, `processed_at` | 관리자 환불 기록 조회용. 문자 서비스에 불필요한 상세·담당자 정보를 전송하지 않음 |

다음은 **향후 문자 대상 선정 정책 예시**이며 새 RPC나 발송 기능을 추가한 것은 아닙니다. `$1`은 이벤트 slug 바인딩 값입니다. 관리자 전용 SQL 실행 환경에서 사용할 조회 형태이며 Supabase 클라이언트에서 임의 SQL을 실행하는 방식은 아닙니다.

```sql
select a.event_id, a.source, a.id as application_id,
       a.name, a.contact, a.payment_status,
       e.title, e.fee_amount_krw, e.payment_due_at, e.payment_notice
from public.event_application_list a
join public.recruitment_events e on e.id = a.event_id
where e.slug = $1
  and a.status = 'accepted'
  and a.payment_status = 'unpaid'
  and a.paid_amount_krw is null
  and e.fee_amount_krw > 0
  and a.contact_type = 'phone'
  and a.contact ~ '^\+?[0-9]{8,15}$'
  and not exists (
    select 1 from public.event_application_refunds r
    where r.event_id = a.event_id
      and r.source = a.source
      and r.application_id = a.id
      and r.status in ('requested', 'approved', 'processed')
  );
```

위 문자 대상 SQL 예시도 가상 신청자·환불 데이터로 실행해 대상 제외 조건과 무료 이벤트 제외를 확인했습니다.

현재 클라이언트 조회는 `getRecruitment(slug,page,query)`의 납부 필터와 `getApplicantRefunds(slug,rows)`를 재사용할 수 있습니다. `getRecruitment`는 25건 단위이므로 일괄 발송 대상을 한 페이지만 읽어 완료했다고 처리하면 안 됩니다. 환불 조회도 서버 응답 상한·페이지 처리 여부를 확인해야 합니다. 대량 발송은 별도 서버 대상 선정·중복 방지 기록이 필요하며 이번 작업에는 포함하지 않습니다.

`unknown`은 관리자 확인 전 자동 입금 요청에서 제외하고, `pending_confirmation`에는 재입금을 요청하지 않습니다. `paid_amount_krw`가 비어 있는 `paid` 또는 기존 `refunded`도 입금 요청에서 제외합니다. `paid`·`refunded`에 대한 안내는 입금 요청과 별도 템플릿으로 구분합니다. 실제 발송 여부·이벤트별 기간·대상 정책은 발송 단계에서 확정합니다.
