import 'server-only';
import {randomUUID,createHash} from 'node:crypto';
import {EsignApplicantReader,type EsignSnapshotSource} from './esign-applicant-reader.ts';
import {normalizeApplicantKey,signingEligibility,type AdminSessionAdapter} from './esign-server-contracts.ts';
import {MemoryRequestRepository} from './esign-request-repository.ts';
import {SigningParticipantAuth,MemorySigningAuthStore,signingAuthBinding,type SigningAuthRequest,type SigningOtpProvider} from './esign-participant-auth.ts';
import {EsignPdfStorage,type CompletedPdfRequest,type PrivatePdfTransport} from './esign-pdf-storage.ts';
import {createDemoDocument,completeDemoPdf,type DemoDocument} from './esign-demo-pdf.ts';
import {requireSigningReady,type ConsentAnswers,type Ink} from './pdf-signing.ts';
import {applicantKey,type ApplicantKey,type TargetRequest} from './signing-targets.ts';
export type TestEvent={id:string;archived:boolean;revision:number};
export type IntegratedSubmission={name:string;read:boolean;confirmed:boolean;answers:ConsentAnswers;ink:Ink};
type Job={document:DemoDocument;eventRevision:number;participationRevision:number|null;archiveRevision:number;operation:string;submissionId?:string;payload?:IntegratedSubmission;payloadHash?:string;bytes?:Uint8Array;receipt?:CompletedPdfRequest;phase:'pending'|'processing'|'retry'|'completed';error?:string};
export type IntegrationDependencies={source:EsignSnapshotSource;event:(id:string)=>Promise<TestEvent|undefined>;admin:AdminSessionAdapter;otp:SigningOtpProvider;transport:PrivatePdfTransport;clock?:()=>number;render?:typeof completeDemoPdf};
const hash=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex');
const template={id:'55555555-5555-4555-8555-555555555555',name:'개발 전용 테스트 동의서',revision:1};
/** Isolated orchestration harness, not an operating API or persistent transaction. */
export class OfflineEsignIntegration{
 private repo=new MemoryRequestRepository();private jobs=new Map<string,Job>();private staged=new Map<string,{operation:string;payload:IntegratedSubmission;hash:string}>();private queue:Promise<unknown>=Promise.resolve();private operations=new Map<string,string>();
 private reader:EsignApplicantReader;private auth:SigningParticipantAuth;private storage:EsignPdfStorage;private deps:IntegrationDependencies;private clock:()=>number;
 constructor(deps:IntegrationDependencies){
  if(!['test','development'].includes(process.env.NODE_ENV??''))throw new Error('DEVELOPMENT_ONLY');
  this.deps=deps;this.clock=deps.clock??Date.now;this.reader=new EsignApplicantReader(deps.source);
  this.auth=new SigningParticipantAuth({current:id=>this.authRequest(id),commitSubmission:(id,binding,operation,payload)=>this.accept(id,binding,operation,payload)},deps.otp,new MemorySigningAuthStore(),deps.admin,this.clock);
  this.storage=new EsignPdfStorage({get:id=>this.receipt(id)},deps.transport,deps.admin);
 }
 private serial<T>(work:()=>Promise<T>){const p=this.queue.then(work);this.queue=p.catch(()=>undefined);return p;}
 private async authority(eventId:string){const actor=await this.deps.admin.currentAdmin();if(!actor||!actor.eventIds.includes(eventId))throw new Error('ADMIN_EVENT_DENIED');return actor;}
 private async target(key:ApplicantKey){
  const event=await this.deps.event(key.event_id);
  if(!event||event.id!==key.event_id||typeof event.archived!=='boolean'||!Number.isSafeInteger(event.revision)||event.revision<0)throw new Error('EVENT_STATE_UNKNOWN');
  if(event.archived)throw new Error('EVENT_ARCHIVED');
  const a=await this.reader.find(key);if(!a)throw new Error('APPLICANT_NOT_FOUND');const code=signingEligibility(a,key.event_id,true);if(code!=='OK')throw new Error(code);
  return{a,event};
 }
 // Repository scopes use concrete event IDs; resolve only IDs owned by this harness.
 private async row(id:string){const job=this.jobs.get(id);if(!job)throw new Error('REQUEST_NOT_FOUND');const rows=await this.repo.list(this.eventIds);const r=rows.find(r=>r.id===id);if(!r)throw new Error('REQUEST_NOT_FOUND');return{r,job};}
 private eventIds:string[]=[];
 private async active(id:string){
  const {r,job}=await this.row(id);if(r.status!=='pending'||Date.parse(r.expiresAt)<=this.clock())throw new Error('REQUEST_INACTIVE');
  const {a,event}=await this.target(r.key);
  if(a.phone!==r.phoneSnapshot||a.revision!==r.revisionSnapshot||a.participationRevision!==job.participationRevision||a.archiveRevision!==job.archiveRevision||event.revision!==job.eventRevision)throw new Error('REQUEST_CONTEXT_CHANGED');
  return{r,job,a};
 }
 async create(input:ApplicantKey,operation:string){return this.serial(async()=>{
  const key=normalizeApplicantKey(input);if(!/^[a-zA-Z0-9-]{8,80}$/.test(operation))throw new Error('INVALID_OPERATION_ID');
  await this.authority(key.event_id);const {a,event}=await this.target(key);
  if(this.operations.has(operation)&&this.operations.get(operation)!==applicantKey(key))throw new Error('IDEMPOTENCY_CONFLICT');
  const old=(await this.repo.list([key.event_id])).find(r=>applicantKey(r.key)===applicantKey(key)&&r.document.id===template.id);
  if(old){const job=this.jobs.get(old.id)!;if(job.operation!==operation)throw new Error('DUPLICATE_REQUEST');return{id:old.id,status:old.status};}
  const document=await createDemoDocument();await this.authority(key.event_id);const latest=await this.target(key);
  if(JSON.stringify(latest)!==JSON.stringify({a,event}))throw new Error('REQUEST_CONTEXT_CHANGED');
  const id=randomUUID(),at=new Date(this.clock()).toISOString();
  const r:TargetRequest={id,key,name:a.name,document:template,applicantStatus:a.status,phoneSnapshot:a.phone!,revisionSnapshot:a.revision,status:'pending',createdAt:at,expiresAt:new Date(this.clock()+86400000).toISOString(),completedAt:null,generation:1,history:[`${at} offline request created`]};
  await this.repo.transaction(tx=>tx.save(r));this.operations.set(operation,applicantKey(key));this.jobs.set(id,{document,eventRevision:event.revision,participationRevision:a.participationRevision,archiveRevision:a.archiveRevision,operation,phase:'pending'});if(!this.eventIds.includes(key.event_id))this.eventIds.push(key.event_id);
  return{id,status:'pending'};
 });}
 private async authRequest(id:string):Promise<SigningAuthRequest|undefined>{
  try{const {r,job}=await this.active(id);return{id:r.id,key:r.key,status:job.phase==='pending'?'pending':'processing',expiresAt:r.expiresAt,generation:r.generation,revision:r.revisionSnapshot,phone:r.phoneSnapshot};}catch{return undefined;}
 }
 async issue(id:string){const {r}=await this.active(id);await this.authority(r.key.event_id);return this.auth.issue(id);}
 async reissue(id:string){const {r}=await this.active(id);await this.authority(r.key.event_id);return this.auth.issue(id,true);}
 sendOtp(token:string){return this.auth.sendOtp(token);}
 verify(token:string,code:string){return this.auth.verify(token,code);}
 async participantOriginal(id:string,session:string){await this.auth.authorize(id,session);const {job}=await this.row(id);return job.document.bytes.slice();}
 async original(id:string){const {r,job}=await this.row(id);await this.authority(r.key.event_id);return job.document.bytes.slice();}
 private async accept(id:string,binding:string,operation:string,payloadHash:string){
  const current=await this.authRequest(id),staged=this.staged.get(id);if(!current||signingAuthBinding(current)!==binding||!staged||staged.operation!==operation||staged.hash!==payloadHash)return false;
  const {r,job}=await this.active(id);await this.authority(r.key.event_id);
  // Process-only admission. Real integration requires one RPC for latest-state CAS and receipt.
  job.payload=structuredClone(staged.payload);job.payloadHash=payloadHash;job.submissionId=randomUUID();job.phase='processing';return true;
 }
 async submit(id:string,session:string,operation:string,input:IntegratedSubmission){return this.serial(async()=>{
  const {r,job}=await this.active(id);await this.authority(r.key.event_id);
  const payload=structuredClone(input);if(payload.name!==r.name||payload.confirmed!==true)throw new Error('FINAL_CONFIRMATION_REQUIRED');requireSigningReady(payload.answers,payload.ink,job.document.settings.fields,payload.read);
  const payloadHash=hash(JSON.stringify(payload));this.staged.set(id,{operation,payload,hash:payloadHash});
  try{await this.auth.submit(id,session,operation,payloadHash);}finally{this.staged.delete(id);}
  return this.finish(id);
 });}
 private async receipt(id:string):Promise<CompletedPdfRequest|undefined>{
  const {r,job}=await this.row(id);if(!job.receipt)return undefined;
  if(r.status!=='completed'){await this.active(id);await this.authority(r.key.event_id);}return structuredClone(job.receipt);
 }
 private async finish(id:string){
  const {r,job}=await this.active(id);if(!job.payload||!job.submissionId)throw new Error('SUBMISSION_NOT_ACCEPTED');
  try{
   await this.authority(r.key.event_id);
   if(!job.bytes){const at=new Date(this.clock()).toISOString();job.bytes=await (this.deps.render??completeDemoPdf)(job.document,r.name,r.id,job.payload.answers,job.payload.ink,at);job.receipt={id:r.id,key:r.key,submissionId:job.submissionId,status:'completed',completedAt:at,sha256:hash(job.bytes),pageCount:2};}
   await this.active(id);await this.authority(r.key.event_id);await this.storage.save(id,job.bytes);
   await this.active(id);await this.authority(r.key.event_id);
   await this.repo.transaction(tx=>{const latest=tx.get(id);if(!latest||latest.status!=='pending'||Date.parse(latest.expiresAt)<=this.clock())throw new Error('REQUEST_INACTIVE');latest.status='completed';latest.completedAt=job.receipt!.completedAt;latest.history.push(`${latest.completedAt} offline PDF storage confirmed`);tx.save(latest);});
   job.phase='completed';job.error=undefined;return{code:'COMPLETED_IN_MEMORY'};
  }catch{job.phase='retry';job.error='PDF_PROCESSING_RETRY_REQUIRED';throw new Error(job.error);}
 }
 async retry(id:string){return this.serial(async()=>{const {r,job}=await this.row(id);await this.authority(r.key.event_id);if(job.phase==='completed')return{code:'COMPLETED_IN_MEMORY'};return this.finish(id);});}
 async cancel(id:string){const {r,job}=await this.row(id);await this.authority(r.key.event_id);await this.repo.transaction(tx=>{const current=tx.get(id)!;if(current.status==='completed')throw new Error('COMPLETED_IMMUTABLE');if(current.status!=='cancelled'){current.status='cancelled';current.history.push('offline cancelled');tx.save(current);}});job.error='REQUEST_CANCELLED';}
 async status(id:string){const {r,job}=await this.row(id);await this.authority(r.key.event_id);return{id,status:r.status==='pending'&&Date.parse(r.expiresAt)<=this.clock()?'expired':r.status==='pending'?job.phase:r.status,error:job.error,history:[...r.history]};}
 async download(id:string){const {r}=await this.row(id);await this.authority(r.key.event_id);if(r.status!=='completed')throw new Error('PDF_NOT_READY');return this.storage.download(id);}
}
