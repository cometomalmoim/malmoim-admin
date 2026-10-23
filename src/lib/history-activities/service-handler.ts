import 'server-only';
import {createBrokerBoundary} from './broker-https';
import {activityPhotoPolicy} from './photo-policy';
import type {OidcDecision} from './broker-oidc';
import type {FinalizationJob} from './verified-finalization';
import type {PublishedSnapshot} from './limited-storage';
export type BrokerOperation='create'|'reserve'|'inspect'|'layout'|'visibility'|'claim_permit';
export class BrokerFault extends Error {constructor(public readonly kind:'denied'|'conflict'|'invalid'|'unavailable'){super(kind);}}
export interface PhotoBrokerPorts {
 /** Optional composition lifecycle. HTTP implementation must propagate abort signals. */
 handleRequest?(request:Request):Promise<Response>;
 close?():Promise<void>;
 authenticate(header:string|null):Promise<OidcDecision>;
 administrator(session:string):Promise<{actorId:string}|null>;
 command?(op:BrokerOperation,payload:Record<string,unknown>,session:string):Promise<Record<string,unknown>>;
 job?(id:string,actorId:string):Promise<FinalizationJob>;
 permit?(job:FinalizationJob):Promise<string>;
 storageOrigin?:string;
 finalize?(input:unknown,auth:{authorization:string|null;userSession:string}):Promise<{status:string}>;
 publicRead?(id:string,authorization:string|null):Promise<{status:string;activity?:{id:string;photos:{id:string;src:string}[]}}>; 
 publicMetadata?(id:string):Promise<{activityId:string;title:string;date:string;description:string;revision:number;order:string[];cover:string}|null>;
 readiness?():Promise<boolean>;
}
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const isId=(v:unknown)=>typeof v==='string'&&uuid.test(v);
const revision=(v:unknown)=>Number.isSafeInteger(v)&&(v as number)>=0&&(v as number)<Number.MAX_SAFE_INTEGER;
const keys=(v:Record<string,unknown>,names:string[])=>Object.keys(v).sort().join()===names.sort().join();
const text=(v:unknown,min:number,max:number)=>typeof v==='string'&&v.trim().length>=min&&v.length<=max;
function valid(op:BrokerOperation,p:Record<string,unknown>){
 if(op==='inspect')return keys(p,['activityId'])&&isId(p.activityId);
 if(!isId(p.requestId))return false;
 if(op==='create')return keys(p,['requestId','title','date','description'])&&text(p.title,1,200)&&text(p.description,0,2000)&&typeof p.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(p.date);
 if(!isId(p.activityId))return false;
 if(op==='claim_permit')return keys(p,['requestId','activityId','jobId','sourceRequestId'])&&isId(p.jobId)&&isId(p.sourceRequestId);
 if(!revision(p.revision))return false;
 if(op==='reserve')return keys(p,['activityId','requestId','revision','size','mime'])&&Number.isSafeInteger(p.size)&&(p.size as number)>0&&(p.size as number)<=activityPhotoPolicy.maxBytes&&(activityPhotoPolicy.mimeTypes as readonly unknown[]).includes(p.mime);
 if(op==='layout')return keys(p,['activityId','requestId','revision','order','cover'])&&Array.isArray(p.order)&&p.order.length>0&&p.order.length<=10&&p.order.every(isId)&&new Set(p.order).size===p.order.length&&p.order.includes(p.cover);
 return op==='visibility'&&keys(p,['activityId','requestId','revision','published'])&&typeof p.published==='boolean';
}
async function json(request:Request){if(request.headers.get('content-type')!=='application/json')throw new BrokerFault('invalid');const reader=request.body?.getReader();if(!reader)throw new BrokerFault('invalid');const chunks:Uint8Array[]=[];let size=0;for(;;){const p=await reader.read();if(p.done)break;size+=p.value.byteLength;if(size>16384){await reader.cancel();throw new BrokerFault('invalid');}chunks.push(p.value);}let p;try{p=JSON.parse(Buffer.concat(chunks).toString());}catch{throw new BrokerFault('invalid');}if(!p||typeof p!=='object'||Array.isArray(p))throw new BrokerFault('invalid');return p as Record<string,unknown>;}
function dto(r:Record<string,unknown>){const out:Record<string,unknown>={};for(const k of ['activityId','revision','title','date','description','order','cover','replayed','jobId','requestId','photoId','published'])if(Object.hasOwn(r,k))out[k]=r[k];if(Array.isArray(r.photos))out.photos=r.photos.map(p=>({jobId:p.jobId,photoId:p.photoId,state:p.state,permit:p.permit}));return out;}
/** Hosting-neutral HTTP boundary. No default adapter, secrets, DB/Storage or Route wiring.
 * A trusted TLS listener must supply Requests; arbitrary forwarded headers do not prove TLS. */
