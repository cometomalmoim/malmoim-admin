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
export function createVercelOidcTransport(options?:VercelOidcTransportOptions,ports?:VercelOidcTransportPorts){
 let configured=false,origin='',verify:ReturnType<typeof createBrokerOidcVerifier>|undefined;
 try{if(options&&ports){
  const u=new URL(options.brokerOrigin),iss=new URL(options.policy.issuer);
  if(u.protocol!=='https:'||u.origin!==options.brokerOrigin||u.username||u.password||iss.protocol!=='https:'||iss.hostname!=='oidc.vercel.com'||iss.port||iss.username||iss.password||iss.search||iss.hash||!/^\/(?:[A-Za-z0-9_-]+)?$/.test(iss.pathname))throw Error();
  const expected=iss.origin+(iss.pathname==='/'?'':iss.pathname)+'/.well-known/jwks';
  if(options.jwksUrl!==expected)throw Error();
  // Always validate pinned JWKS URL, even when a local mock key loader is injected.
  const loader=createVercelJwksLoader(options.jwksUrl);
  verify=createBrokerOidcVerifier({...options.policy},ports.loadKeys??loader);origin=u.origin;configured=true;
 }}catch{/* Default deny; configuration errors never reveal input values. */}
 async function send(admin:boolean):Promise<OidcTransportResult>{
  if(!configured||!ports||!verify)return {status:'disabled'};
  try{
   const session=admin?(await ports.administrator())?.session:null;
   if(admin&&(!session||/[\r\n]/.test(session)||session.length>16384))return {status:'denied'};
   const token=await ports.getToken();
   // Verification here prevents forwarding a malformed token; the broker MUST verify again.
   const identity=await verify('Bearer '+token);if(identity.status!=='verified')return {status:identity.status==='unavailable'?'unavailable':'denied'};
   if(admin&&(await ports.administrator())?.session!==session)return {status:'denied'};
   const response=await (ports.fetch??fetch)(new URL('/photo-auth',origin),{method:'POST',redirect:'error',credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(3000),headers:{authorization:'Bearer '+token,'content-type':'application/json',...(session?{'x-photo-user-session':session}:{})},body:JSON.stringify({operation:admin?'write':'probe'})});
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
