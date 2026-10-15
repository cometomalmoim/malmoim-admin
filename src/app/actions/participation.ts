 'use server';
import {getAdminAccess} from '@/lib/auth';import {createClient} from '@/lib/supabase/server';import {validId,participationInput} from '@/lib/participation-validation';import {revalidatePath} from 'next/cache';
export async function saveParticipation(slug:string,source:string,id:string,mode:'link'|'record',_previous:{code:string},data:FormData):Promise<{code:string}>{
 if((await getAdminAccess()).status!=='admin')return {code:'forbidden'};if(!validId(id)||!['registration','season9','manual'].includes(source))return {code:'invalid'};
 try{const client=await createClient();let result;
 if(mode==='link'){const person=String(data.get('person')??'');const revision=Number(data.get('revision'));if((person&&!validId(person))||!Number.isSafeInteger(revision)||revision<0)return {code:'invalid'};
 result=await client.rpc('link_event_person',{p_slug:slug,p_source:source,p_application:id,p_person:person||null,p_revision:revision,p_identity_confirmed:data.get('identity_confirmed')==='on'});
 }else{const input=participationInput(data);result=await client.rpc('record_event_participation',{p_slug:slug,p_source:source,p_application:id,p_revision:input.revision,p_confirmation:input.confirmation,p_attendance:input.attendance,p_note:input.note});}
 if(result.error)return {code:'error'};const code=typeof result.data==='string'?result.data:result.data?.code;
 if(code==='saved')revalidatePath('/admin','layout');return {code:code??'error'};
 }catch(error){return {code:error instanceof Error&&['invalid','confirmation'].includes(error.message)?error.message:'error'};}}
