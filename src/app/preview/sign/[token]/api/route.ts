import {demoContext,localDemoGuard,demoJson} from '@/lib/esign-demo-state';
import {isDemoError} from '@/lib/esign-demo-flow';
export async function POST(request:Request,{params}:{params:Promise<{token:string}>}){
 const guard=localDemoGuard(request);if(guard)return guard;
 try{
  const {token}=await params;const ctx=demoContext(token);if(!ctx)return Response.json({code:'LINK_NOT_FOUND_OR_SERVER_RESTARTED'},{status:404});
  const body=await demoJson(request);const result=await ctx.demo.action(token,request.headers.get('x-esign-demo-session'),body);
  const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer'};
  if(result instanceof Uint8Array)return new Response(result.slice().buffer,{headers:{...headers,'Content-Type':'application/pdf','Content-Disposition':'inline; filename="malmoim-demo.pdf"'}});
  return Response.json(result,{headers});
 }catch(error){const known=isDemoError(error);return Response.json({code:known?error.message:'DEMO_PROCESSING_FAILED'},{status:known?error.status:500});}
}
