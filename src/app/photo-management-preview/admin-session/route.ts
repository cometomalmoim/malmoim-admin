import {NextRequest,NextResponse} from 'next/server';
import {developmentBroker,developmentPhotoCookie} from '@/lib/history-activities/development-storage';
import {isPhotoLabRequest} from '@/lib/history-activities/development-target';
import type {Access} from '@/lib/auth';
/** Same verified Supabase token copied to a narrow cookie path, not a new login.
 * Fixed redirect and same-origin POST only. No browser-supplied actor/privilege. */
export async function POST(r:NextRequest){
 const deny=(status:number)=>NextResponse.json({status:'denied'},{status,headers:{'Cache-Control':'private, no-store'}});
 if(!isPhotoLabRequest(process.env.NODE_ENV,r.headers.get('host'))||r.headers.get('origin')!=='http://127.0.0.1:3004')return deny(403);
 const session=r.cookies.get(developmentPhotoCookie)?.value;if(!session)return deny(401);
 try{
  const access=await developmentBroker<Access>({op:'page_access',session});if(access.status!=='admin')return deny(403);
  const response=NextResponse.redirect(new URL('/admin/history-photos','http://127.0.0.1:3004'),303);
  response.headers.set('Cache-Control','private, no-store');
  response.cookies.set(developmentPhotoCookie,session,{httpOnly:true,sameSite:'strict',path:'/admin/history-photos',maxAge:1800,secure:false});
  // Separate exact-page cookie: never widen the lab session to /admin or /.
  response.headers.append('Set-Cookie',`${developmentPhotoCookie}=${encodeURIComponent(session)}; Path=/admin/history; Max-Age=1800; HttpOnly; SameSite=Strict`);
  return response;
 }catch{return deny(403);}
}
