 'use server';
import {getAdminAccess} from '@/lib/auth';
import {createClient} from '@/lib/supabase/server';
import {applicantInput} from '@/lib/applicant-validation';
import {revalidatePath} from 'next/cache';
import {applicantDate} from '@/lib/applicant-date';
import {archiveSelection,type ApplicantSelection} from '@/lib/applicant-selection';
export async function archiveApplicants(items:ApplicantSelection[],archived:boolean):Promise<string>{
 if((await getAdminAccess()).status!=='admin')return 'forbidden';
 let selected;try{selected=archiveSelection(items);if(typeof archived!=='boolean')return 'invalid';}catch{return 'invalid';}
 try{const client=await createClient();const result=await client.rpc('archive_event_applications',{p_items:selected,p_archived:archived});
 if(result.error)return 'error';if(result.data==='saved')revalidatePath('/admin','layout');return result.data??'error';}catch{return 'error';}
}
export async function saveApplicantDate(slug:string,source:string,id:string,revision:number,value:string):Promise<{code:string}>{
 if((await getAdminAccess()).status!=='admin')return {code:'forbidden'};
 let date;try{date=applicantDate(value);}catch{return {code:'invalid'};}
 if(!['manual','registration','season9'].includes(source)||!Number.isSafeInteger(revision)||revision<0||!/^[0-9a-f-]{36}$/i.test(id))return {code:'invalid'};
 try{const client=await createClient();const result=await client.rpc('correct_event_application_date',{p_slug:slug,p_source:source,p_id:id,p_revision:revision,p_date:date});
 if(result.error)return {code:'error'};
 if(result.data?.code==='saved')revalidatePath('/admin','layout');
 return {code:result.data?.code??'error'};}catch{return {code:'error'};}
}
export async function saveApplicant(slug:string,_previous:{code:string},data:FormData):Promise<{code:string}>{
 if((await getAdminAccess()).status!=='admin')return {code:'forbidden'};
 let input;try{input=applicantInput(data);}catch{return {code:'invalid'};}
 try{const client=await createClient();const result=await client.rpc('manage_event_application',{p_slug:slug,p_source:input.source,p_id:input.id,p_revision:input.revision,p_name:input.name,p_contact:input.contact,p_contact_type:input.contact_type,p_birth_year:input.birth_year,p_nationality:input.nationality,p_status:input.status,p_payment:input.payment,p_note:input.note,p_source_note:input.source_note});
 if(result.error)return {code:'error'};
 if(result.data?.code==='saved')revalidatePath('/admin','layout');
 return {code:result.data?.code??'error'};}catch{return {code:'error'};}
}
