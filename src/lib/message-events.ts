import 'server-only';
import {getAdminAccess} from './auth';
import {createClient} from './supabase/server';
import type {RegisteredMessageEvent} from '@/components/admin/message-preview';

export async function getMessageEvents():Promise<{kind:'ready';events:RegisteredMessageEvent[]}|{kind:'error'}>{
 if((await getAdminAccess()).status!=='admin')return {kind:'error'};
 try{
  const client=await createClient();
  const events:RegisteredMessageEvent[]=[];
  // Supabase caps rows per response. Page through the list rather than silently dropping events.
  for(let offset=0;;offset+=100){
   const result=await client.from('recruitment_events').select('id,slug,title,fee_notice,starts_at,location,status').eq('is_archived',false).order('created_at',{ascending:false}).order('id',{ascending:false}).range(offset,offset+99);
   if(result.error)return {kind:'error'};
   const rows=result.data as RegisteredMessageEvent[];
   events.push(...rows);
   if(rows.length<100)return {kind:'ready',events};
  }
 }catch{return {kind:'error'};}
}
