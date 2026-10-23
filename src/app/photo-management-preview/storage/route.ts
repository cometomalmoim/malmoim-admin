import {NextRequest,NextResponse} from 'next/server';
import {developmentBroker,developmentPhotoCookie,developmentStorage} from '@/lib/history-activities/development-storage';
// Node.js is the default; cacheComponents disallows an explicit runtime segment config.
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
const local=(r:NextRequest)=>process.env.NODE_ENV==='development'&&r.headers.get('host')==='127.0.0.1:3004';
export async function GET(r:NextRequest){
 if(!local(r))return reply({status:'disabled'},404);
 const session=r.cookies.get(developmentPhotoCookie)?.value;if(!session)return reply({status:'denied'},401);
 try{
 // Broker reauthenticates user and administrator on every read. No public fallback.
 return reply(await developmentBroker({op:'list',session}));}catch{return reply({status:'unavailable'},403);}
}
export async function POST(r:NextRequest){
 if(!local(r)||r.headers.get('origin')!=='http://127.0.0.1:3004')return reply({status:'denied'},403);
 if(!r.headers.get('content-type')?.startsWith('application/json'))return reply({status:'invalid'},415);
 try{
 const raw=await r.text();if(raw.length>16000)return reply({status:'invalid'},413);const b=JSON.parse(raw);
 if(b.op==='login'){
 if(Object.keys(b).sort().join(',')!=='email,op,password'||typeof b.email!=='string'||typeof b.password!=='string')return reply({status:'invalid'},400);
 const result=await developmentBroker<{session:string}>({op:'login',email:b.email,password:b.password});
 const res=reply({status:'authenticated'});res.cookies.set(developmentPhotoCookie,result.session,{httpOnly:true,sameSite:'strict',path:'/photo-management-preview',maxAge:1800,secure:false});return res;
 }
 const session=r.cookies.get(developmentPhotoCookie)?.value;if(!session)return reply({status:'denied'},401);
 if(b.op==='permit'){
 if(Object.keys(b).sort().join(',')!=='op,photoId'||typeof b.photoId!=='string'||!/^[a-f0-9-]{36}$/.test(b.photoId))return reply({status:'invalid'},400);
 // Administrator and server-owned exact temporary path checked in private broker.
 return reply(await developmentBroker({op:'permit',session,photoId:b.photoId}));
 }
 if(b.op!=='command'||Object.keys(b).sort().join(',')!=='command,op')return reply({status:'invalid'},400);
 const adapter=await developmentStorage(session);const result=await adapter.execute(null,b.command);
 return reply(result,result.status==='recorded'?200:409);
 }catch{return reply({status:'needs_confirmation'},409);}
}
