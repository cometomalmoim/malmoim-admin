import 'server-only';
import {createVercelPhotoAuthorization,type VercelOidcTransportOptions,type VercelOidcTransportPorts} from './vercel-oidc-transport';
import {activityPhotoPolicy} from './photo-policy';
import {getPhotoVercelOidcToken} from '../../../services/history-photo-broker/vercel-token.cjs';
import {getPhotoAdministratorSession} from './vercel-admin-session';

export type CreateActivityRequest={requestId:string;title:string;date:string;description:string};
export type ReservePhotoRequest={requestId:string;activityId:string;revision:number;size:number;mime:'image/jpeg'|'image/png'|'image/webp'};
export type PermitRequest={jobId:string;requestId:string;permitRequestId:string};
export type FinalizePhotoRequest={jobId:string;requestId:string};
export type LayoutRequest={activityId:string;requestId:string;revision:number;order:string[];cover:string};
export type VisibilityRequest={activityId:string;requestId:string;revision:number;published:boolean};
/** Derived from the server reservation response and retained by the server, not browser path/role input. */
export type ReservationBinding={activityId:string;photoId:string;mime:ReservePhotoRequest['mime']};
export type ActivityResult={activityId:string;revision:number;title?:string;date?:string;description?:string;order?:string[];cover?:string|null;published?:boolean;replayed?:boolean;jobId?:string;requestId?:string;photoId?:string;photos?:{jobId:string;photoId:string;state:'pending'|'complete';permit:'not-issued'|'claimed-or-uncertain';requestId?:string}[]};
export type ClientFailure={status:'disabled'|'invalid'|'authentication_failed'|'forbidden'|'conflict'|'unavailable'}|{status:'uncertain';reason:'timeout'|'aborted'|'network'|'response'|'broker'};
export type ClientResult<T>={status:'recorded';value:T}|ClientFailure;
export type PhotoClientOptions=VercelOidcTransportOptions&{storageOrigin:string;operationsReviewed:true;timeoutMs?:number};
export type PublicActivity={id:string;title:string;date:string;description:string;coverId:string;photos:{id:string;src:string}[]};
type Operation='catalog'|'published'|'create'|'reserve'|'inspect'|'permit'|'finalize'|'recover'|'layout'|'visibility';
const paths:Record<Operation,string>={catalog:'/v1/catalog',published:'/v1/published',create:'/v1/activities',reserve:'/v1/reservations',inspect:'/v1/inspect',permit:'/v1/permits',finalize:'/v1/finalize',recover:'/v1/recover',layout:'/v1/layout',visibility:'/v1/visibility'};
const id=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(v);
const rev=(v:unknown):v is number=>Number.isSafeInteger(v)&&(v as number)>=0&&(v as number)<Number.MAX_SAFE_INTEGER;
const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.prototype.toString.call(v)==='[object Object]';
const exact=(v:Record<string,unknown>,names:string[])=>Object.keys(v).sort().join()===names.slice().sort().join();
const mime=(v:unknown)=>(activityPhotoPolicy.mimeTypes as readonly unknown[]).includes(v);
const date=(v:unknown)=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
function valid(op:Operation,p:Record<string,unknown>){
 if(op==='catalog'||op==='published')return exact(p,[]);
 if(op==='inspect')return exact(p,['activityId'])&&id(p.activityId);
 if(op==='permit')return exact(p,['jobId','requestId','permitRequestId'])&&id(p.jobId)&&id(p.requestId)&&id(p.permitRequestId);
 if(op==='finalize'||op==='recover')return exact(p,['jobId','requestId'])&&id(p.jobId)&&id(p.requestId);
 if(!id(p.requestId))return false;
 if(op==='create')return exact(p,['requestId','title','date','description'])&&typeof p.title==='string'&&p.title.trim().length>0&&p.title.length<=200&&typeof p.description==='string'&&p.description.length<=2000&&date(p.date);
 if(!id(p.activityId)||!rev(p.revision))return false;
 if(op==='reserve')return exact(p,['requestId','activityId','revision','size','mime'])&&Number.isSafeInteger(p.size)&&(p.size as number)>0&&(p.size as number)<=activityPhotoPolicy.maxBytes&&mime(p.mime);
 if(op==='layout')return exact(p,['requestId','activityId','revision','order','cover'])&&Array.isArray(p.order)&&p.order.length>0&&p.order.length<=10&&p.order.every(id)&&new Set(p.order).size===p.order.length&&id(p.cover)&&p.order.includes(p.cover);
 return op==='visibility'&&exact(p,['requestId','activityId','revision','published'])&&typeof p.published==='boolean';
}
function activity(v:unknown,p:Record<string,unknown>,op:Operation):v is ActivityResult{
 if(!obj(v)||!id(v.activityId)||!rev(v.revision)||('activityId'in p&&v.activityId!==p.activityId))return false;
 const allowed=['activityId','revision','title','date','description','order','cover','published','replayed','jobId','requestId','photoId','photos'];
 if(Object.keys(v).some(k=>!allowed.includes(k)))return false;
 for(const k of ['jobId','requestId','photoId'])if(k in v&&!id(v[k]))return false;
 if('requestId'in v&&v.requestId!==p.requestId)return false;
 if('title'in v&&(typeof v.title!=='string'||v.title.length>200)||'description'in v&&(typeof v.description!=='string'||v.description.length>2000)||'date'in v&&!date(v.date))return false;
 for(const k of ['published','replayed'])if(k in v&&typeof v[k]!=='boolean')return false;
 if('cover'in v&&v.cover!==null&&!id(v.cover))return false;
 if('order'in v&&(!Array.isArray(v.order)||v.order.length>10||!v.order.every(id)||new Set(v.order).size!==v.order.length||v.cover!==null&&v.cover!==undefined&&!v.order.includes(v.cover as string)))return false;
 if('photos'in v&&(!Array.isArray(v.photos)||v.photos.length>10||!v.photos.every(x=>obj(x)&&(exact(x,['jobId','photoId','state','permit'])||exact(x,['jobId','photoId','state','permit','requestId'])&&id(x.requestId))&&id(x.jobId)&&id(x.photoId)&&['pending','complete'].includes(x.state as string)&&['not-issued','claimed-or-uncertain'].includes(x.permit as string))||new Set(v.photos.map(x=>x.photoId)).size!==v.photos.length||new Set(v.photos.map(x=>x.jobId)).size!==v.photos.length))return false;
 if(op==='layout'&&(JSON.stringify(v.order)!==JSON.stringify(p.order)||v.cover!==p.cover))return false;
 if(op==='visibility'&&v.published!==p.published)return false;
 return op!=='reserve'||id(v.jobId)&&id(v.photoId);
}
function validPublicActivity(v:unknown,storage:string):v is PublicActivity{
 if(!obj(v)||!exact(v,['id','title','date','description','coverId','photos'])||!id(v.id)||!id(v.coverId)||typeof v.title!=='string'||v.title.length>200||typeof v.description!=='string'||v.description.length>2000||!date(v.date)||!Array.isArray(v.photos)||!v.photos.length||v.photos.length>10)return false;
 if(!v.photos.every(p=>{if(!obj(p)||!exact(p,['id','src'])||!id(p.id)||typeof p.src!=='string')return false;try{const u=new URL(p.src),claim=JSON.parse(Buffer.from((u.searchParams.get('token')??'').split('.')[1],'base64url').toString());return u.origin===storage&&!u.username&&!u.password&&!u.hash&&u.pathname.startsWith(`/storage/v1/object/sign/history-activity-final-photos/${v.id}/${p.id}/`)&&/^[a-f0-9]{64}[.](png|jpg|webp)$/.test(u.pathname.split('/').at(-1)??'')&&Number.isSafeInteger(claim.iat)&&Number.isSafeInteger(claim.exp)&&claim.exp-claim.iat===60&&claim.exp>Date.now()/1000&&claim.iat<=Date.now()/1000+5;}catch{return false;}}))return false;
 return new Set(v.photos.map(p=>p.id)).size===v.photos.length&&v.photos.some(p=>p.id===v.coverId);
}
function origin(v:string){const u=new URL(v);if(u.protocol!=='https:'||u.origin!==v||u.username||u.password)throw Error();return u.origin;}
/** No route/UI wiring, defaults disabled. The operator must explicitly review/inject ports.
 * Never retries. requestId/permitRequestId are the existing DB idempotency keys, not new headers.
 * The Storage upload URL is the only permitted browser upload capability; it proves no termination.
 */
