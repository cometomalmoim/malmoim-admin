import 'server-only';
import {createHash} from 'node:crypto';
import type {FileReceipt,FinalizationJob,FinalizationCommit,VerifiedFinalizationPorts} from './verified-finalization';
import {createVerifiedFinalization} from './verified-finalization';
import type {OidcDecision} from './broker-oidc';
import type {WorkerAdapters} from './server-db';
export type StoredReceipt={issuer:'photo_finish_v2.attest'|'photo_finish_v2.revalidate_generation';receiptId:string;seal:string;issuedAt:string;checkedAt:string;consumed:boolean;evidence:FileReceipt;job:FinalizationJob};
export interface ReceiptResolverPorts {
 /** Authenticated attestor connection, fixed lookup_receipt RPC only. Never browser input. */
 source:{read(command:FinalizationCommit,actorId:string):Promise<StoredReceipt|null>};
 workload():Promise<OidcDecision>;
 administrator():Promise<{actorId:string}|null>;
 readFinal(job:FinalizationJob,path:string):Promise<Uint8Array|null>;
 decode(bytes:Uint8Array):Promise<{mime:string}>;
}
const id=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
function valid(c:FinalizationCommit,r:StoredReceipt,actor:string){
 const e=r.evidence,j=r.job,ext={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[e?.mime];
 const issued=Date.parse(r.issuedAt),checked=Date.parse(r.checkedAt),now=Date.now();
 return Object.keys(c).sort().join()==='jobId,receiptId,requestId,revision,seal'&&[c.jobId,c.receiptId,c.requestId].every(v=>typeof v==='string'&&id.test(v))&&Number.isSafeInteger(c.revision)&&c.revision>=0&&c.revision<Number.MAX_SAFE_INTEGER&&['photo_finish_v2.attest','photo_finish_v2.revalidate_generation'].includes(r.issuer)&&r.consumed===false&&r.receiptId===c.receiptId&&r.seal===c.seal&&/^[a-f0-9]{64}$/.test(r.seal)&&Number.isFinite(issued)&&Number.isFinite(checked)&&issued<=checked&&checked-issued<=300000&&issued<=now&&now-issued<=300000&&checked<=now&&now-checked<=10000&&
 !!ext&&!!j&&j.state==='pending'&&j.actorId===actor&&j.id===c.jobId&&j.requestId===c.requestId&&j.revision===c.revision&&e.jobId===j.id&&e.requestId===j.requestId&&e.actorId===actor&&e.photoId===j.photoId&&e.activityId===j.activityId&&[e.photoId,e.activityId,actor].every(v=>id.test(v))&&e.revision===j.revision&&e.epoch===j.epoch&&Number.isSafeInteger(e.epoch)&&e.epoch>=0&&e.mime===j.mime&&e.size===j.size&&Number.isSafeInteger(e.size)&&e.size>0&&e.size<=4718592&&e.basis==='immutable-final-readback'&&/^[a-f0-9]{64}$/.test(e.digest)&&e.tempPath===j.tempPath&&e.tempPath===`${e.activityId}/${e.photoId}.${ext}`&&e.finalPath===`${e.activityId}/${e.photoId}/${e.digest}.${ext}`;
}
export function createServerReceiptResolver(ports?:ReceiptResolverPorts):WorkerAdapters['receipts']{
 return {async resolve(input,actor){
  if(!ports)return null;
  try{
   const c=Object.freeze({...input});const authorized=async()=>(await ports.workload()).status==='verified'&&(await ports.administrator())?.actorId===actor;
   if(!await authorized())return null;
   const raw=await ports.source.read(c,actor);if(!raw)return null;
   // Snapshot trusted DB response before awaiting external file IO.
   const r=JSON.parse(JSON.stringify(raw)) as StoredReceipt;if(!valid(c,r,actor))return null;
   const bytes=await ports.readFinal(r.job,r.evidence.finalPath);
   if(!bytes||bytes.byteLength!==r.evidence.size||createHash('sha256').update(bytes).digest('hex')!==r.evidence.digest||(await ports.decode(bytes)).mime!==r.evidence.mime)return null;
   if(!await authorized())return null;
   const fresh=await ports.source.read(c,actor);if(!fresh||!valid(c,fresh,actor))return null;
   const stable=(x:StoredReceipt)=>JSON.stringify([x.issuer,x.receiptId,x.seal,x.issuedAt,x.consumed,x.evidence,x.job]);
   if(stable(r)!==stable(fresh))return null;
   return {command:c,evidence:r.evidence};
  }catch{return null;}
 }};
}
/** Existing file validator and issuer are unchanged; only receipt consumption is gated.
 * Construct per request to avoid shared administrator/workload authentication context. */
export function createReceiptVerifiedFinalizer(ports:VerifiedFinalizationPorts,source:ReceiptResolverPorts['source']){
 return {async run(input:unknown,auth:{authorization:string|null;userSession:string}){
  const receipts=createServerReceiptResolver({source,workload:()=>ports.authenticate(auth.authorization),administrator:()=>ports.administrator(auth.userSession),readFinal:(j,p)=>ports.storage.readFinal(j,p),decode:ports.decode});
  return createVerifiedFinalization({...ports,jobs:{...ports.jobs,commit:async c=>{const recovery=await createPendingReceiptRecovery(ports,source).inspect(c,auth);if(recovery.status!=='ready_to_resume')throw Error('Explicit recovery verification required');const actor=await ports.administrator(auth.userSession);if(!actor||!await receipts.resolve(c,actor.actorId))throw Error('Receipt verification unavailable');await ports.jobs.commit(c);}}}).run(input,auth);
 }};
}

/** Explicit recovery only. No receipt issuance, timestamp reset, file creation or deletion.
 * An unavailable lookup may mean expiry, consumption or outage: never guess which.
 * The current UNIQUE(job) receipt contract cannot safely renew expired receipts. */
export function createPendingReceiptRecovery(ports?:VerifiedFinalizationPorts,source?:ReceiptResolverPorts['source']){
 return {async inspect(command:FinalizationCommit,auth:{authorization:string|null;userSession:string}):Promise<{status:'disabled'|'blocked'|'manual_required'|'already_complete'|'ready_to_resume';reason:string}>{
  if(!ports||!source)return {status:'disabled',reason:'recovery_not_connected'};
  try{
   if(!command||Object.keys(command).sort().join()!=='jobId,receiptId,requestId,revision,seal'||![command.jobId,command.requestId,command.receiptId].every(v=>typeof v==='string'&&id.test(v))||!Number.isSafeInteger(command.revision)||command.revision<0)return {status:'blocked',reason:'invalid_request'};
   const authorize=async()=>{if((await ports.authenticate(auth.authorization)).status!=='verified')return null;return (await ports.administrator(auth.userSession))?.actorId??null;};
   const actor=await authorize();if(!actor)return {status:'blocked',reason:'authorization_failed'};
   const job=await ports.jobs.load(command.jobId,actor);
   if(job.id!==command.jobId||job.requestId!==command.requestId||job.actorId!==actor||job.state==='blocked')return {status:'blocked',reason:'job_not_authorized'};
   // Reuse the existing full decoder/hash/path validation, but remove every write port.
   // Pending inspection deliberately stops before attestation, even for a valid file.
   let fileVerified=false;
   const result=await createVerifiedFinalization({...ports,jobs:{...ports.jobs,attest:async()=>{throw Error('inspection only');},commit:async()=>{throw Error('inspection only');}},storage:{...ports.storage,createFinal:async()=>{throw Error('inspection cannot create');}},checkpoint:async stage=>{if(stage==='final_readback'){fileVerified=true;throw Error('inspection complete');}}}).run({jobId:command.jobId,requestId:command.requestId},auth);
   if(await authorize()!==actor)return {status:'blocked',reason:'authorization_changed'};
   const fresh=await ports.jobs.load(command.jobId,actor);
   if(JSON.stringify(job)!==JSON.stringify(fresh))return {status:'manual_required',reason:'job_changed_during_check'};
   if(job.state==='complete')return result.status==='already_complete'?{status:'already_complete',reason:'immutable_file_revalidated'}:{status:'manual_required',reason:'completed_file_mismatch'};
   if(!fileVerified)return {status:'manual_required',reason:'pending_file_mismatch_or_missing'};
   if(job.revision!==command.revision)return {status:'blocked',reason:'revision_conflict'};
   const resolver=createServerReceiptResolver({source,workload:()=>ports.authenticate(auth.authorization),administrator:()=>ports.administrator(auth.userSession),readFinal:ports.storage.readFinal,decode:ports.decode});
   if(!await resolver.resolve(command,actor))return {status:'manual_required',reason:'receipt_expired_consumed_missing_or_unverifiable'};
   // Resolver independently re-downloads the final object and rechecks the DB receipt.
   return {status:'ready_to_resume',reason:'fresh_receipt_and_file_verified'};
  }catch{return {status:'manual_required',reason:'verification_unavailable'};}
 }};
}
