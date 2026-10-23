import 'server-only';
import type {Access} from '@/lib/auth';
import type {photoRuntime} from './photo-runtime';
type Runtime=NonNullable<ReturnType<typeof photoRuntime>>;
const reply=(status:number,value:unknown)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
export function createPhotoApi(ports:{access():Promise<Access>;runtime():Runtime|null}){
 return async(request:Request)=>{
  try{
   if(!['GET','POST'].includes(request.method))return reply(405,{status:'invalid'});
   if(request.method==='POST'&&(request.headers.get('origin')!==new URL(request.url).origin||request.headers.get('sec-fetch-site')==='cross-site'))return reply(403,{status:'forbidden'});
   const access=await ports.access();if(access.status==='anonymous')return reply(401,{status:'authentication_failed'});if(access.status!=='admin')return reply(403,{status:'forbidden'});
   const runtime=ports.runtime();if(!runtime)return reply(503,{status:'disabled',enabled:false});
   if(request.method==='GET'){
    if(!await runtime.client.available())return reply(503,{status:'disabled',enabled:false});
    const result=await runtime.client.catalog(request.signal);return result.status==='recorded'?reply(200,{status:'recorded',enabled:true,activities:result.value,storageOrigin:runtime.storageOrigin}):reply(503,{status:result.status,enabled:false});
   }
   if(request.headers.get('content-type')!=='application/json')return reply(400,{status:'invalid'});
   const reader=request.body?.getReader();if(!reader)return reply(400,{status:'invalid'});const chunks:Uint8Array[]=[];let size=0;
   for(;;){const p=await reader.read();if(p.done)break;size+=p.value.byteLength;if(size>16384){await reader.cancel();return reply(413,{status:'invalid'});}chunks.push(p.value);}
   let b;try{b=JSON.parse(Buffer.concat(chunks).toString());}catch{return reply(400,{status:'invalid'});}
   if(!b||typeof b!=='object'||Array.isArray(b)||Object.keys(b).some(k=>!['operation','payload','binding'].includes(k)))return reply(400,{status:'invalid'});
   const names=['create','reserve','inspect','permit','finalize','recover','layout','visibility'];if(!names.includes(b.operation)||!b.payload||typeof b.payload!=='object'||Array.isArray(b.payload))return reply(400,{status:'invalid'});
   if(b.operation!=='permit'&&b.binding!==undefined)return reply(400,{status:'invalid'});
   if(!await runtime.client.available())return reply(503,{status:'disabled',enabled:false});
   const operation=b.operation as Exclude<typeof names[number],'permit'>;
   let result;
   if(b.operation==='permit'){
    if(!b.binding||typeof b.binding.activityId!=='string')return reply(400,{status:'invalid'});
    const current=await runtime.client.inspect({activityId:b.binding.activityId});
    if(current.status!=='recorded'||!current.value.photos?.some(p=>p.jobId===b.payload.jobId&&p.photoId===b.binding.photoId&&p.state==='pending'))return reply(403,{status:'forbidden'});
    result=await runtime.client.permit(b.payload,b.binding,request.signal);
   }else{switch(operation){case 'create':result=await runtime.client.create(b.payload,request.signal);break;case 'reserve':result=await runtime.client.reserve(b.payload,request.signal);break;case 'inspect':result=await runtime.client.inspect(b.payload,request.signal);break;case 'finalize':result=await runtime.client.finalize(b.payload,request.signal);break;case 'recover':result=await runtime.client.recover(b.payload,request.signal);break;case 'layout':result=await runtime.client.layout(b.payload,request.signal);break;case 'visibility':result=await runtime.client.visibility(b.payload,request.signal);break;default:return reply(400,{status:'invalid'});}}
   return reply(result.status==='recorded'?200:result.status==='invalid'?400:result.status==='conflict'?409:result.status==='authentication_failed'?401:result.status==='forbidden'?403:503,result);
  }catch{return reply(503,{status:'uncertain'});}
 };
}
export function createPublicPhotoApi(runtime:()=>Runtime|null){return async(request:Request)=>{if(request.method!=='GET')return reply(405,{status:'invalid'});try{const r=runtime();if(!r)return reply(503,{status:'disabled'});const result=await r.client.published(request.signal);return result.status==='recorded'?reply(200,{status:'recorded',activities:result.value}):reply(503,{status:result.status});}catch{return reply(503,{status:'unavailable'});}};}
