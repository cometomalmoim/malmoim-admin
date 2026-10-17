// Pure preview model. No transport, credentials or persistence.
export type ApplicantKey = { event_id: string; source: 'season9'|'registration'|'manual'; application_id: string };
export type TargetApplicant = ApplicantKey & { name: string; status: string; confirmation: string|null; phone: string|null; revision: number; selectionRevoked: boolean };
export type RequestDocument = { id: string; name: string; revision: number };
export type TargetRequest = { id: string; key: ApplicantKey; name: string; document: RequestDocument; applicantStatus: string; phoneSnapshot: string; revisionSnapshot: number; status: 'pending'|'completed'|'cancelled'|'expired'; createdAt: string; expiresAt: string; completedAt: string|null; generation: number; history: string[] };
export const requestStates = {pending:'서명 대기 · 미발급',completed:'서명 완료 · 가상 이력',cancelled:'취소 · 접근 차단 예정',expired:'만료 · 접근 차단 예정'};
export function applicantKey(key: ApplicantKey) { return JSON.stringify([key.event_id,key.source,key.application_id]); }
export function targetEligibility(a: TargetApplicant, eventId: string): { eligible: boolean; sendable: boolean; reason: string } {
 const deny=(reason:string)=>({eligible:false,sendable:false,reason});
 if(a.event_id!==eventId)return deny('이벤트 소속 불일치');
 if(a.selectionRevoked)return deny('합격 취소 시뮬레이션 · 운영 전용 상태값 없음');
 if(a.status==='withdrawn')return deny('신청 취소/철회');
 if(a.confirmation==='cancelled')return deny('참가 취소');
 if(!['received','reviewing','accepted','waitlisted','declined','withdrawn'].includes(a.status))return deny('신청 상태 미확인');
 if(a.confirmation!==null&&!['unconfirmed','confirmed','cancelled'].includes(a.confirmation))return deny('참가 확정 상태 미확인');
 if(a.status==='waitlisted'||a.status==='declined')return deny(a.confirmation==='confirmed'?'신청·참가 상태 불일치 · 검토 필요':'대기/불합격 제외');
 if(a.status!=='accepted'&&a.confirmation!=='confirmed')return deny('합격 또는 참가 확정 근거 없음');
 if(!a.phone)return {eligible:true,sendable:false,reason:'대상 자격 있음 · 전화번호 없음 · 발송 불가'};
 return {eligible:true,sendable:true,reason:a.status==='accepted'?'합격 근거':'참가 확정 근거 (합격과 별도)'};
}
export function requestAccessReason(r:TargetRequest,a:TargetApplicant|undefined,now:string):string {
 if(r.status==='completed')return '가상 완료 이력 보존 · 재요청 차단 · 실제 PDF 없음';
 if(r.status==='cancelled')return '요청 취소 · 접근 차단 필요';
 if(r.status==='expired'||Date.parse(r.expiresAt)<=Date.parse(now))return '링크 만료 · 접근 차단 필요';
 if(!a||applicantKey(a)!==applicantKey(r.key))return '신청자 연결 미확인 · 접근 차단 필요';
 const eligibility=targetEligibility(a,r.key.event_id);
 if(!eligibility.sendable)return `${eligibility.reason} · 접근 차단 필요`;
 if(a.phone!==r.phoneSnapshot)return '전화번호 변경 · 이전 접근 차단 및 관리자 재검토 필요';
 return '발급 예정 · 실제 링크/토큰 없음';
}
export function duplicateRequest(rows:TargetRequest[],a:ApplicantKey,documentId:string) { return rows.find(r=>applicantKey(r.key)===applicantKey(a)&&r.document.id===documentId); }
export function prepareRequests(applicants:TargetApplicant[],keys:string[],eventId:string,document:RequestDocument,rows:TargetRequest[],now:string,days:number):TargetRequest[] {
 if(!Number.isFinite(Date.parse(now))||!Number.isInteger(days)||days<1||days>30||!keys.length||new Set(keys).size!==keys.length)throw new Error('대상 또는 유효기간 확인 필요');
 const selected=keys.map(key=>{const a=applicants.find(row=>applicantKey(row)===key);if(!a||!targetEligibility(a,eventId).sendable)throw new Error('최신 신청 상태·연락처 재검증 실패');if(duplicateRequest(rows,a,document.id))throw new Error('동일 신청자·서류 이력 존재: 중복 생성 차단 (버전 변경 포함)');return a;});
 return selected.map((a,i)=>({id:`preview-${now}-${rows.length+i}`,key:{event_id:a.event_id,source:a.source,application_id:a.application_id},name:a.name,document:{...document},applicantStatus:a.status,phoneSnapshot:a.phone!,revisionSnapshot:a.revision,status:'pending',createdAt:now,expiresAt:new Date(Date.parse(now)+days*86400000).toISOString(),completedAt:null,generation:1,history:[`${now} 메모리 요청 준비 · 링크/문자 미발급`]}));
}
export function changeRequest(r:TargetRequest,action:'cancel'|'expire'|'reissue',a:TargetApplicant|undefined,now:string,days:number):TargetRequest {
 if(r.status==='completed')throw new Error('완료 이력은 변경할 수 없습니다.');
 if(action==='reissue') {
  if(!a||applicantKey(a)!==applicantKey(r.key)||!targetEligibility(a,r.key.event_id).sendable||!Number.isInteger(days)||days<1||days>30)throw new Error('현재 신청 상태·연락처 확인 필요');
  return {...r,status:'pending',phoneSnapshot:a.phone!,revisionSnapshot:a.revision,generation:r.generation+1,expiresAt:new Date(Date.parse(now)+days*86400000).toISOString(),history:[...r.history,`${now} 관리자 재검토 후 재발급 예정 · 이전 세대 차단 · 실제 발급 없음`]};
 }
 return {...r,status:action==='cancel'?'cancelled':'expired',history:[...r.history,`${now} ${action==='cancel'?'요청 취소':'링크 만료'} 시뮬레이션 · 접근 차단 필요`]};
}
export function targetFixtures():TargetApplicant[] {
 const states=[['accepted',null],['reviewing','confirmed'],['waitlisted',null],['declined',null],['withdrawn',null],['accepted','cancelled'],['received',null],['unknown',null],['accepted',null],['accepted',null],['accepted',null],['waitlisted','confirmed']] as const;
 return ['preview-event-1','preview-event-2'].flatMap(event_id=>states.map(([status,confirmation],i)=>({event_id,source:(['season9','registration','manual'] as const)[i%3],application_id:`preview-application-${i+1}`,name:`가상 대상 ${String(i+1).padStart(2,'0')}`,status,confirmation,phone:i===8?null:`TEST-PHONE-${i+1}`,revision:1,selectionRevoked:i===9})));
}

// Revoke in preview on observed changes; recovery never silently restores old access.
export function reconcileApplicantChange(rows:TargetRequest[],previous:TargetApplicant,next:TargetApplicant,now:string):TargetRequest[] {
 if(targetEligibility(next,next.event_id).sendable&&next.phone===previous.phone)return rows;
 return rows.map(r=>applicantKey(r.key)===applicantKey(previous)&&r.status!=='completed'?{...r,status:'cancelled',history:[...r.history,`${now} 가상 신청 상태/연락처 변경 · 이전 접근 차단 필요 · 재발급 전 복원 금지`]}:r);
}
