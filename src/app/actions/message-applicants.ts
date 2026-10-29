'use server';
import {getAdminAccess} from '@/lib/auth';
import {createClient} from '@/lib/supabase/server';
import {messageNoticeKind,summarizeNoticeHistory} from '@/lib/message-campaigns';
import {applicationStatuses} from '@/lib/applicant-validation';
export type MessagingApplicant={notices?:{kind:string;state:string;title:string}[];history_complete?:boolean;id:string;source:string;event_id:string;name:string;contact:string;contact_type:string;status:string;payment_status:string;preferred_class:string|null;nationality:string|null};
export async function loadMessageApplicants(eventId:string,page:number,search:string,status:string,filters:{payment?:string;group?:string;nationality?:string}={}):Promise<{kind:'ready';rows:MessagingApplicant[];count:number}|{kind:'error'}>{
 if((await getAdminAccess()).status!=='admin'||!/^[-0-9a-f]{36}$/i.test(eventId)||!Number.isSafeInteger(page)||page<1||page>100000)return {kind:'error'};
 try{
  const client=await createClient();
  let request=client.from('event_application_language_list').select('id,source,event_id,name,contact,contact_type,status,payment_status,preferred_class,nationality',{count:'exact'}).eq('is_archived',false).eq('event_id',eventId);
  const q=search.slice(0,100).replace(/[^\p{L}\p{N}\s+@_-]/gu,'').trim();
  if(q)request=request.or(`name.ilike.%${q}%,contact.ilike.%${q}%`);
  if(Object.hasOwn(applicationStatuses,status))request=request.eq('status',status);
  if(['unknown','unpaid','paid','refunded','pending_confirmation'].includes(filters.payment??''))request=request.eq('payment_status',filters.payment!);
  if(['thursday','saturday'].includes(filters.group??''))request=request.eq('preferred_class',filters.group!);
  if(['korean','foreign','unknown'].includes(filters.nationality??''))request=request.eq('nationality_group',filters.nationality!);
  const result=await request.order('created_at',{ascending:false}).order('source').order('id').range((page-1)*25,page*25-1);
  if(result.error)return {kind:'error'};
  const jobs=result.data.length?await client.from('sms_jobs').select('application_id,application_source,state,event_sms_templates(category,title)').eq('event_id',eventId).in('application_id',result.data.map(row=>row.id)).not('template_id','is',null).order('created_at',{ascending:false}).limit(1000):null;
  if(jobs?.error)return {kind:'error'};
  const rows=(result.data as MessagingApplicant[]).map(row=>({...row,history_complete:!jobs||jobs.data.length<1000,notices:summarizeNoticeHistory((jobs?.data??[]).filter(job=>job.application_id===row.id&&job.application_source===row.source).flatMap(job=>{const template=(Array.isArray(job.event_sms_templates)?job.event_sms_templates[0]:job.event_sms_templates) as {category:string;title:string}|null;return template?[{kind:messageNoticeKind(template),state:job.state,title:template.title}]:[];}))}));
  return {kind:'ready',rows,count:result.count??0};
 }catch{return {kind:'error'};}
}
