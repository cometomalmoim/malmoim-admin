import 'server-only';
import {createHash,randomUUID} from 'node:crypto';
import {createBrokerOidcVerifier,type OidcPolicy,type OidcDecision,type JwksDocument} from './broker-oidc';
import {PHOTO_BUCKETS,type StorageAction} from './server-capabilities';
import {activityPhotoPolicy} from './photo-policy';
import {createLimitedPhotoStorage,type LimitedStorageProvider,type PublishedSnapshot} from './limited-storage';
import type {FinalizationJob} from './verified-finalization';
/** Returned ONLY by a trusted DB/file-verifier adapter, never by an HTTP caller.
 * resolve must recheck revision, revocation, deletion intent and permit issuance CAS.
 * finalPath for pending jobs must come from actual server byte/decode/hash verification.
 * Public grant requires a current publication and immutable completed job. */
export type VerifiedStorageGrant={job:FinalizationJob;finalPath:string|null;publication:PublishedSnapshot|null};
export type StorageTokenScope={version:1;nonce:string;action:StorageAction;role:'photo_storage_issuer'|'photo_storage_finalizer'|'photo_scope_storage_reader';jobId:string;requestId:string;activityId:string;photoId:string;actorId:string;revision:number;epoch:number;bucket:string;path:string;size:number;mime:string;upsert:false;publicationVersion:number|null;readUrlTtl:60|null;issuedAt:number;expiresAt:number};
export interface StorageTokenIssuerPorts {
 workload():Promise<OidcDecision>;
 administrator():Promise<{actorId:string}|null>;
 resolve(action:StorageAction,jobId:string):Promise<VerifiedStorageGrant|null>;
 /** Credential from an independently authenticated server workload, not request headers. */
 issuerCredential():Promise<string>;
 /** Fresh trusted/pinned issuer keys each verification, loaded over verified HTTPS
  * or a separately authenticated key-management channel. No JWT-supplied discovery URLs.
  * Remove compromised keys here; previously issued Storage credentials/URLs may persist. */
 issuerKeys():Promise<JwksDocument>;
 /** Durable atomic claim retained through expiry in the real deployment.
  * Missing/unavailable storage must fail closed. Test memory is NOT production storage. */
 replay:{claim(proofId:string,expiresAt:number):Promise<boolean>};
 /** Credential is server-internal. No callback or raw token is returned to callers.
  * Adapter must pin Storage origin, enforce RLS, no redirects, no update/delete/list,
  * immutable INSERT only, and the exact scope. Read null means confirmed absence. */
 storage:{execute(scope:Readonly<StorageTokenScope>,credential:string,bytes?:Uint8Array):Promise<string|Uint8Array|null|void>};
 /** Real bounded image decode, required before create_final. */
 decode(bytes:Uint8Array):Promise<{mime:string}>;
 fetch?:typeof fetch;
}
export type StorageIssuerConfiguration={issuerOrigin:string;storageOrigin:string;proofPolicy:OidcPolicy};
export type StorageIssuerResult={status:'disabled'|'denied'|'uncertain'}|{status:'recorded';permit?:string;url?:string;bytes?:Uint8Array|null};
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const hash=(b:string|Uint8Array)=>createHash('sha256').update(b).digest('hex');
const extension=(m:string)=>({'image/png':'png','image/jpeg':'jpg','image/webp':'webp'} as Record<string,string>)[m];
function secureOrigin(value:string){const u=new URL(value);if(u.protocol!=='https:'||u.origin!==value||u.username||u.password)throw Error('Untrusted endpoint');return u.origin;}
function scopeFor(action:StorageAction,g:VerifiedStorageGrant,actor:string|null):StorageTokenScope|null{
 const j=g.job,ext=extension(j.mime),isPublic=action==='sign_final_read';
 if(!ext||![j.id,j.requestId,j.activityId,j.photoId,j.actorId].every(x=>typeof x==='string'&&uuid.test(x))||![j.revision,j.epoch].every(x=>Number.isSafeInteger(x)&&x>=0&&x<Number.MAX_SAFE_INTEGER)||!Number.isSafeInteger(j.size)||j.size<1||j.size>activityPhotoPolicy.maxBytes||j.tempPath!==`${j.activityId}/${j.photoId}.${ext}`||!['pending','complete'].includes(j.state)||(!isPublic&&actor!==j.actorId))return null;
 if((action==='create_final'||action==='issue_temp_permit')&&j.state!=='pending')return null;
 if(!['issue_temp_permit','read_temp','create_final','read_final','sign_final_read'].includes(action))return null;
 const temporary=action==='issue_temp_permit'||action==='read_temp',path=temporary?j.tempPath:g.finalPath;
 if(!path||(!temporary&&(!path.startsWith(`${j.activityId}/${j.photoId}/`)||path!==`${j.activityId}/${j.photoId}/${path.split('/')[2]}`||!new RegExp(`^[a-f0-9]{64}[.]${ext}$`).test(path.split('/')[2]??''))))return null;
 if(j.state==='complete'&&!temporary&&(path!==j.finalPath||path!==`${j.activityId}/${j.photoId}/${j.digest}.${ext}`))return null;
 let publicationVersion:number|null=null;
 if(isPublic){const p=g.publication,photo=p?.photos.find(x=>x.jobId===j.id&&x.photoId===j.photoId);
  if(j.state!=='complete'||!p||p.activityId!==j.activityId||!Number.isSafeInteger(p.version)||p.version<0||!photo||photo.path!==path||photo.digest!==j.digest||photo.size!==j.size||photo.mime!==j.mime||p.photos.length<1||p.photos.length>activityPhotoPolicy.maxFiles||p.photos.reduce((n,x)=>n+x.size,0)>activityPhotoPolicy.totalBytes)return null;
  if(new Set(p.photos.map(x=>x.photoId)).size!==p.photos.length||new Set(p.photos.map(x=>x.jobId)).size!==p.photos.length||p.photos.some(x=>!uuid.test(x.jobId)||!uuid.test(x.photoId)||!extension(x.mime)||!Number.isSafeInteger(x.size)||x.size<1||x.size>activityPhotoPolicy.maxBytes||!/^[a-f0-9]{64}$/.test(x.digest)||x.path!==`${p.activityId}/${x.photoId}/${x.digest}.${extension(x.mime)}`))return null;
  publicationVersion=p.version;
 }
 const now=Math.floor(Date.now()/1000);
 return {version:1,nonce:randomUUID(),action,role:action==='issue_temp_permit'?'photo_storage_issuer':isPublic?'photo_scope_storage_reader':'photo_storage_finalizer',jobId:j.id,requestId:j.requestId,activityId:j.activityId,photoId:j.photoId,actorId:j.actorId,revision:j.revision,epoch:j.epoch,bucket:temporary?PHOTO_BUCKETS.temporary:PHOTO_BUCKETS.final,path,size:j.size,mime:j.mime,upsert:false,publicationVersion,readUrlTtl:isPublic?60:null,issuedAt:now,expiresAt:now+120};
}
function validReadUrl(raw:string,origin:string,s:StorageTokenScope,upload:boolean,credential:string){
 const u=new URL(raw);if(u.origin!==origin||u.username||u.password||u.hash||decodeURIComponent(u.pathname)!==`/storage/v1/object/${upload?'upload/sign':'sign'}/${s.bucket}/${s.path}`)return false;
 const token=u.searchParams.get('token');if(!token||token===credential||[...u.searchParams.keys()].some(k=>k!=='token'))return false;
 if(!upload){const p=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString());if(!Number.isSafeInteger(p.iat)||!Number.isSafeInteger(p.exp)||p.exp-p.iat!==60||p.exp<=Date.now()/1000)return false;}
 // Signed upload permits have their OWN lifetime/replay limitations. 120s above
 // limits the issuer credential, not the Storage-issued upload URL (often 2 hours).
 return true;
}
/** No environment activation or default signer/client. Response proof is an issuer
 * attestation over exact scope + token hash + capability registration, NOT proof of
 * token-signing-key custody or upload termination. Storage must validate its JWT/RLS.
 * JWT payload checks below are rejection-only; authentication is TLS + signed proof. */
