 'use server';
import {getAdminAccess} from '@/lib/auth';
import {createClient} from '@/lib/supabase/server';
import {revalidatePath} from 'next/cache';
import {sessionInput,sessionAttendanceInput} from '@/lib/session-validation';
import {validId} from '@/lib/participation-validation';
export async function saveEventSession(slug:string,_previous:{code:string},data:FormData):Promise<{code:string}>{
 if((await getAdminAccess()).status!=='admin')return {code:'forbidden'};
 try{const input=sessionInput(data),client=await createClient();const result=await client.rpc('manage_event_session',{p_slug:slug,p_id:input.id,p_revision:input.revision,p_date:input.date,p_title:input.title});
 if(result.error)return {code:'error'};const code=result.data?.code??'error';if(code==='saved')revalidatePath('/admin','layout');return {code};
 }catch{return {code:'invalid'};}
}
export async function saveSessionAttendance(slug:string,source:string,id:string,data:FormData):Promise<{code:string}>{
 if((await getAdminAccess()).status!=='admin')return {code:'forbidden'};
 if(!validId(id)||!['manual','registration','season9'].includes(source))return {code:'invalid'};
 try{const input=sessionAttendanceInput(data),client=await createClient();const result=await client.rpc('record_session_attendance',{p_slug:slug,p_source:source,p_application:id,p_session:input.session,p_revision:input.revision,p_participation_revision:input.participationRevision,p_attendance:input.attendance});
 if(result.error)return {code:'error'};const code=typeof result.data==='string'?result.data:'error';if(code==='saved')revalidatePath('/admin','layout');return {code};
 }catch{return {code:'invalid'};}
}
