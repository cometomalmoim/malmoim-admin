 'use server';
import {getAdminAccess} from '@/lib/auth';import {createClient} from '@/lib/supabase/server';import {revalidatePath} from 'next/cache';
export async function archiveEvent(slug:string,revision:number,archived:boolean):Promise<{code:string}>{
 if((await getAdminAccess()).status!=='admin')return {code:'forbidden'};
 if(!slug||slug.length>200||!Number.isSafeInteger(revision)||revision<0||typeof archived!=='boolean')return {code:'invalid'};
 try{const client=await createClient();const result=await client.rpc('archive_recruitment_event',{p_slug:slug,p_revision:revision,p_archived:archived});if(result.error)return {code:'error'};const code=typeof result.data==='string'?result.data:'error';if(code==='saved')revalidatePath('/admin','layout');return {code};}catch{return {code:'error'};}
}