export function createStorageTokenIssuer(config?:StorageIssuerConfiguration,ports?:StorageTokenIssuerPorts){
 let issuer='',storage='',verify:ReturnType<typeof createBrokerOidcVerifier>|undefined;
 try{if(config&&ports){issuer=secureOrigin(config.issuerOrigin);storage=secureOrigin(config.storageOrigin);if(config.proofPolicy.issuer!==issuer||config.proofPolicy.maxAgeSeconds>120||(config.proofPolicy.maxLifetimeSeconds??config.proofPolicy.maxAgeSeconds)>120)throw Error();verify=createBrokerOidcVerifier({...config.proofPolicy},()=>ports.issuerKeys());}}catch{/* Unconfigured/invalid issuers stay disabled. */}
 return {async perform(action:StorageAction,jobId:string,expected?:{requestId?:string;path?:string;publicationVersion?:number;bytes?:Uint8Array}):Promise<StorageIssuerResult>{
  if(!verify||!ports||!config)return {status:'disabled'};
  try{
   if(!uuid.test(jobId)||(await ports.workload()).status!=='verified')return {status:'denied'};
   const isPublic=action==='sign_final_read',actor=isPublic?null:(await ports.administrator())?.actorId??null;if(!isPublic&&!actor)return {status:'denied'};
   const original=await ports.resolve(action,jobId);if(!original)return {status:'denied'};const grant=JSON.parse(JSON.stringify(original)) as VerifiedStorageGrant,scope=scopeFor(action,grant,actor);
   if(!scope||scope.jobId!==jobId||expected?.requestId&&expected.requestId!==scope.requestId||expected?.path&&expected.path!==scope.path||expected?.publicationVersion!==undefined&&expected.publicationVersion!==scope.publicationVersion)return {status:'denied'};
   if(action==='create_final'){
    if(!expected?.bytes||expected.bytes.byteLength!==scope.size)return {status:'denied'};
    // Snapshot caller-owned bytes before asynchronous decoder/HTTP work.
    expected={...expected,bytes:Uint8Array.from(expected.bytes)};
    if((await ports.decode(expected.bytes!)).mime!==scope.mime||scope.path!==`${scope.activityId}/${scope.photoId}/${hash(expected.bytes!)}.${extension(scope.mime)}`)return {status:'denied'};
   }else if(expected?.bytes)return {status:'denied'};
   const credential=await ports.issuerCredential();if(!credential||/[\r\n]/.test(credential)||credential.length>16384)return {status:'denied'};
   const requestHash=hash(JSON.stringify(scope));
   const response=await (ports.fetch??fetch)(new URL('/v1/storage-token',issuer),{method:'POST',redirect:'error',credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(3000),headers:{authorization:'Bearer '+credential,'content-type':'application/json'},body:JSON.stringify(scope)});
   if(response.status!==200){await response.body?.cancel();return {status:response.status===401||response.status===403?'denied':'uncertain'};}
   const reader=response.body?.getReader();if(!reader)return {status:'uncertain'};const chunks:Uint8Array[]=[];let length=0;
   for(;;){const part=await reader.read();if(part.done)break;length+=part.value.byteLength;if(length>32768){await reader.cancel();return {status:'denied'};}chunks.push(part.value);}
   const body=JSON.parse(Buffer.concat(chunks).toString());if(!body||Object.keys(body).sort().join()!=='proof,token'||typeof body.token!=='string'||typeof body.proof!=='string'||body.token.length>16384||!/^[-\w]+\.[-\w]+\.[-\w]+$/.test(body.token))return {status:'denied'};
   if((await verify('Bearer '+body.proof)).status!=='verified')return {status:'denied'};
   const proof=JSON.parse(Buffer.from(body.proof.split('.')[1],'base64url').toString()),token=JSON.parse(Buffer.from(body.token.split('.')[1],'base64url').toString()),now=Math.floor(Date.now()/1000);
   if(!uuid.test(proof.jti)||proof.nonce!==scope.nonce||proof.requestHash!==requestHash||proof.tokenHash!==hash(body.token)||proof.capabilityId!==scope.nonce||proof.iat<scope.issuedAt-1||proof.exp>scope.expiresAt||token.role!==scope.role||token.iss!==storage+'/auth/v1'||token.aud!=='authenticated'||token.jti!==scope.nonce||token.sub!==(isPublic?scope.nonce:scope.actorId)||![token.iat,token.exp].every(Number.isSafeInteger)||token.iat<scope.issuedAt-1||token.iat>now||token.exp<=now||token.exp>scope.expiresAt||token.exp-token.iat>120)return {status:'denied'};
   const recheck=async()=>(await ports.workload()).status==='verified'&&(isPublic||(await ports.administrator())?.actorId===actor)&&JSON.stringify(await ports.resolve(action,jobId))===JSON.stringify(grant);
   // Key refresh also occurs immediately before use: no application key/token cache.
   if(!await recheck()||(await verify('Bearer '+body.proof)).status!=='verified'||!await ports.replay.claim(proof.jti,proof.exp)||!await recheck()||Date.now()/1000>=token.exp)return {status:'denied'};
   const result=await ports.storage.execute(Object.freeze(scope),body.token,expected?.bytes);
   if(action==='create_final')return {status:result===undefined?'recorded':'uncertain'};
   if(action==='read_temp'||action==='read_final')return result===null||result instanceof Uint8Array?{status:'recorded',bytes:result}:{status:'uncertain'};
   if(typeof result!=='string'||!validReadUrl(result,storage,scope,action==='issue_temp_permit',body.token))return {status:'denied'};
   if(isPublic&&!await recheck())return {status:'denied'};
   return action==='issue_temp_permit'?{status:'recorded',permit:result}:{status:'recorded',url:result};
  }catch{return {status:'uncertain'};}
 }};
}