export function createPhotoBrokerHandler(ports?:PhotoBrokerPorts){
 const reply=(status:number,code:string,extra:Record<string,unknown>={})=>Response.json({code,...extra},{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 return async(request:Request):Promise<Response>=>{
  try{
   const path=new URL(request.url).pathname;
   if(request.method==='GET'&&path==='/health/live')return reply(200,'LIVE');
   if(request.method==='GET'&&path==='/health/ready'){let ready=false;try{ready=!!ports&&!!ports.readiness&&await ports.readiness();}catch{}return reply(ready?200:503,ready?'READY':'NOT_READY');}
   if(!ports)return reply(503,'BROKER_DISABLED');
   if(new URL(request.url).protocol!=='https:')return reply(400,'HTTPS_REQUIRED');
   if(path==='/photo-auth')return createBrokerBoundary(h=>ports.authenticate(h),async s=>!!await ports.administrator(s))(request);
   if(request.method!=='POST')return reply(405,'METHOD_NOT_ALLOWED');
   const routes:Record<string,BrokerOperation>={'/v1/activities':'create','/v1/reservations':'reserve','/v1/inspect':'inspect','/v1/layout':'layout','/v1/visibility':'visibility'};
   if(!routes[path]&&!['/v1/permits','/v1/finalize','/v1/recover','/v1/public'].includes(path))return reply(404,'NOT_FOUND');
   const authorization=request.headers.get('authorization'),workload=await ports.authenticate(authorization);
   if(workload.status!=='verified')return reply(workload.status==='unavailable'?503:401,'WORKLOAD_REJECTED');
   if(path==='/v1/public'){
    if(!ports.publicRead||!ports.publicMetadata)return reply(503,'PUBLIC_READ_DISABLED');
    const p=await json(request);if(!keys(p,['activityId'])||!isId(p.activityId))return reply(400,'INVALID_REQUEST');const id=p.activityId as string;
    const meta=await ports.publicMetadata(id);if(!meta)return reply(404,'NOT_PUBLIC');
    const view=await ports.publicRead(id,authorization);if(view.status!=='recorded'||!view.activity||view.activity.id!==id||meta.activityId!==id)return reply(404,'NOT_PUBLIC');
    if(JSON.stringify(meta)!==JSON.stringify(await ports.publicMetadata(id)))return reply(409,'SNAPSHOT_CHANGED');
    const photos=meta.order.map(photoId=>view.activity!.photos.find(p=>p.id===photoId));if(photos.some(p=>!p)||photos.length!==view.activity.photos.length||!meta.order.includes(meta.cover))return reply(503,'PUBLIC_STATE_UNCERTAIN');
    return reply(200,'RECORDED',{activity:{id,title:meta.title,date:meta.date,description:meta.description,coverId:meta.cover,photos}});
   }
   const session=request.headers.get('x-photo-user-session');if(!session)return reply(401,'ADMIN_SESSION_REQUIRED');const actor=await ports.administrator(session);if(!actor)return reply(403,'ADMIN_REQUIRED');
   const p=await json(request);
   if(path==='/v1/finalize'||path==='/v1/recover'){
    if(!ports.finalize)return reply(503,'FINALIZATION_DISABLED');
    if(!keys(p,['jobId','requestId'])||!isId(p.jobId)||!isId(p.requestId))return reply(400,'INVALID_REQUEST');
    const r=await ports.finalize(p,{authorization,userSession:session});return reply(['recorded','already_complete'].includes(r.status)?200:r.status==='denied'?403:503,r.status.toUpperCase());
   }
   if(!ports.command)return reply(503,'DATABASE_DISABLED');
   if(path==='/v1/permits'){
    if(!ports.job||!ports.permit||!ports.storageOrigin)return reply(503,'UPLOAD_ISSUER_DISABLED');
    if(!keys(p,['jobId','requestId','permitRequestId'])||![p.jobId,p.requestId,p.permitRequestId].every(isId))return reply(400,'INVALID_REQUEST');
    const job=await ports.job(p.jobId as string,actor.actorId);if(job.actorId!==actor.actorId||job.requestId!==p.requestId||job.state!=='pending')return reply(403,'RESERVATION_REQUIRED');
    // Durable claim BEFORE issuance. Lost response never authorizes automatic reissue.
    await ports.command('claim_permit',{activityId:job.activityId,jobId:job.id,sourceRequestId:job.requestId,requestId:p.permitRequestId},session);
    if((await ports.authenticate(authorization)).status!=='verified'||(await ports.administrator(session))?.actorId!==actor.actorId)return reply(403,'AUTHORIZATION_CHANGED');
    const signedUrl=await ports.permit(job),u=new URL(signedUrl);if(u.origin!==ports.storageOrigin||decodeURIComponent(u.pathname)!==`/storage/v1/object/upload/sign/history-activity-photos/${job.tempPath}`)return reply(503,'UPLOAD_TARGET_REJECTED');
    return reply(200,'RECORDED',{jobId:job.id,signedUrl});
   }
   const op=routes[path];if(!valid(op,p))return reply(400,'INVALID_REQUEST');
   if((await ports.administrator(session))?.actorId!==actor.actorId)return reply(403,'AUTHORIZATION_CHANGED');
   const result=await ports.command(op,p,session);return reply(200,'RECORDED',{result:dto(result)});
  }catch(error){if(error instanceof BrokerFault)return reply(error.kind==='conflict'?409:error.kind==='denied'?403:error.kind==='invalid'?400:503,error.kind.toUpperCase());return reply(503,'RESULT_UNCERTAIN');}
 };
}
// Type-only alignment with the existing published snapshot contract.
export type ServicePublicationSnapshot=PublishedSnapshot;
