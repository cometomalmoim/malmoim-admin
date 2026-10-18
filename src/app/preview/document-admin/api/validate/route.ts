import { type StoredCommand } from '@/lib/esign-request-service';
import {fixtureAuth} from '@/lib/esign-preview-server';
import {previewContext,bindDemoLink} from '@/lib/esign-demo-state';
import {isDemoError} from '@/lib/esign-demo-flow';
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
 let input:StoredCommand | {operation:'demo-link'|'demo-status'|'demo-pdf';eventId:string;requestId:string};try{const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}input=JSON.parse(new TextDecoder().decode(bytes));if(!input||typeof input!=='object')throw new Error();}catch{return Response.json({code:'INVALID_JSON'},{status:400});}
 const ctx=previewContext(credential!,session);if(!ctx)return Response.json({code:'PREVIEW_CAPACITY'},{status:429});
 if(!fixtureAuth.authenticate(credential)?.events.includes(input.eventId))return Response.json({code:'EVENT_FORBIDDEN'},{status:403});
 try{
  if(input.operation==='demo-link'){
   const link=await ctx.demo.issue(input.requestId,input.eventId);bindDemoLink(link.token,ctx);
   return Response.json({code:'DEVELOPMENT_TEST_LINK',path:`/preview/sign/${link.token}`,verificationCode:link.code},{headers:{'Cache-Control':'no-store'}});
  }
  if(input.operation==='demo-status'||input.operation==='demo-pdf'){
   if(!await ctx.repository.get(input.requestId,[input.eventId]))return Response.json({code:'REQUEST_NOT_FOUND'},{status:404});
   if(input.operation==='demo-pdf')return new Response((await ctx.demo.adminPdf(input.requestId)).buffer as ArrayBuffer,{headers:{'Content-Type':'application/pdf','Content-Disposition':'inline; filename="malmoim-demo-completed.pdf"','Cache-Control':'no-store'}});
   return Response.json(await ctx.demo.summary(input.requestId),{headers:{'Cache-Control':'no-store'}});
  }
  const result=await ctx.service.execute(credential,input);return Response.json(result.body,{status:result.http,headers:{'Cache-Control':'no-store'}});
 }catch(error){const known=isDemoError(error);return Response.json({code:known?error.message:'DEMO_PROCESSING_FAILED'},{status:known?error.status:500});}
}
