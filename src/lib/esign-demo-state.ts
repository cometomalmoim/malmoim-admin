import {StoredPreviewService} from './esign-request-service.ts';
import {MemoryRequestRepository} from './esign-request-repository.ts';
import {DemoFlow} from './esign-demo-flow.ts';
type Context={service:StoredPreviewService;repository:MemoryRequestRepository;demo:DemoFlow};
type Registry={contexts:Map<string,Context>;links:Map<string,Context>};
// Shared only inside this Node process, including separate Next route bundles.
const processState=globalThis as typeof globalThis&{__malmoimEsignDemo10?:Registry};
function registry(){return processState.__malmoimEsignDemo10??=( {contexts:new Map(),links:new Map()} );}
export function previewContext(actor:string,session:string){
 const state=registry(),key=`${actor}:${session}`;let ctx=state.contexts.get(key);
 if(!ctx){if(state.contexts.size>=50)return undefined;const repository=new MemoryRequestRepository(),service=new StoredPreviewService(repository);ctx={repository,service,demo:new DemoFlow(repository,service,actor)};state.contexts.set(key,ctx);}return ctx;
}
export function bindDemoLink(token:string,ctx:Context){registry().links.set(token,ctx);}
export function demoContext(token:string){return registry().links.get(token);}
export function localDemoGuard(request:Request){
 if(process.env.NODE_ENV!=='development')return new Response(null,{status:404});
 const url=new URL(request.url),host=request.headers.get('host')??url.host;
 try{const origin=new URL(request.headers.get('origin')??'');if(origin.protocol!=='http:'||origin.host!==host||!['127.0.0.1','localhost','[::1]'].includes(origin.hostname))throw new Error();}
 catch{return Response.json({code:'ORIGIN_DENIED'},{status:403});}
 return null;
}
export async function demoJson(request:Request){
 if(!request.headers.get('content-type')?.startsWith('application/json'))throw new Error('INVALID_CONTENT_TYPE');
 const reader=request.body?.getReader();if(!reader)throw new Error('INVALID_JSON');let length=0;const parts:Uint8Array[]=[];
 for(;;){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>250000){await reader.cancel();throw new Error('BODY_TOO_LARGE');}parts.push(value);}
 const bytes=new Uint8Array(length);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}const body=JSON.parse(new TextDecoder().decode(bytes));if(!body||typeof body!=='object')throw new Error('INVALID_JSON');return body;
}
