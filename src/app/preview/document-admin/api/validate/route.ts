import { StoredPreviewService, type StoredCommand } from '@/lib/esign-request-service';
import { MemoryRequestRepository } from '@/lib/esign-request-repository';
const sessions=new Map<string,{service:StoredPreviewService}>();
export async function POST(request:Request){
 if(process.env.NODE_ENV!=='development')return new Response(null,{status:404});
 const url=new URL(request.url);
 const host=request.headers.get('host')??url.host;
 let origin:URL;try{origin=new URL(request.headers.get('origin')??'');}catch{return Response.json({code:'ORIGIN_DENIED'},{status:403});}
 if(!['127.0.0.1','localhost','[::1]'].includes(origin.hostname)||origin.host!==host||origin.protocol!=='http:')return Response.json({code:'ORIGIN_DENIED'},{status:403});
 const credential=request.headers.get('x-esign-test-actor');
 if(!['fixture-admin','fixture-limited'].includes(credential??''))return Response.json({code:'UNAUTHENTICATED'},{status:401});
 const session=request.headers.get('x-esign-test-session');
 if(!session||!/^[-a-zA-Z0-9]{16,80}$/.test(session))return Response.json({code:'INVALID_TEST_SESSION'},{status:400});
 if(!request.headers.get('content-type')?.startsWith('application/json'))return Response.json({code:'INVALID_CONTENT_TYPE'},{status:415});
 const reader=request.body?.getReader();if(!reader)return Response.json({code:'INVALID_JSON'},{status:400});
 let size=0;const chunks:Uint8Array[]=[];
 for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>16000){await reader.cancel();return Response.json({code:'BODY_TOO_LARGE'},{status:413});}chunks.push(value);}
 let input:StoredCommand;try{const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}input=JSON.parse(new TextDecoder().decode(bytes));if(!input||typeof input!=='object')throw new Error();}catch{return Response.json({code:'INVALID_JSON'},{status:400});}
 // No TTL eviction: refresh can retrieve rows for this server process lifetime.
 const key=`${credential}:${session}`;let state=sessions.get(key);if(!state){if(sessions.size>=50)return Response.json({code:'PREVIEW_CAPACITY'},{status:429});state={service:new StoredPreviewService(new MemoryRequestRepository())};sessions.set(key,state);}
 const result=await state.service.execute(credential,input);return Response.json(result.body,{status:result.http,headers:{'Cache-Control':'no-store'}});
}
