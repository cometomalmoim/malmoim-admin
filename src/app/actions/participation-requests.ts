'use server';
import {createPublicClient} from '@/lib/supabase/public';
import {createClient} from '@/lib/supabase/server';
import {getAdminAccess} from '@/lib/auth';
import {participationInput,requestId,requestToken,requestStatuses,sessionInput,type ParticipationInfo} from '@/lib/participation-requests';
import {revalidatePath} from 'next/cache';
export type ParticipationState={code:string;token?:string};
export async function participationInfo():Promise<ParticipationInfo> {
 try{const db=createPublicClient(),r=await db.rpc('community_participation_info');if(!r.error&&r.data)return {available:true,...r.data};}catch{}
 return {available:false,exchange_open:false,sessions:[]};
}
export async function submitParticipation(_state:ParticipationState,form:FormData):Promise<ParticipationState> {
 const p=participationInput(form);if(!p)return {code:'invalid'};
 try{const db=createPublicClient();const r=await db.rpc('submit_community_request',{p_kind:p.kind,p_token:p.token,p_name:p.name,p_contact_type:p.contactType,p_contact:p.contact,p_locale:p.locale,p_session:p.sessionId,p_details:p.details,p_consent:true});
 if(r.error)return {code:'error'};if(r.data==='saved'){revalidatePath('/admin','layout');return {code:'saved',token:p.token};}return {code:['closed','full','duplicate','rate_limited','invalid'].includes(r.data)?r.data:'error'};
 }catch{return {code:'error'};}
}
export type ParticipationReceipt={kind:string;name:string;status:string;message:string;created_at:string;locale:string;session:{title:string;starts_at:string;location:string;fee:number}|null};
export async function readParticipation(token:string):Promise<{code:string;item?:ParticipationReceipt}> {
 if(!requestToken(token))return {code:'missing'};
 try{const r=await createPublicClient().rpc('read_community_request',{p_token:token});return r.error?{code:'error'}:r.data?{code:'ready',item:r.data}:{code:'missing'};}catch{return {code:'error'};}
}
export async function cancelParticipation(token:string):Promise<{code:string}> {
 if(!requestToken(token))return {code:'missing'};
 try{const r=await createPublicClient().rpc('cancel_community_request',{p_token:token});return {code:r.error?'error':r.data??'error'};}catch{return {code:'error'};}
}
export async function saveDailySession(_state:ParticipationState,form:FormData):Promise<ParticipationState> {
 if((await getAdminAccess()).status!=='admin')return {code:'forbidden'};
 const p=sessionInput(form);if(!p||Date.parse(p.closes_at)<=Date.now())return {code:'invalid'};
 try{const r=await (await createClient()).from('community_daily_sessions').insert({...p,is_open:true});if(r.error)return {code:'error'};revalidatePath('/admin','layout');return {code:'saved'};}catch{return {code:'error'};}
}
export async function updateParticipation(_state:ParticipationState,form:FormData):Promise<ParticipationState> {
 if((await getAdminAccess()).status!=='admin')return {code:'forbidden'};
 const id=String(form.get('id')??''),status=String(form.get('status')??''),message=String(form.get('message')??'').trim(),revision=Number(form.get('revision'));
 if(!requestId(id)||!requestStatuses.some(s=>s===status)||message.length>1000||!Number.isSafeInteger(revision)||revision<0)return {code:'invalid'};
 try{const r=await (await createClient()).rpc('manage_community_request',{p_id:id,p_revision:revision,p_status:status,p_message:message});if(r.error)return {code:'error'};if(r.data==='saved')revalidatePath('/admin','layout');return {code:r.data??'error'};}catch{return {code:'error'};}
}
export async function toggleParticipation(_state:ParticipationState,form:FormData):Promise<ParticipationState> {
 if((await getAdminAccess()).status!=='admin')return {code:'forbidden'};
 const target=String(form.get('target')??''),open=form.get('open')==='true';
 try{const db=await createClient();const r=target==='exchange'?await db.from('community_participation_settings').update({exchange_open:open}).eq('id',1):requestId(target)?await db.from('community_daily_sessions').update({is_open:open}).eq('id',target):null;
 if(!r||r.error)return {code:'error'};revalidatePath('/admin','layout');return {code:'saved'};}catch{return {code:'error'};}
}
