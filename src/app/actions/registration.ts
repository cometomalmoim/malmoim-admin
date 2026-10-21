 'use server';
import {registrationReceipt,type MetaRegistrationReceipt} from '@/lib/meta-registration-receipt';
import {after} from 'next/server';
import {processSmsQueue} from '@/lib/sms-worker';
import {createClient} from '@/lib/supabase/server';
import {getAdminAccess} from '@/lib/auth';
import {readAttribution} from '@/lib/attribution';
import {registrationInput} from '@/lib/registration-validation';
import {revalidatePath} from 'next/cache';
export async function registrationInfo(slug:string,test=false):Promise<{open:boolean;unavailable?:boolean;notice?:string;version?:string;marketingNotice?:string}> {
 if(test&&(await getAdminAccess()).status!=='admin')return {open:false};
 if(!test&&slug!=='halloween-2026')return {open:false};
 try {const client=await createClient();const result=await client.rpc('event_registration_info',{p_slug:slug,p_test:test});return result.error?{open:false,unavailable:true}:result.data??{open:false};}catch{return {open:false,unavailable:true};}
}
export async function registerEvent(slug:string,test:boolean,_previous:{code:string},data:FormData):Promise<{code:string;conversion?:MetaRegistrationReceipt}> {
 if(test&&(await getAdminAccess()).status!=='admin')return {code:'closed'};
 if(!test&&slug!=='halloween-2026')return {code:'closed'};
 if(String(data.get('website')??''))return {code:'invalid'};
 let input;try{input=registrationInput(data,!test&&slug==='halloween-2026');}catch(error){return {code:error instanceof Error?error.message:'invalid'};}
 try{const client=await createClient();const attribution=readAttribution(new URLSearchParams({utm_source:String(data.get('utm_source')??''),utm_medium:String(data.get('utm_medium')??''),utm_campaign:String(data.get('utm_campaign')??'')}));const result=await client.rpc('submit_event_registration_with_nationality',{p_slug:slug,p_test:test,p_submission:input.submission,p_name:input.name,p_contact:input.contact,p_history:input.history,p_detail:input.detail,p_consent:true,p_version:input.version,p_marketing:data.get('marketing_consent')==='on',p_utm_source:attribution.utm_source,p_utm_medium:attribution.utm_medium,p_utm_campaign:attribution.utm_campaign,p_birth_year:input.birth_year,p_nationality:input.nationality});
 if(result.error)return {code:'error'};
 if(result.data==='saved'){if(!test){try{after(async()=>{try{await processSmsQueue(client);}catch{/* Preserve successful application. */}});}catch{/* Receipt already committed. */}}revalidatePath('/admin','layout');}
 return {code:typeof result.data==='string'?result.data:'error',...(!test&&result.data==='saved'?{conversion:registrationReceipt('halloween-2026',input.submission,data.get('application_language'))}:{})};
 }catch{return {code:'error'};}
}
