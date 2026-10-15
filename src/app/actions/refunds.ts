'use server';
import {getAdminAccess} from '@/lib/auth';
import {createClient} from '@/lib/supabase/server';
import {refundRequestInput,refundUpdateInput} from '@/lib/refund-validation';
import {revalidatePath} from 'next/cache';
export async function requestRefund(slug:string,_previous:{code:string},data:FormData):Promise<{code:string}>{
 if((await getAdminAccess()).status!=='admin')return {code:'forbidden'};
 let input;try{input=refundRequestInput(data);}catch{return {code:'invalid'};}
 try{
  const client=await createClient();
  const result=await client.rpc('create_event_refund_request',{p_slug:slug,p_source:input.source,p_application_id:input.applicationId,p_reason:input.reason,p_requested_at:input.requestedAt});
  if(result.error)return {code:'error'};
  if(result.data?.code==='saved')revalidatePath('/admin','layout');
  return {code:result.data?.code??'error'};
 }catch{return {code:'error'};}
}
export async function updateRefund(slug:string,_previous:{code:string},data:FormData):Promise<{code:string}>{
 if((await getAdminAccess()).status!=='admin')return {code:'forbidden'};
 let input;try{input=refundUpdateInput(data);}catch{return {code:'invalid'};}
 try{
  const client=await createClient();
  const result=await client.rpc('update_event_refund',{p_slug:slug,p_refund_id:input.id,p_action:input.action,p_processed_amount_krw:input.amount,p_transfer_confirmed:input.transferConfirmed});
  if(result.error)return {code:'error'};
  if(result.data?.code==='saved')revalidatePath('/admin','layout');
  return {code:result.data?.code??'error'};
 }catch{return {code:'error'};}
}