/** Reuses existing private-bucket/path checks; no raw credential is exposed by this port. */
export function createIssuerBackedPhotoStorage(issuer:ReturnType<typeof createStorageTokenIssuer>){
 const provider:LimitedStorageProvider={
  issuer:async job=>({permit:async(path,options)=>{if(options.upsert!==false)throw Error('Immutable upload required');const r=await issuer.perform('issue_temp_permit',job.id,{requestId:job.requestId,path});if(r.status!=='recorded'||!r.permit)throw Error('Upload issuer unavailable');return r.permit;}}),
  finalizer:async(job,final)=>({
   read:async(bucket,path)=>{if(bucket!==PHOTO_BUCKETS.temporary&&bucket!==PHOTO_BUCKETS.final||bucket===PHOTO_BUCKETS.final&&path!==final)throw Error('Storage scope denied');const r=await issuer.perform(bucket===PHOTO_BUCKETS.temporary?'read_temp':'read_final',job.id,{requestId:job.requestId,path});if(r.status!=='recorded'||r.bytes===undefined)throw Error('Storage read uncertain');return r.bytes;},
   create:async(path,bytes,mime,options)=>{if(path!==final||mime!==job.mime||options.upsert!==false)throw Error('Storage scope denied');const r=await issuer.perform('create_final',job.id,{requestId:job.requestId,path,bytes});if(r.status!=='recorded')throw Error('Storage create uncertain');},
  }),
 };
 return createLimitedPhotoStorage(provider);
}
/** Plug into createPublishedPhotoReader.sign; its fresh snapshot/auth checks stay intact. */
export function createIssuerBackedPublicSigner(issuer:ReturnType<typeof createStorageTokenIssuer>){
 return async(snapshot:PublishedSnapshot,photo:PublishedSnapshot['photos'][number],ttl:60)=>{
  if(ttl!==60||!snapshot.photos.some(p=>p.jobId===photo.jobId&&p.photoId===photo.photoId&&p.path===photo.path))throw Error('Public scope denied');
  const r=await issuer.perform('sign_final_read',photo.jobId,{path:photo.path,publicationVersion:snapshot.version});if(r.status!=='recorded'||!r.url)throw Error('Public issuer unavailable');return r.url;
 };
}
