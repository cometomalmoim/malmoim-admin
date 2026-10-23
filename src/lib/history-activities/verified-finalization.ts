import 'server-only';
import {createHash} from 'node:crypto';
import {activityPhotoPolicy} from './photo-policy';
import type {OidcDecision} from './broker-oidc';
export type FinalizationJob={id:string;requestId:string;activityId:string;photoId:string;actorId:string;revision:number;epoch:number;tempPath:string;size:number;mime:'image/png'|'image/jpeg'|'image/webp';state:'pending'|'complete'|'blocked';digest:string|null;finalPath:string|null};
export type FileReceipt={jobId:string;requestId:string;activityId:string;photoId:string;actorId:string;revision:number;epoch:number;tempPath:string;finalPath:string;size:number;mime:string;digest:string;basis:'immutable-final-readback'};
export type FinalizationCommit={jobId:string;requestId:string;revision:number;receiptId:string;seal:string};
export interface VerifiedFinalizationPorts {
 authenticate(header:string|null):Promise<OidcDecision>;
 administrator(session:string):Promise<{actorId:string}|null>;
 jobs:{load(jobId:string,actorId:string):Promise<FinalizationJob>;attest(receipt:FileReceipt):Promise<{id:string;seal:string}>;commit(input:FinalizationCommit):Promise<void>};
 /** Trusted scoped adapter only: exact paths, no list/update/delete/upsert API.
  * Read returns null only for confirmed absence, errors/timeout must throw.
  * createFinal is INSERT-only and must not overwrite on retry or collision. */
 storage:{readTemp(job:FinalizationJob):Promise<Uint8Array>;readFinal(job:FinalizationJob,path:string):Promise<Uint8Array|null>;createFinal(job:FinalizationJob,path:string,bytes:Uint8Array,mime:string):Promise<void>};
 /** Real bounded image decoder, not MIME sniffing/metadata from a browser. */
 decode(bytes:Uint8Array):Promise<{mime:string}>;
 /** Test-only fault injection; never obtained from HTTP payload. */
 checkpoint?(stage:'final_readback'|'attested'|'committed'):Promise<void>;
}
class FinalizationDenied extends Error {}
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const digest=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
function valid(j:FinalizationJob){const ext={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[j.mime];return ext&&[j.id,j.requestId,j.activityId,j.photoId,j.actorId].every(v=>uuid.test(v))&&Number.isSafeInteger(j.revision)&&j.revision>=0&&Number.isSafeInteger(j.epoch)&&j.epoch>=0&&Number.isSafeInteger(j.size)&&j.size>0&&j.size<=activityPhotoPolicy.maxBytes&&j.tempPath===`${j.activityId}/${j.photoId}.${ext}`;}
/** No Route or production wiring. HTTP carries identifiers only, never evidence.
 * Default disabled. Authorization is rechecked before issuing/consuming evidence.
 * Final immutable bytes are completion basis; temporary upload termination is NOT proven. */
export function createVerifiedFinalization(ports?:VerifiedFinalizationPorts){
 return {async run(input:unknown,auth:{authorization:string|null;userSession:string}):Promise<{status:'disabled'|'denied'|'uncertain'|'recorded'|'already_complete'}>{
  if(!ports)return {status:'disabled'};
  try{
   if(!input||typeof input!=='object'||Object.keys(input).sort().join()!=='jobId,requestId')return {status:'denied'};
   const {jobId,requestId}=input as {jobId:string;requestId:string};if(!uuid.test(jobId)||!uuid.test(requestId))return {status:'denied'};
   const authorize=async()=>{const workload=await ports.authenticate(auth.authorization);if(workload.status==='unavailable')throw Error('identity unavailable');if(workload.status!=='verified')throw new FinalizationDenied('workload denied');const actor=await ports.administrator(auth.userSession);if(!actor||!uuid.test(actor.actorId))throw new FinalizationDenied('admin denied');return actor.actorId;};
   const actor=await authorize();const job=await ports.jobs.load(jobId,actor);
   if(!valid(job)||job.id!==jobId||job.requestId!==requestId||job.actorId!==actor||job.state==='blocked')return {status:'denied'};
   const bytes=await ports.storage.readTemp(job);if(bytes.byteLength!==job.size||(await ports.decode(bytes)).mime!==job.mime)return {status:'denied'};
   const hash=digest(bytes),ext={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[job.mime],finalPath=`${job.activityId}/${job.photoId}/${hash}.${ext}`;
   if(job.state==='complete'&&(job.digest!==hash||job.finalPath!==finalPath))return {status:'denied'};
   let final=await ports.storage.readFinal(job,finalPath);
   if(!final){if(job.state==='complete')return {status:'uncertain'};if(await authorize()!==actor)return {status:'denied'};
    // An ambiguous create is resolved only by independent immutable readback.
    try{await ports.storage.createFinal(job,finalPath,bytes,job.mime);}catch{/* Never assume failure or retransmit. */}
    final=await ports.storage.readFinal(job,finalPath);
   }
   if(!final||final.byteLength!==job.size||digest(final)!==hash||(await ports.decode(final)).mime!==job.mime)return {status:'uncertain'};
   if(await authorize()!==actor)return {status:'denied'};
   if(job.state==='complete')return {status:'already_complete'};
   await ports.checkpoint?.('final_readback');
   const receipt=await ports.jobs.attest({jobId,requestId,activityId:job.activityId,photoId:job.photoId,actorId:actor,revision:job.revision,epoch:job.epoch,tempPath:job.tempPath,finalPath,size:job.size,mime:job.mime,digest:hash,basis:'immutable-final-readback'});
   await ports.checkpoint?.('attested');
   if(await authorize()!==actor)return {status:'denied'};
   await ports.jobs.commit({jobId,requestId,revision:job.revision,receiptId:receipt.id,seal:receipt.seal});
   await ports.checkpoint?.('committed');return {status:'recorded'};
  }catch(error){return {status:error instanceof FinalizationDenied?'denied':'uncertain'};}
 }};
}
