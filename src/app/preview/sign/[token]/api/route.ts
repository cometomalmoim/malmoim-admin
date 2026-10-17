import {demoContext,localDemoGuard,demoJson} from '@/lib/esign-demo-state';
import {DemoError} from '@/lib/esign-demo-flow';
export async function POST(request:Request,{params}:{params:Promise<{token:string}>}){
 const guard=localDemoGuard(request);if(guard)return guard;
 try{
  const {token}=await params;const ctx=demoContext(token);if(!ctx)return Response.json({code:'LINK_NOT_FOUND_OR_SERVER_RESTARTED'},{status:404});
  const body=await demoJson(request);const result=await ctx.demo.action(token,request.headers.get('x-esign-demo-session'),body);
  const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer'};
  if(result instanceof Uint8Array)return new Response(result.slice().buffer,{headers:{...headers,'Content-Type':'application/pdf','Content-Disposition':'inline; filename="malmoim-demo.pdf"'}});
  return Response.json(result,{headers});
 }catch(error){return Response.json({code:error instanceof DemoError?error.message:'INVALID_REQUEST_OR_DEMO_FAILED'},{status:error instanceof DemoError?error.status:400});}
}
