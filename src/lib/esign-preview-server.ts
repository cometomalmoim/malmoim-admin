import {signingEligibility,validApplicantKey} from './esign-server-contracts.ts';
// Server adapter contract and isolated synthetic implementation. Never imports Supabase.
import { applicantKey, targetFixtures, type ApplicantKey, type TargetApplicant, type TargetRequest } from './signing-targets.ts';
export type PreviewActor={id:string;events:string[]};
export interface PreviewAuth { authenticate(credential:string|null):PreviewActor|null }
export const fixtureAuth:PreviewAuth={authenticate(value){return value==='fixture-admin'?{id:'fixture-admin',events:['preview-event-1','preview-event-2']}:value==='fixture-limited'?{id:'fixture-limited',events:['preview-event-1']}:null;}};
export type ServerApplicant=TargetApplicant&{contactType:string};
export interface ApplicantAdapter { find(key:ApplicantKey):ServerApplicant|undefined }
export function serverFixtures():ServerApplicant[]{return targetFixtures().map((a,i)=>({...a,phone:a.phone?`+82100000${String(i+1).padStart(4,'0')}`:null,contactType:'phone'}));}
export function eligibilityCode(a:ServerApplicant,event:string):string {return signingEligibility(a,event);}
export type PreviewCommand={operation:'validate'|'scenario'|'cancel';eventId:string;documentId?:string;version?:number;keys?:ApplicantKey[];days?:number;idempotencyKey?:string;scenario?:'withdraw'|'revoke'|'phone'|'waitlist'|'confirmOnly'|'complete';requestId?:string};
export class PreviewService {
 applicants=serverFixtures();requests:TargetRequest[]=[];
 private replays=new Map<string,{payload:string;result:unknown}>();
 private auth:PreviewAuth;
 private adapter?:ApplicantAdapter;
 constructor(auth:PreviewAuth=fixtureAuth,adapter?:ApplicantAdapter){this.auth=auth;this.adapter=adapter;}
 execute(credential:string|null,input:PreviewCommand,now=new Date().toISOString()):{http:number;body:Record<string,unknown>} {
 const fail=(http:number,code:string)=>({http,body:{code}});
 const actor=this.auth.authenticate(credential);if(!actor)return fail(401,'UNAUTHENTICATED');
 if(!actor.events.includes(input.eventId))return fail(403,'EVENT_FORBIDDEN');
 if(!['validate','scenario','cancel'].includes(input.operation))return fail(400,'INVALID_OPERATION');
 const find=(key:ApplicantKey)=>this.adapter?this.adapter.find(key):this.applicants.find(a=>applicantKey(a)===applicantKey(key));
 if(input.operation==='cancel'){
  const r=this.requests.find(r=>r.id===input.requestId&&r.key.event_id===input.eventId);if(!r)return fail(404,'REQUEST_NOT_FOUND');if(r.status==='completed')return fail(409,'COMPLETED_IMMUTABLE');
  r.status='cancelled';r.history.push(`${now} 테스트 서버 취소 · 실제 접근 권한 없음`);return {http:200,body:{code:'CANCELLED',request:structuredClone(r)}};
 }
 if(!Array.isArray(input.keys)||!input.keys.length||input.keys.length>50||input.keys.some(k=>!validApplicantKey(k,'preview')||k.event_id!==input.eventId)||new Set(input.keys.map(applicantKey)).size!==input.keys.length)return fail(400,'INVALID_APPLICANT_KEYS');
 if(input.operation==='scenario'){
  if(input.keys.length!==1||!['withdraw','revoke','phone','waitlist','confirmOnly','complete'].includes(input.scenario??''))return fail(400,'INVALID_SCENARIO');
  const a=find(input.keys[0]);if(!a)return fail(404,'APPLICANT_NOT_FOUND');
  if(input.scenario==='complete'&&(eligibilityCode(a,input.eventId)!=='OK'||!this.requests.some(r=>applicantKey(r.key)===applicantKey(a)&&r.status==='pending'&&Date.parse(r.expiresAt)>Date.parse(now))))return fail(409,'NO_VALID_PENDING_REQUEST');
  if(input.scenario==='withdraw')a.status='withdrawn';if(input.scenario==='revoke')a.selectionRevoked=!a.selectionRevoked;
  if(input.scenario==='phone')a.phone=null;if(input.scenario==='waitlist')a.status='waitlisted';if(input.scenario==='confirmOnly'){a.status='reviewing';a.confirmation='confirmed';}
  a.revision++;
  for(const r of this.requests.filter(r=>applicantKey(r.key)===applicantKey(a)&&r.status!=='completed')){
   if(input.scenario==='complete'&&r.status==='pending'){r.status='completed';r.completedAt=now;r.history.push(`${now} 가상 완료 시험 · 실제 PDF 없음`);}
   else if(eligibilityCode(a,input.eventId)!=='OK'||r.phoneSnapshot!==a.phone){r.status='cancelled';r.history.push(`${now} 가상 상태 변경 · 이전 접근 차단 필요`);}
  }
  return {http:200,body:{code:'SCENARIO_ONLY',requests:structuredClone(this.requests),applicant:{...a,phone:a.phone?'TEST-PHONE-AVAILABLE':null}}};
 }
 if(!Number.isInteger(input.days)||input.days!<1||input.days!>30||!input.idempotencyKey||!/^[a-zA-Z0-9-]{8,80}$/.test(input.idempotencyKey))return fail(400,'INVALID_EXPIRY_OR_IDEMPOTENCY');
 const document=['활동 동의서','이벤트 참가 확인서','운영 안내 확인서'].map((name,i)=>({id:`fixture-template-${i+1}`,name:`[가상] ${name}`,revision:1,status:'published'})).find(d=>d.id===input.documentId);
 if(!document)return fail(404,'DOCUMENT_NOT_FOUND');
 if(input.version!==document.revision||document.status!=='published')return fail(409,'VERSION_NOT_PUBLISHED');
 const payload=JSON.stringify(input),replayKey=`${actor.id}:${input.idempotencyKey}`,replay=this.replays.get(replayKey);
 if(replay){
  if(replay.payload!==payload)return fail(409,'IDEMPOTENCY_CONFLICT');
  const previous=replay.result as {requests:TargetRequest[];results:unknown};
  const current=previous.requests.map(old=>this.requests.find(r=>r.id===old.id)!);
  if(current.some(r=>{const a=find(r.key);return !a||r.status!=='pending'||Date.parse(r.expiresAt)<=Date.parse(now)||eligibilityCode(a,input.eventId)!=='OK';}))return fail(409,'REQUEST_NO_LONGER_VALID');
  return {http:200,body:{code:'IDEMPOTENT_REPLAY',result:{...previous,requests:structuredClone(current)}}};
 }
 if(this.requests.length>=200||this.replays.size>=200)return fail(429,'PREVIEW_CAPACITY');
 const results=input.keys.map(key=>{
  const a=find(key);let code=!a?'APPLICANT_NOT_FOUND':applicantKey(a)!==applicantKey(key)?'EVENT_MISMATCH':eligibilityCode(a,input.eventId);
  if(code==='OK'&&this.requests.some(r=>applicantKey(r.key)===applicantKey(key)&&r.document.id===input.documentId))code='DUPLICATE_REQUEST';
  return {key,code};
 });
 // Atomic preview batch: rejected members prevent the entire batch reservation.
 if(results.some(r=>r.code!=='OK'))return {http:422,body:{code:'VALIDATION_REJECTED',results}};
 const added=results.map(({key},i):TargetRequest=>{const a=find(key)!;return {id:`server-preview-${this.requests.length+i+1}`,key:{...key},name:a.name,document:{id:document.id,name:document.name,revision:document.revision},applicantStatus:a.status,phoneSnapshot:a.phone!,revisionSnapshot:a.revision,status:'pending',createdAt:now,expiresAt:new Date(Date.parse(now)+input.days!*86400000).toISOString(),completedAt:null,generation:1,history:[`${now} 테스트 서버 메모리 검증 예약 · DB 저장/링크 발급 없음`]};});
 this.requests.push(...added);const result={requests:structuredClone(added),results};this.replays.set(replayKey,{payload,result});return {http:200,body:{code:'VALIDATED_ONLY',result}};
 }
}
