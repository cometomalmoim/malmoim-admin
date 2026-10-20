'use server';
import {createClient} from '@/lib/supabase/server';
import {getAdminAccess} from '@/lib/auth';
import {reviewInput,type PublicEventReview} from '@/lib/review-validation';
import {revalidatePath} from 'next/cache';
export async function publicEventReviews(slug:string):Promise<PublicEventReview[]>{
 if(!/^[a-z0-9][a-z0-9-]{0,99}$/.test(slug))return [];
 try{const client=await createClient();const result=await client.rpc('public_event_reviews',{p_slug:slug});return result.error?[]:result.data??[];}catch{return [];}
}
export async function saveEventReview(_previous:{code:string},data:FormData):Promise<{code:string}>{
 if((await getAdminAccess()).status!=='admin')return {code:'forbidden'};
 const value=reviewInput(data);if(!value)return {code:'invalid'};
 try{const client=await createClient();const result=await client.rpc('save_event_review',{p_event:value.event,p_id:value.id,p_revision:value.revision,p_name:value.name,p_locale:value.locale,p_body:value.body,p_note:value.note,p_order:value.order,p_published:value.published,p_confirmed:value.confirmed});if(result.error)return {code:'error'};if(result.data==='saved')revalidatePath('/admin','layout');return {code:result.data??'error'};}catch{return {code:'error'};}
}
