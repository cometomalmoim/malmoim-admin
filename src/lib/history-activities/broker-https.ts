import 'server-only';
import type {OidcDecision} from './broker-oidc';
/** Authentication-only endpoint; no writer/DB/Storage adapter exists.
 * TLS must terminate in the hosting server; Request.url is not proof of TLS behind
 * an arbitrary proxy. Only a trusted TLS listener may call this handler. */
export function createBrokerBoundary(authenticate:(header:string|null)=>Promise<OidcDecision>,administrator?:(session:string)=>Promise<boolean>){
 return async(request:Request):Promise<Response>=>{
  const reply=(code:string,status:number)=>Response.json({code},{status,headers:{'Cache-Control':'no-store'}});
  if(new URL(request.url).protocol!=='https:')return reply('HTTPS_REQUIRED',400);
  const auth=await authenticate(request.headers.get('authorization'));
  if(auth.status==='unavailable')return reply('IDENTITY_UNAVAILABLE',503);
  if(auth.status!=='verified')return reply('WORKLOAD_UNAUTHENTICATED',401);
  if(request.method!=='POST')return reply('METHOD_NOT_ALLOWED',405);
  if(request.headers.get('content-type')!=='application/json')return reply('INVALID_REQUEST',400);
  let body;try{const reader=request.body?.getReader();if(!reader)return reply('INVALID_REQUEST',400);let size=0;const chunks:Uint8Array[]=[];for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>1024){await reader.cancel();return reply('INVALID_REQUEST',413);}chunks.push(part.value);}body=JSON.parse(Buffer.concat(chunks).toString());}catch{return reply('INVALID_REQUEST',400);}
  if(!body||Object.keys(body).length!==1||!['probe','write'].includes(body.operation))return reply('INVALID_REQUEST',400);
  if(body.operation==='probe')return reply('AUTHENTICATED_NO_STORAGE',200);
  if(!administrator)return reply('ADMIN_VERIFICATION_UNCONFIGURED',503);
  try{const session=request.headers.get('x-photo-user-session');if(!session||!await administrator(session))return reply('ADMIN_REQUIRED',403);}catch{return reply('ADMIN_VERIFICATION_FAILED',503);}
  // Even valid administrator + OIDC never enables photo writes in this module.
  return reply('PHOTO_WRITES_DISABLED',503);
 };
}
export function createBrokerHttpsClient(origin:string,getWorkloadToken:()=>Promise<string>){
 const u=new URL(origin);if(u.protocol!=='https:'||u.origin!==origin||u.username||u.password)throw Error('HTTPS broker origin required');
 return {async probe():Promise<'verified'|'unauthenticated'|'unavailable'>{
  try{const token=await getWorkloadToken();if(!token||/[\r\n]/.test(token))return 'unauthenticated';
   const r=await fetch(new URL('/photo-auth',origin),{method:'POST',redirect:'error',credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(3000),headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({operation:'probe'})});
   if(r.status===401)return 'unauthenticated';if(r.status!==200)return 'unavailable';const b=await r.json();return b.code==='AUTHENTICATED_NO_STORAGE'?'verified':'unavailable';
  }catch{return 'unavailable';}
 }};
}
