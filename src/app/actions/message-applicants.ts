'use server';
import {getAdminAccess} from '@/lib/auth';
import {createClient} from '@/lib/supabase/server';
import {applicationStatuses} from '@/lib/applicant-validation';
export type MessagingApplicant={id:string;source:string;name:string;contact:string;contact_type:string;status:string};
export async function loadMessageApplicants(eventId:string,page:number,search:string,status:string):Promise<{kind:'ready';rows:MessagingApplicant[];count:number}|{kind:'error'}>{
 if((await getAdminAccess()).status!=='admin'||!/^[-0-9a-f]{36}$/i.test(eventId)||!Number.isSafeInteger(page)||page<1||page>100000)return {kind:'error'};
 try{
  const client=await createClient();
  let request=client.from('event_application_list').select('id,source,name,contact,contact_type,status',{count:'exact'}).eq('event_id',eventId);
  const q=search.slice(0,100).replace(/[^\p{L}\p{N}\s+@_-]/gu,'').trim();
  if(q)request=request.or(`name.ilike.%${q}%,contact.ilike.%${q}%`);
  if(Object.hasOwn(applicationStatuses,status))request=request.eq('status',status);
  const result=await request.order('created_at',{ascending:false}).order('source').order('id').range((page-1)*25,page*25-1);
  if(result.error)return {kind:'error'};
  return {kind:'ready',rows:result.data as MessagingApplicant[],count:result.count??0};
 }catch{return {kind:'error'};}
}
