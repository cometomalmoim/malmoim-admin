import 'server-only';
import {createBrokerOidcVerifier,createVercelJwksLoader,type OidcPolicy,type JwksDocument} from './broker-oidc';
export type VercelOidcTransportOptions={brokerOrigin:string;jwksUrl:string;policy:OidcPolicy};
export interface VercelOidcTransportPorts {
 /** Official getVercelOidcToken, called within each server request. Never browser input. */
 getToken():Promise<string>;
 /** Current request: getUser + admin_users verification, then server session extraction. */
 administrator():Promise<{session:string}|null>;
 /** Server-internal test seams, never loaded from request/configuration JSON. */
 fetch?:typeof fetch;
 loadKeys?:()=>Promise<JwksDocument>;
}
export type OidcTransportResult={status:'disabled'|'verified'|'denied'|'unavailable'|'writes_disabled'};
/** Authentication transport only. No /v1 write routes, DB/Storage ports, role claims,
 * response passthrough or environment-based activation. Settings alone cannot enable writes.
 * Returned statuses never include credentials or remote error bodies. */
export type PhotoAuthorization={status:'disabled'|'denied'|'unavailable'}|{status:'verified';authorization:string;userSession?:string};
/** Server-internal authorization only; never serialize this result to a browser. */
export function createVercelPhotoAuthorization(options?:VercelOidcTransportOptions,ports?:VercelOidcTransportPorts){
 let configured=false,verify:ReturnType<typeof createBrokerOidcVerifier>|undefined;
 try{if(options&&ports){
  const u=new URL(options.brokerOrigin),iss=new URL(options.policy.issuer);
  if(u.protocol!=='https:'||u.origin!==options.brokerOrigin||u.username||u.password||iss.protocol!=='https:'||iss.hostname!=='oidc.vercel.com'||iss.port||iss.username||iss.password||iss.search||iss.hash||!/^\/(?:[A-Za-z0-9_-]+)?$/.test(iss.pathname))throw Error();
  const expected=iss.origin+(iss.pathname==='/'?'':iss.pathname)+'/.well-known/jwks';
  if(options.jwksUrl!==expected)throw Error();
  // Always validate pinned JWKS URL, even when a local mock key loader is injected.
  const loader=createVercelJwksLoader(options.jwksUrl);
  verify=createBrokerOidcVerifier({...options.policy},ports.loadKeys??loader);configured=true;
 }}catch{/* Default deny; configuration errors never reveal input values. */}
 async function authorize(admin:boolean=true):Promise<PhotoAuthorization>{
  if(!configured||!ports||!verify)return {status:'disabled'};
  try{
   const session=admin?(await ports.administrator())?.session:null;
   if(admin&&(!session||/[\r\n]/.test(session)||session.length>16384))return {status:'denied'};
   const token=await ports.getToken();
   // Verification here prevents forwarding a malformed token; the broker MUST verify again.
   const identity=await verify('Bearer '+token);if(identity.status!=='verified')return {status:identity.status==='unavailable'?'unavailable':'denied'};
   if(admin&&(await ports.administrator())?.session!==session)return {status:'denied'};
   return {status:'verified',authorization:'Bearer '+token,...(session?{userSession:session}:{})};
  }catch{return {status:'unavailable'};}
 }
 return {authorize};
}

export function createVercelOidcTransport(options?:VercelOidcTransportOptions,ports?:VercelOidcTransportPorts){
 const authorization=createVercelPhotoAuthorization(options,ports);
 async function send(admin:boolean):Promise<OidcTransportResult>{
  const identity=await authorization.authorize(admin);if(identity.status!=='verified')return identity;
  try{
   const response=await (ports!.fetch??fetch)(new URL('/photo-auth',options!.brokerOrigin),{method:'POST',redirect:'error',credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(3000),headers:{authorization:identity.authorization,'content-type':'application/json',...(identity.userSession?{'x-photo-user-session':identity.userSession}:{})},body:JSON.stringify({operation:admin?'write':'probe'})});
   // Never echo/parse remote errors, which could contain reflected headers.
   if(response.status===401||response.status===403){await response.body?.cancel();return {status:'denied'};}
   if(response.status!==200&&response.status!==503){await response.body?.cancel();return {status:'unavailable'};}
   const reader=response.body?.getReader();if(!reader)return {status:'unavailable'};let size=0;const chunks:Uint8Array[]=[];
   for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>1024){await reader.cancel();return {status:'unavailable'};}chunks.push(part.value);}
   const b=JSON.parse(Buffer.concat(chunks).toString());
   if(!admin&&response.status===200&&b.code==='AUTHENTICATED_NO_STORAGE')return {status:'verified'};
   if(admin&&response.status===503&&b.code==='PHOTO_WRITES_DISABLED')return {status:'writes_disabled'};
   return {status:'unavailable'};
  }catch{return {status:'unavailable'};}
 }
 return {probe:()=>send(false),checkAdministrator:()=>send(true)};
}
