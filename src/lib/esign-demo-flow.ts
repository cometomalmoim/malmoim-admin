import { randomBytes,createHash,timingSafeEqual } from 'node:crypto';
import type { RequestRepository } from './esign-request-repository.ts';
import type { StoredPreviewService } from './esign-request-service.ts';
import {createDemoDocument,completeDemoPdf,type DemoDocument} from './esign-demo-pdf.ts';
import {requireSigningReady,type ConsentAnswers,type Ink} from './pdf-signing.ts';
export class DemoError extends Error{status:number;constructor(code:string,status=409){super(code);this.status=status;}}
type Entry={requestId:string;code:string;document?:DemoDocument;documentTask?:Promise<DemoDocument>;session?:string;sessionExpires?:number;phase:'waiting'|'verified'|'signing'|'completed';pdf?:Uint8Array;receipt?:{key:string;hash:string}};
export class DemoFlow{
 private links=new Map<string,Entry>();private queue:Promise<unknown>=Promise.resolve();
 constructor(repository:RequestRepository,service:StoredPreviewService,actor:string){this.repo=repository;this.service=service;this.actor=actor;}
 private repo:RequestRepository;private service:StoredPreviewService;private actor:string;
 private async row(e:Entry,now:number){
  const row=await this.repo.get(e.requestId,['preview-event-1','preview-event-2']);if(!row)throw new DemoError('REQUEST_NOT_FOUND',404);
  await this.service.execute(this.actor,{operation:'list',eventId:row.key.event_id},new Date(now).toISOString());
  const current=(await this.repo.get(row.id,[row.key.event_id]))!;
  if(!['pending','completed'].includes(current.status))throw new DemoError(current.status==='expired'?'REQUEST_EXPIRED':'REQUEST_CANCELLED',410);
  if(current.status==='pending'&&this.service.demoEligibility(current.key)!=='OK')throw new DemoError('ELIGIBILITY_REVOKED',410);
  return current;
 }
 async issue(requestId:string,eventId:string){
  const task=this.queue.then(async()=>{
  const row=await this.repo.get(requestId,[eventId]);if(!row)throw new DemoError('REQUEST_NOT_FOUND',404);
  const old=[...this.links].find(([,e])=>e.requestId===requestId);
  if(old){await this.row(old[1],Date.now());return {token:old[0],code:old[1].code};}
  if(row.status==='completed')throw new DemoError('COMPLETED_WITHOUT_DEMO_PDF');
  if(this.links.size>=100)throw new DemoError('DEMO_CAPACITY',429);
  const e:Entry={requestId,code:`DEMO-${randomBytes(4).toString('hex')}`,phase:'waiting'};await this.row(e,Date.now());
  const token=randomBytes(32).toString('hex');this.links.set(token,e);return {token,code:e.code};
  });this.queue=task.catch(()=>undefined);return task;
 }
 async summary(requestId:string){const e=[...this.links.values()].find(e=>e.requestId===requestId);return {phase:e?.phase??'waiting',hasPdf:!!e?.pdf};}
 async adminPdf(requestId:string){const e=[...this.links.values()].find(e=>e.requestId===requestId);if(!e?.pdf)throw new DemoError('PDF_NOT_READY',404);await this.row(e,Date.now());return e.pdf.slice();}
 async action(token:string,session:string|null,body:{operation:string;code?:string;name?:string;read?:boolean;confirmed?:boolean;answers?:ConsentAnswers;ink?:Ink;idempotencyKey?:string},now=Date.now()){
  const task=this.queue.then(async()=>{
   const e=this.links.get(token);if(!e)throw new DemoError('LINK_NOT_FOUND_OR_SERVER_RESTARTED',404);
   const row=await this.row(e,now);
   if(body.operation==='verify'){
    const expected=Buffer.from(e.code),actual=Buffer.from(body.code??'');if(expected.length!==actual.length||!timingSafeEqual(expected,actual))throw new DemoError('DEMO_CODE_INVALID',401);
    e.session=randomBytes(32).toString('hex');e.sessionExpires=now+30*60*1000;if(e.phase!=='completed')e.phase='verified';return {session:e.session,name:row.name,phase:e.phase,expiresAt:row.expiresAt};
   }
   if(!session||session!==e.session||!e.sessionExpires||e.sessionExpires<=now)throw new DemoError('DEMO_VERIFICATION_REQUIRED',401);
   if(body.operation==='status')return {name:row.name,phase:e.phase,hasPdf:!!e.pdf,expiresAt:row.expiresAt};
   if(body.operation==='pdf'){if(!e.pdf)throw new DemoError('PDF_NOT_READY',404);return e.pdf.slice();}
   if(body.operation==='document'){
    if(!e.document){e.documentTask??=createDemoDocument();try{e.document=await e.documentTask;}catch(error){e.documentTask=undefined;throw error;}}
    if(e.phase!=='completed')e.phase='signing';return e.document.bytes.slice();
   }
   if(body.operation!=='submit')throw new DemoError('INVALID_OPERATION',400);
   if(!body.idempotencyKey||!/^[a-zA-Z0-9-]{8,80}$/.test(body.idempotencyKey))throw new DemoError('INVALID_IDEMPOTENCY',400);
   const hash=createHash('sha256').update(JSON.stringify({name:body.name,answers:body.answers,ink:body.ink,read:body.read,confirmed:body.confirmed})).digest('hex');
   if(e.receipt){if(e.receipt.key===body.idempotencyKey&&e.receipt.hash===hash)return {code:'IDEMPOTENT_COMPLETION',phase:'completed'};throw new DemoError('ALREADY_COMPLETED');}
   if(row.status==='completed')throw new DemoError('ALREADY_COMPLETED_WITHOUT_DEMO_PDF');
   if(body.name!==row.name||body.read!==true||body.confirmed!==true||!body.answers||!body.ink||!e.document)throw new DemoError('FINAL_CONFIRMATION_REQUIRED',422);
   try{requireSigningReady(body.answers,body.ink,e.document.settings.fields,body.read);}catch(error){throw new DemoError(error instanceof Error?error.message:'INVALID_SIGNATURE',422);}
   const bytes=await completeDemoPdf(e.document,row.name,row.id,body.answers,body.ink,new Date(now).toISOString());
   // Recheck after asynchronous generation, then atomically mark complete; cancel wins.
   await this.row(e,Date.now());
   await this.repo.transaction(tx=>{const current=tx.get(row.id);if(!current||current.status!=='pending'||Date.parse(current.expiresAt)<=Date.now())throw new DemoError('REQUEST_NO_LONGER_PENDING',410);
    current.status='completed';current.completedAt=new Date(now).toISOString();current.history.push(`${current.completedAt} 개발 참가자 제출 완료 · 테스트 PDF 서버 메모리 보관`);tx.save(current);
   });
   e.pdf=bytes;e.phase='completed';e.receipt={key:body.idempotencyKey,hash};return {code:'DEMO_COMPLETED_IN_MEMORY',phase:e.phase};
  });this.queue=task.catch(()=>undefined);return task;
 }
}
