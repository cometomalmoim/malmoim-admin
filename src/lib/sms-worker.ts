import 'server-only';
import {Buffer} from 'node:buffer';
import type {SupabaseClient} from '@supabase/supabase-js';
import {smsConfig,sendSms} from './solapi';
export async function processSmsQueue(client:SupabaseClient,batch:string|null=null,limit=3){
 const config=smsConfig();if(!config)return;
 for(let i=0;i<limit;i++){
  const {data,error}=await client.rpc('sms_claim',{p_token:config.worker,p_batch:batch});
  if(error||!data?.length)return;
  const job=data[0];
  let state='unknown',group:string|null=null;
  try{group=await sendSms(job.kind==='notification'?config.notify:job.recipient,job.body,job.kind==='notification'?(Buffer.byteLength(job.body,'utf8')<=90?'SMS':'LMS'):(job.message_type??'LMS'),job.id);state='accepted';}
  catch(error){state=error instanceof Error&&error.message==='sms_rejected'?'failed':'unknown';}
  // Never retry a request with an ambiguous provider outcome. SQL limits and claims prevent double sends.
  await client.rpc('sms_finish',{p_token:config.worker,p_id:job.id,p_state:state,p_group:group});
 }
}
