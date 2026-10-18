import { PreviewService, fixtureAuth, eligibilityCode, type PreviewCommand } from './esign-preview-server.ts';
import { applicantKey, type ApplicantKey } from './signing-targets.ts';
import { type RequestRepository, reissueDecision } from './esign-request-repository.ts';
export type StoredCommand=Omit<PreviewCommand,'operation'>&{operation:PreviewCommand['operation']|'list'|'detail'|'expire'};
// Authentication and validation remain server-side; the repository owns request rows.
export class StoredPreviewService {
 private validator=new PreviewService();
 constructor(privateRepository:RequestRepository){this.repository=privateRepository;}
 private repository:RequestRepository;
 demoEligibility(key:ApplicantKey){const a=this.validator.applicants.find(a=>applicantKey(a)===applicantKey(key));return a?eligibilityCode(a,key.event_id):'APPLICANT_NOT_FOUND';}
 async execute(credential:string|null,input:StoredCommand,now=new Date().toISOString()){
  const actor=fixtureAuth.authenticate(credential);
  if(!actor)return {http:401,body:{code:'UNAUTHENTICATED'}};
  if(!actor.events.includes(input.eventId))return {http:403,body:{code:'EVENT_FORBIDDEN'}};
  return this.repository.transaction(async tx=>{
   // Expiry is evaluated with server time on every operation, including list.
   for(const row of tx.list())if(row.status==='pending'&&Date.parse(row.expiresAt)<=Date.parse(now)){row.status='expired';row.history.push(`${now} 서버 만료 처리 · 실제 링크 없음`);tx.save(row);}
   const rows=tx.list().filter(r=>r.key.event_id===input.eventId);
   if(input.operation==='list')return {http:200,body:{code:'MEMORY_REQUESTS',requests:rows}};
   if(input.operation==='detail'){
    const row=rows.find(r=>r.id===input.requestId);return row?{http:200,body:{code:'MEMORY_REQUEST',request:row,reissue:reissueDecision(row)}}:{http:404,body:{code:'REQUEST_NOT_FOUND'}};
   }
   if(input.operation==='cancel'&&rows.find(r=>r.id===input.requestId)?.status==='cancelled')return {http:200,body:{code:'CANCELLED',request:rows.find(r=>r.id===input.requestId)}};
   if(input.operation==='expire'){
    const row=rows.find(r=>r.id===input.requestId);if(!row)return {http:404,body:{code:'REQUEST_NOT_FOUND'}};
    if(row.status==='cancelled')return {http:409,body:{code:'REQUEST_CANCELLED'}};
    if(row.status==='completed')return {http:409,body:{code:'COMPLETED_IMMUTABLE'}};
    if(row.status==='pending'){row.status='expired';row.history.push(`${now} 관리자 만료 시험 · 실제 링크 없음`);tx.save(row);}
    return {http:200,body:{code:'EXPIRED',request:row}};
   }
   const replayKey=`${actor.id}:${input.idempotencyKey}`;
   if(input.operation==='validate'){
    const previous=tx.replay(replayKey);
    if(previous){
     if(previous.payload!==JSON.stringify(input))return {http:409,body:{code:'IDEMPOTENCY_CONFLICT'}};
     const requests=previous.ids.map(id=>tx.get(id)!);
     if(requests.some(r=>!r||r.status!=='pending'))return {http:409,body:{code:'REQUEST_NO_LONGER_VALID'}};
     return {http:200,body:{code:'IDEMPOTENT_REPLAY',result:{requests}}};
    }
   }
   const validator=new PreviewService();
   validator.applicants=structuredClone(this.validator.applicants);
   validator.requests=tx.list();
   const result=validator.execute(credential,input as PreviewCommand,now);
   if(result.http===200){
    for(const row of validator.requests)tx.save(row);
    this.validator.applicants=validator.applicants;
    if(input.operation==='validate'){
     const added=(result.body.result as {requests:{id:string}[]}).requests;
     tx.remember(replayKey,{payload:JSON.stringify(input),ids:added.map(r=>r.id)});
    }
   }
   return result;
  });
 }
}
