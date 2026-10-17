// Offline integration preparation only. No Supabase or network imports.
import {createHash} from 'node:crypto';
import {applicantKey,type ApplicantKey,type TargetRequest} from './signing-targets.ts';
import {normalizeApplicantKey,type ApplicantSnapshot,type EsignApplicantReader} from './esign-server-contracts.ts';

export class OfflineApplicantAdapter implements EsignApplicantReader{
 private rows=new Map<string,ApplicantSnapshot>();
 constructor(rows:ApplicantSnapshot[]){for(const row of rows)this.replace(row);}
 replace(row:ApplicantSnapshot){
  const key=normalizeApplicantKey(row);
  if(typeof row.name!=='string'||row.name.length<1||row.name.length>100||!Number.isSafeInteger(row.revision)||row.revision<0||typeof row.selectionRevoked!=='boolean'||typeof row.contactType!=='string'||(row.phone!==null&&typeof row.phone!=='string')||(row.archived!==undefined&&row.archived!==null&&typeof row.archived!=='boolean')||typeof row.status!=='string'||(row.confirmation!==null&&typeof row.confirmation!=='string'))throw new Error('INVALID_APPLICANT_SNAPSHOT');
  this.rows.set(applicantKey(key),structuredClone({...row,...key}));
 }
 async find(key:ApplicantKey){const row=this.rows.get(applicantKey(normalizeApplicantKey(key)));return row?structuredClone(row):undefined;}
}
/** Cancel/expiry only. Reissue remains approval-gated and never reopens terminal records. */
export function transitionOfflineRequest(row:TargetRequest,action:'cancel'|'expire'|'reissue',now:string):TargetRequest{
 const at=Date.parse(now);if(!Number.isFinite(at))throw new Error('INVALID_TIME');
 if(row.status==='completed')throw new Error('COMPLETED_IMMUTABLE');
 if(action==='reissue')throw new Error('REISSUE_POLICY_HOLD');
 if(action!=='cancel'&&action!=='expire')throw new Error('INVALID_OPERATION');
 if(!Number.isFinite(Date.parse(row.expiresAt)))throw new Error('INVALID_EXPIRY');
 if(row.status==='cancelled'||row.status==='expired')return structuredClone(row);
 if(row.status!=='pending')throw new Error('UNKNOWN_REQUEST_STATUS');
 if(action==='expire'&&at<Date.parse(row.expiresAt))throw new Error('NOT_EXPIRED');
 return {...structuredClone(row),status:action==='cancel'?'cancelled':'expired',history:[...row.history,`${now} offline ${action}`]};
}

type Artifact={hash:string;bytes:Uint8Array};
/** Disposable fake private object store. Explicit fault injection never calls real Storage. */
export class OfflinePdfStore{
 private files=new Map<string,Artifact>();failUploads=0;uploads=0;
 async put(key:string,bytes:Uint8Array){
  if(!/^[a-zA-Z0-9-]{1,80}$/.test(key)||bytes.length<5||new TextDecoder().decode(bytes.subarray(0,5))!=='%PDF-')throw new Error('INVALID_PDF_ARTIFACT');
  const hash=createHash('sha256').update(bytes).digest('hex'),old=this.files.get(key);
  if(old){if(old.hash!==hash)throw new Error('ARTIFACT_CONFLICT');return old.hash;}
  if(this.failUploads>0){this.failUploads--;throw new Error('UPLOAD_FAILED');}
  this.uploads++;this.files.set(key,{hash,bytes:bytes.slice()});return hash;
 }
 get(key:string){const f=this.files.get(key);return f?{hash:f.hash,bytes:f.bytes.slice()}:undefined;}
}
/** Offline job simulator; a real adapter needs durable jobs/leases and atomic finalization RPC. */
export class OfflinePdfRecovery{
 private jobs=new Map<string,{payloadHash:string;bytes?:Uint8Array;state:'pending'|'uploaded'|'completed';result?:string}>();
 private queue:Promise<unknown>=Promise.resolve();
 constructor(privateStore:OfflinePdfStore){this.store=privateStore;}
 private store:OfflinePdfStore;
 run(key:string,payloadHash:string,render:()=>Promise<Uint8Array>,finalize:(hash:string)=>Promise<void>){
  const task=this.queue.then(async()=>{
   if(!/^[a-zA-Z0-9-]{1,80}$/.test(key)||!/^[0-9a-f]{64}$/.test(payloadHash))throw new Error('INVALID_JOB_INPUT');
   let job=this.jobs.get(key);if(job&&job.payloadHash!==payloadHash)throw new Error('IDEMPOTENCY_CONFLICT');
   if(!job){job={payloadHash,state:'pending'};this.jobs.set(key,job);}
   if(job.state==='completed')return job.result!;
   job.bytes??=await render();
   const hash=await this.store.put(key,job.bytes);job.state='uploaded';
   // An uncertain finalization response keeps the same artifact for a safe idempotent retry.
   await finalize(hash);job.state='completed';job.result=hash;return hash;
  });this.queue=task.catch(()=>undefined);return task;
 }
 state(key:string){return this.jobs.get(key)?.state;}
}
