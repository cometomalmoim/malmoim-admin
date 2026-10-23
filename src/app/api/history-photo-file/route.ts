import {connection} from 'next/server';
import {getAdminAccess} from '@/lib/auth';
import {simplePhotosEnabled} from '@/lib/history-simple/policy';
import {fileResponse} from '@/lib/history-simple/server';
export async function GET(request:Request){await connection();const u=new URL(request.url),admin=u.searchParams.get('admin')==='1';if(!simplePhotosEnabled())return new Response(null,{status:503,headers:{'Cache-Control':'no-store'}});if(admin&&(await getAdminAccess()).status!=='admin')return new Response(null,{status:403,headers:{'Cache-Control':'no-store'}});try{return await fileResponse(u.searchParams.get('id')??'',admin);}catch{return new Response(null,{status:503,headers:{'Cache-Control':'no-store'}});}}
