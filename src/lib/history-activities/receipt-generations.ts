import 'server-only';
import type {FileReceipt,FinalizationJob,VerifiedFinalizationPorts} from './verified-finalization';
import {createVerifiedFinalization} from './verified-finalization';
import {createReceiptVerifiedFinalizer} from './server-receipts';
export type RecoverySnapshot={job:FinalizationJob;generation:number;receiptId:string;issuedAt:string;consumed:boolean;evidence:FileReceipt;visibilityVersion:number};
export type GenerationRequest={jobId:string;requestId:string;revision:number;generation:number;previousReceiptId:string;recoveryRequestId:string};
/** Trusted attestor transport, never browser-provided receipt/evidence. */
export interface GenerationPorts {
 finalization:VerifiedFinalizationPorts;
 state(jobId:string,requestId:string,actorId:string):Promise<RecoverySnapshot>;
 issue(evidence:FileReceipt,cas:{generation:number;previousReceiptId:string;revision:number;recoveryRequestId:string;visibilityVersion:number}):Promise<{id:string;seal:string;generation:number}>;
}
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
/** Explicit action only; never wired into automatic finalize retries. Does not copy,
 * delete, renew timestamps or commit. Restart discovers the current generation in DB.
 * A lost issuance response is uncertain, not permission to issue another generation. */
export function createReceiptGenerationRecovery(ports?:GenerationPorts){return {async revalidate(input:GenerationRequest,auth:{authorization:string|null;userSession:string}):Promise<{status:'disabled'|'blocked'|'manual_required'|'already_complete'|'issued';receipt?:{id:string;seal:string;generation:number}}>{
 if(!ports)return {status:'disabled'};
 try{
  if(!input||Object.keys(input).sort().join()!=='generation,jobId,previousReceiptId,recoveryRequestId,requestId,revision'||![input.jobId,input.requestId,input.previousReceiptId,input.recoveryRequestId].every(x=>typeof x==='string'&&uuid.test(x))||![input.revision,input.generation].every(x=>Number.isSafeInteger(x)&&x>=0&&x<Number.MAX_SAFE_INTEGER-1))return {status:'blocked'};
  const p=ports.finalization;
  const authorize=async()=>{if((await p.authenticate(auth.authorization)).status!=='verified')return null;return (await p.administrator(auth.userSession))?.actorId??null;};
  const actor=await authorize();if(!actor)return {status:'blocked'};
  const snapshot=JSON.parse(JSON.stringify(await ports.state(input.jobId,input.requestId,actor))) as RecoverySnapshot;
  const j=snapshot.job;
  if(j.id!==input.jobId||j.requestId!==input.requestId||j.actorId!==actor||j.state==='blocked')return {status:'blocked'};
  // Capture evidence from the existing real decoder/hash/readback path. All writes off.
  let evidence:FileReceipt|undefined;
  const result=await createVerifiedFinalization({...p,jobs:{...p.jobs,load:async()=>j,attest:async e=>{evidence=e;throw Error('readback captured');},commit:async()=>{throw Error('no commit');}},storage:{...p.storage,createFinal:async()=>{throw Error('recovery cannot create');}},checkpoint:undefined}).run({jobId:j.id,requestId:j.requestId},auth);
  if(await authorize()!==actor)return {status:'blocked'};
  const fresh=await ports.state(j.id,j.requestId,actor);
  if(JSON.stringify(snapshot)!==JSON.stringify(fresh))return {status:'blocked'};
  if(j.state==='complete')return {status:result.status==='already_complete'?'already_complete':'manual_required'};
  const age=Date.now()-Date.parse(snapshot.issuedAt);
  if(!evidence||JSON.stringify(evidence)!==JSON.stringify(snapshot.evidence)){
   // JSON key order is not evidence identity; compare the known contract fields below.
   if(!evidence||Object.keys(evidence).some(k=>evidence![k as keyof FileReceipt]!==snapshot.evidence[k as keyof FileReceipt]))return {status:'manual_required'};
  }
  if(!Number.isFinite(age)||age<=300000||snapshot.consumed||snapshot.generation!==input.generation||snapshot.receiptId!==input.previousReceiptId||j.revision!==input.revision||!Number.isSafeInteger(snapshot.visibilityVersion)||snapshot.visibilityVersion<0)return {status:'blocked'};
  if(await authorize()!==actor)return {status:'blocked'};
  const receipt=await ports.issue(evidence,{generation:input.generation,previousReceiptId:input.previousReceiptId,revision:input.revision,recoveryRequestId:input.recoveryRequestId,visibilityVersion:snapshot.visibilityVersion});
  if(receipt.generation!==input.generation+1||!uuid.test(receipt.id)||!/^[a-f0-9]{64}$/.test(receipt.seal))return {status:'manual_required'};
  return {status:'issued',receipt};
 }catch{return {status:'manual_required'};}
}};}

/** Explicit resume of an already issued generation. The attestation port reads the
 * durable receipt, it never issues a generation or calls the original issuer. */
export function createGenerationFinalizer(ports:GenerationPorts,receipts:import('./server-receipts').ReceiptResolverPorts['source']){
 const p=ports.finalization;
 return createReceiptVerifiedFinalizer({...p,jobs:{...p.jobs,attest:async e=>{
  const s=await ports.state(e.jobId,e.requestId,e.actorId);
  const seal=(s as RecoverySnapshot&{seal?:string}).seal;
  if(s.generation<1||s.consumed||!seal||Object.keys(e).some(k=>e[k as keyof FileReceipt]!==s.evidence[k as keyof FileReceipt]))throw Error('Generation evidence unavailable');
  return {id:s.receiptId,seal};
 }}},receipts);
}
