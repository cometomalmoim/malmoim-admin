import {createClient} from '@/lib/supabase/server';
import {uuid} from '@/lib/community-board-model';
export async function GET(_request:Request,{params}:{params:Promise<{owner:string;file:string}>}){
 const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
 const {owner,file}=await params;
 if(!uuid(owner)||!file.endsWith('.webp')||!uuid(file.slice(0,-5)))return new Response(null,{status:404,headers});
 try{const client=await createClient();const result=await client.storage.from('announcement-images').download(owner+'/'+file);if(result.error)return new Response(null,{status:404,headers});return new Response(result.data,{headers:{...headers,'Content-Type':'image/webp'}});}catch{return new Response(null,{status:503,headers});}
}
