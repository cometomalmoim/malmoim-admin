import 'server-only';
import {PHOTO_BUCKETS} from './server-capabilities';
import {activityPhotoPolicy} from './photo-policy';
import type {FinalizationJob,VerifiedFinalizationPorts} from './verified-finalization';
import type {OidcDecision} from './broker-oidc';
/** Server-internal ports. Credentials/role/path never come from request JSON.
 * Providers must enforce these permissions at Storage RLS, not just in this wrapper. */
export interface LimitedStorageProvider {
 issuer(job:FinalizationJob):Promise<{permit(path:string,options:{upsert:false}):Promise<string>}>;
 finalizer(job:FinalizationJob,path:string):Promise<{
  read(bucket:typeof PHOTO_BUCKETS.temporary|typeof PHOTO_BUCKETS.final,path:string):Promise<Uint8Array|null>;
  create(path:string,bytes:Uint8Array,mime:string,options:{upsert:false}):Promise<void>;
 }>;
}
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
function extension(mime:string){return ({'image/png':'png','image/jpeg':'jpg','image/webp':'webp'} as Record<string,string>)[mime];}
function jobAllowed(j:FinalizationJob){return [j.id,j.activityId,j.photoId,j.requestId,j.actorId].every(x=>typeof x==='string'&&uuid.test(x))&&extension(j.mime)&&j.tempPath===`${j.activityId}/${j.photoId}.${extension(j.mime)}`&&['pending','complete'].includes(j.state)&&Number.isSafeInteger(j.size)&&j.size>0&&j.size<=activityPhotoPolicy.maxBytes;}
function finalAllowed(j:FinalizationJob,p:string){return jobAllowed(j)&&p.startsWith(`${j.activityId}/${j.photoId}/`)&&new RegExp(`^[a-f0-9]{64}[.]${extension(j.mime)}$`).test(p.slice(p.lastIndexOf('/')+1))&&p.split('/').length===3;}
export function createLimitedPhotoStorage(provider?:LimitedStorageProvider):VerifiedFinalizationPorts['storage']&{permit(job:FinalizationJob):Promise<string>}{
 const required=()=>{if(!provider)throw Error('Storage disabled');return provider;};
 return {
  async permit(j){if(!jobAllowed(j)||j.state!=='pending')throw Error('Reservation required');return (await required().issuer(j)).permit(j.tempPath,{upsert:false});},
  async readTemp(j){if(!jobAllowed(j))throw Error('Invalid reservation');const b=await (await required().finalizer(j,'unavailable')).read(PHOTO_BUCKETS.temporary,j.tempPath);if(!b)throw Error('Temporary file not verified');return b;},
  async readFinal(j,p){if(!finalAllowed(j,p))throw Error('Invalid final path');return (await required().finalizer(j,p)).read(PHOTO_BUCKETS.final,p);},
  async createFinal(j,p,bytes,mime){if(j.state!=='pending'||!finalAllowed(j,p)||mime!==j.mime||bytes.byteLength!==j.size)throw Error('Invalid final create');return (await required().finalizer(j,p)).create(p,bytes,mime,{upsert:false});},
 };
}
export type PublishedSnapshot={activityId:string;version:number;photos:{jobId:string;photoId:string;path:string;digest:string;size:number;mime:string}[]};
export interface PublishedReaderPorts {
 authenticate(authorization:string|null):Promise<OidcDecision>;
 /** Restricted DB read role checks public flag, version, immutable completion receipt.
  * Both reads must be independent fresh DB reads, never cached request metadata. */
 snapshot(activityId:string):Promise<PublishedSnapshot|null>;
 sign(snapshot:PublishedSnapshot,photo:PublishedSnapshot['photos'][number],ttl:60):Promise<string>;
}
/** A pinned local-test origin is an explicit server-only opt-in for clean-lab tests.
 * It is never read from request JSON or environment activation flags.
 * Public visitors need no admin login; the calling broker workload still needs OIDC.
 * Only this fixed 60s signer is exposed. Storage may allow longer TTLs if the raw
 * reader credential is abused; that credential must never reach the browser. */
export function createPublishedPhotoReader(ports?:PublishedReaderPorts,storageOrigin?:string,pinnedLocalTestOrigin?:string){
 return {async read(activityId:string,authorization:string|null):Promise<{status:'disabled'|'denied'|'uncertain'}|{status:'recorded';activity:{id:string;photos:{id:string;src:string}[]}}>{
  if(!ports||!storageOrigin)return {status:'disabled'};
  try{
   const u=new URL(storageOrigin);if(u.origin!==storageOrigin||(u.protocol!=='https:'&&storageOrigin!=='http://127.0.0.1:58421'&&!(pinnedLocalTestOrigin===storageOrigin&&/^http:\/\/127[.]0[.]0[.]1:(59421|60421)$/.test(storageOrigin)))||!uuid.test(activityId))return {status:'denied'};
   if((await ports.authenticate(authorization)).status!=='verified')return {status:'denied'};
   const s=await ports.snapshot(activityId);if(!s||s.activityId!==activityId||!Number.isSafeInteger(s.version)||s.version<0||s.photos.length<1||s.photos.length>activityPhotoPolicy.maxFiles||new Set(s.photos.map(p=>p.photoId)).size!==s.photos.length)return {status:'denied'};
   if(s.photos.some(p=>!uuid.test(p.jobId)||!uuid.test(p.photoId)||!extension(p.mime)||!Number.isSafeInteger(p.size)||p.size<1||p.size>activityPhotoPolicy.maxBytes||!/^[a-f0-9]{64}$/.test(p.digest)||p.path!==`${s.activityId}/${p.photoId}/${p.digest}.${extension(p.mime)}`)||s.photos.reduce((n,p)=>n+p.size,0)>activityPhotoPolicy.totalBytes)return {status:'denied'};
   const fingerprint=JSON.stringify(s);const photos=[];for(const p of s.photos){const src=await ports.sign(s,p,60),url=new URL(src);
    if(url.origin!==storageOrigin||decodeURIComponent(url.pathname)!==`/storage/v1/object/sign/${PHOTO_BUCKETS.final}/${p.path}`)return {status:'denied'};
    // Sanity check of trusted Storage response, NOT JWT authentication or proof of origin.
    const raw=url.searchParams.get('token');if(!raw)return {status:'denied'};const claims=JSON.parse(Buffer.from(raw.split('.')[1],'base64url').toString());if(!Number.isSafeInteger(claims.iat)||!Number.isSafeInteger(claims.exp)||claims.exp-claims.iat!==60||claims.exp<=Date.now()/1000)return {status:'denied'};
    photos.push({id:p.photoId,src});
   }
   if((await ports.authenticate(authorization)).status!=='verified'||JSON.stringify(await ports.snapshot(activityId))!==fingerprint)return {status:'denied'};
   return {status:'recorded',activity:{id:activityId,photos}};
  }catch{return {status:'uncertain'};}
 }};
}