export function createPhotoOperationClient(options?:PhotoClientOptions,ports?:VercelOidcTransportPorts){
 options=options?{...options,policy:{...options.policy}}:undefined;
 let enabled=false,storage='';try{enabled=!!options&&!!ports&&options.operationsReviewed===true;storage=options?origin(options.storageOrigin):'';if(options)origin(options.brokerOrigin);if(options?.timeoutMs!==undefined&&(!Number.isSafeInteger(options.timeoutMs)||options.timeoutMs<1||options.timeoutMs>15000))enabled=false;}catch{enabled=false;}
 const authorization=createVercelPhotoAuthorization(enabled?options:undefined,enabled?ports:undefined);
 async function call<T>(op:Operation,input:unknown,signal?:AbortSignal,binding?:ReservationBinding):Promise<ClientResult<T>>{
  if(!enabled||!options||!ports)return {status:'disabled'};
  let p:Record<string,unknown>,body:string,scope:ReservationBinding|undefined;
  try{if(!obj(input)||!valid(op,input))return {status:'invalid'};body=JSON.stringify(input);if(Buffer.byteLength(body)>16384)return {status:'invalid'};p=JSON.parse(body);if(!valid(op,p))return {status:'invalid'};if(op==='permit'){if(!obj(binding)||!exact(binding,['activityId','photoId','mime'])||!id(binding.activityId)||!id(binding.photoId)||!mime(binding.mime))return {status:'invalid'};scope={...binding};}}catch{return {status:'invalid'};}
  const controller=new AbortController();const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();let sent=false,timedOut=false;const timer=setTimeout(()=>{timedOut=true;controller.abort();},options.timeoutMs??10000);
  const uncertain=(reason:'timeout'|'aborted'|'network'|'response'|'broker'):ClientFailure=>({status:'uncertain',reason});
  const stopped=():ClientFailure=>sent?uncertain(timedOut?'timeout':'aborted'):{status:'unavailable'};
  const perform=async():Promise<ClientResult<T>>=>{
   if(controller.signal.aborted)return stopped();
   const auth=await authorization.authorize(op!=='published');if(controller.signal.aborted)return stopped();
   if(auth.status!=='verified')return {status:auth.status==='denied'?'authentication_failed':auth.status};
   if(op!=='published'&&!auth.userSession)return {status:'authentication_failed'};
   try{
    if(controller.signal.aborted)return stopped();sent=true;
    const response=await (ports.fetch??fetch)(new URL(paths[op],options.brokerOrigin),{method:'POST',headers:{authorization:auth.authorization,...(auth.userSession?{'x-photo-user-session':auth.userSession}:{}),'content-type':'application/json'},body,credentials:'omit',redirect:'error',cache:'no-store',signal:controller.signal});
    if([400,401,403,409].includes(response.status)){await response.body?.cancel();return {status:response.status===400?'invalid':response.status===401?'authentication_failed':response.status===403?'forbidden':'conflict'};}
    if(response.status!==200&&response.status!==503){await response.body?.cancel();return uncertain('broker');}
    if(!/^application\/json(?:;|$)/i.test(response.headers.get('content-type')??'')){await response.body?.cancel();return uncertain('response');}
    const reader=response.body?.getReader();if(!reader)return uncertain('response');let size=0;const chunks:Uint8Array[]=[];
    for(;;){if(controller.signal.aborted){await reader.cancel();return stopped();}const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>((op==='catalog'||op==='published')?524288:16384)){await reader.cancel();return uncertain('response');}chunks.push(part.value);}
    const raw=Buffer.concat(chunks).toString();if(raw.includes(auth.authorization.slice(7))||!!auth.userSession&&raw.includes(auth.userSession))return uncertain('response');
    let data:unknown;try{data=JSON.parse(raw);}catch{return uncertain('response');}if(!obj(data))return uncertain('response');
    const normalized=JSON.stringify(data);if(normalized.includes(auth.authorization.slice(7))||!!auth.userSession&&normalized.includes(auth.userSession))return uncertain('response');
    if(response.status===503){if(exact(data,['code'])&&['BROKER_DISABLED','DATABASE_DISABLED','FINALIZATION_DISABLED','UPLOAD_ISSUER_DISABLED','CATALOG_DISABLED'].includes(data.code as string))return {status:'disabled'};return uncertain('broker');}
    if(op!=='permit'&&op!=='published'&&(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(normalized)||/sb_secret_|BEGIN (?:RSA |EC )?PRIVATE KEY|postgres(?:ql)?:\/\/[^\s]+:[^\s]+@/.test(normalized)))return uncertain('response');
    if(op==='catalog'||op==='published'){
     if(!exact(data,['code','activities'])||data.code!=='RECORDED'||!Array.isArray(data.activities)||data.activities.length>100)return uncertain('response');
     const values=data.activities;
     if(op==='catalog'){if(!values.every(v=>activity(v,{},'inspect'))||new Set(values.map(v=>v.activityId)).size!==values.length)return uncertain('response');}
     else{if(!values.every(v=>validPublicActivity(v,storage))||new Set(values.map(v=>v.id)).size!==values.length)return uncertain('response');}
     return {status:'recorded',value:values as T};
    }
    if(op==='finalize'||op==='recover')return exact(data,['code'])&&['RECORDED','ALREADY_COMPLETE'].includes(data.code as string)?{status:'recorded',value:{alreadyComplete:data.code==='ALREADY_COMPLETE'} as T}:uncertain('response');
    if(op==='permit'){
     if(!exact(data,['code','jobId','signedUrl'])||data.code!=='RECORDED'||data.jobId!==p.jobId||typeof data.signedUrl!=='string'||data.signedUrl.length>8192)return uncertain('response');
     try{const u=new URL(data.signedUrl),ext=scope!.mime==='image/jpeg'?'jpg':scope!.mime==='image/png'?'png':'webp';if(u.origin!==storage||u.username||u.password||u.hash||u.pathname!==`/storage/v1/object/upload/sign/history-activity-photos/${scope!.activityId}/${scope!.photoId}.${ext}`||!u.searchParams.get('token')||[...u.searchParams.keys()].length!==1||u.searchParams.get('token')===auth.userSession||u.searchParams.get('token')===auth.authorization.slice(7))return uncertain('response');}catch{return uncertain('response');}
     return {status:'recorded',value:{jobId:data.jobId,signedUrl:data.signedUrl} as T};
    }
    return exact(data,['code','result'])&&data.code==='RECORDED'&&activity(data.result,p,op)?{status:'recorded',value:data.result as T}:uncertain('response');
   }catch(error){return controller.signal.aborted?stopped():uncertain(error instanceof Error&&error.name==='TimeoutError'?'timeout':'network');}
  };
  let onAbort:()=>void=()=>{};const cancelled=new Promise<ClientFailure>(resolve=>{onAbort=()=>resolve(stopped());controller.signal.addEventListener('abort',onAbort,{once:true});if(controller.signal.aborted)resolve(stopped());});
  try{return await Promise.race([perform(),cancelled]);}finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);controller.signal.removeEventListener('abort',onAbort);}
 }
 return {
  async available(){
   if(!enabled||!options||!ports)return false;try{const a=await authorization.authorize(true);if(a.status!=='verified')return false;const r=await (ports.fetch??fetch)(new URL('/health/ready',options.brokerOrigin),{method:'GET',headers:{authorization:a.authorization},redirect:'error',cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(3000)});if(r.status!==200){await r.body?.cancel();return false;}const reader=r.body?.getReader();if(!reader)return false;let text='';for(;;){const p=await reader.read();if(p.done)break;text+=Buffer.from(p.value).toString();if(text.length>128){await reader.cancel();return false;}}const data=JSON.parse(text);return exact(data,['code'])&&data.code==='READY';}catch{return false;}
  },
  catalog:(s?:AbortSignal)=>call<ActivityResult[]>('catalog',{},s),
  published:(s?:AbortSignal)=>call<PublicActivity[]>('published',{},s),
  create:(p:CreateActivityRequest,s?:AbortSignal)=>call<ActivityResult>('create',p,s),
  reserve:(p:ReservePhotoRequest,s?:AbortSignal)=>call<ActivityResult>('reserve',p,s),
  inspect:(p:{activityId:string},s?:AbortSignal)=>call<ActivityResult>('inspect',p,s),
  permit:(p:PermitRequest,binding:ReservationBinding,s?:AbortSignal)=>call<{jobId:string;signedUrl:string}>('permit',p,s,binding),
  finalize:(p:FinalizePhotoRequest,s?:AbortSignal)=>call<{alreadyComplete:boolean}>('finalize',p,s),
  recover:(p:FinalizePhotoRequest,s?:AbortSignal)=>call<{alreadyComplete:boolean}>('recover',p,s),
  layout:(p:LayoutRequest,s?:AbortSignal)=>call<ActivityResult>('layout',p,s),
  visibility:(p:VisibilityRequest,s?:AbortSignal)=>call<ActivityResult>('visibility',p,s),
 };
}
/** Explicit Node server request factory. No env reads or automatic route activation. */
export function createVercelPhotoOperationClient(options?:PhotoClientOptions){
 return createPhotoOperationClient(options,options?{getToken:getPhotoVercelOidcToken,administrator:getPhotoAdministratorSession}:undefined);
}
