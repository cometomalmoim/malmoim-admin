import 'server-only';
import {getAdminAccess} from './auth';
import {createClient} from './supabase/server';
import type {RefundRow} from './refund-validation';
export async function getApplicantRefunds(slug:string,applicants:{id:string;source:string}[]):Promise<{kind:'ready';rows:RefundRow[]}|{kind:'error'}>{
 if((await getAdminAccess()).status!=='admin')return {kind:'error'};
 if(!applicants.length)return {kind:'ready',rows:[]};
 try{
  const client=await createClient();
  const {data,error}=await client.from('event_application_refunds')
   .select('id,source,application_id,reason,requested_at,status,decision_by,decision_at,processed_amount_krw,processed_by,processed_at,created_by,recruitment_events!inner(slug)')
   .eq('recruitment_events.slug',slug).in('application_id',applicants.map(row=>row.id))
   .order('requested_at',{ascending:false}).order('id',{ascending:false});
  if(error)return {kind:'error'};
  return {kind:'ready',rows:(data as RefundRow[]).filter(row=>applicants.some(a=>a.id===row.application_id&&a.source===row.source))};
 }catch{return {kind:'error'};}
}
