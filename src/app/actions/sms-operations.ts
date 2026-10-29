'use server';
import {getAdminAccess} from '@/lib/auth';
import {createClient} from '@/lib/supabase/server';
import {smsUuid} from '@/lib/sms-contract';
import {smsPurposes} from '@/lib/sms-purpose';
import {eventSmsLogs} from './event-sms';
async function db(){if((await getAdminAccess()).status!=='admin')throw new Error('관리자 권한이 필요합니다.');return createClient();}
export async function registerSmsOperation(operation:string,batches:string[]){
 const client=await db();if(!smsUuid(operation)||!Array.isArray(batches)||!batches.length||batches.length>50||!batches.every(smsUuid))throw new Error('발송 작업 선택 오류');
 const result=await client.rpc('register_sms_send_operation',{p_operation:operation,p_batches:batches});if(result.error)throw new Error('발송 작업을 등록하지 못했습니다. 최신 미리보기를 확인해주세요.');
}
export type SmsOperation={operation_id:string;event_id:string|null;title:string;purposes:string[];created_at:string;sent_at:string|null;total:number;completed:number;delivered:number;failed:number;waiting:number;cancelled:number;has_activity:boolean};
export async function smsOperations(filters:{event?:string;purpose?:string;search?:string;date?:string;until?:string;attention?:boolean;drafts?:boolean;page?:number}){
 const client=await db();let q=client.from('sms_operation_list').select('operation_id,event_id,title,purposes,created_at,sent_at,total,completed,delivered,failed,waiting,cancelled,has_activity',{count:'exact'}).order('sort_at',{ascending:false}).order('operation_id');
 if(filters.event){if(!smsUuid(filters.event))throw new Error('이벤트 오류');q=q.eq('event_id',filters.event);}
 if(filters.purpose){if(!Object.hasOwn(smsPurposes,filters.purpose))throw new Error('안내 종류 오류');q=q.contains('purposes',[filters.purpose]);}
 let search=(filters.search??'').slice(0,100).replace(/[^\p{L}\p{N}\s+@_-]/gu,'').trim();if(/^[+\d\s()-]+$/.test(search))search=search.replace(/\D/g,'').replace(/^82(?=10)/,'0');if(search)q=q.ilike('search_text','%'+search+'%');
 if(!filters.drafts)q=q.eq('has_activity',true);
 if(filters.attention)q=q.or('failed.gt.0,waiting.gt.0');
 if(/^\d{4}-\d{2}-\d{2}$/.test(filters.date??''))q=q.gte('sort_at',filters.date+'T00:00:00+09:00');
 if(/^\d{4}-\d{2}-\d{2}$/.test(filters.until??''))q=q.lt('sort_at',new Date(new Date(filters.until+'T00:00:00+09:00').getTime()+86400000).toISOString());
 const page=Math.max(0,Math.min(10000,Math.floor(filters.page??0)));const r=await q.range(page*20,page*20+19);if(r.error)throw new Error('발송 작업 기록을 불러오지 못했습니다.');return {rows:r.data as SmsOperation[],count:r.count??0};
}
export async function smsOperationDetails(operation:string){
 const client=await db();if(!smsUuid(operation))throw new Error('발송 작업 오류');
 const batches=await client.from('sms_batches').select('id').or(`id.eq.${operation},operation_id.eq.${operation}`);if(batches.error)throw new Error('발송 작업 조회 오류');
 if(batches.data.length){const ids=batches.data.map(row=>row.id);const rows=[];let count=0;for(let page=0;page<100;page++){const result=await eventSmsLogs({batches:ids,page});count=result.count;rows.push(...result.rows);if(rows.length>=count)return {rows,count};}throw new Error('발송 대상이 너무 많습니다.');}
 const result=await client.from('sms_jobs').select('id,applicant_name,recipient,body,state,failure_reason,language,message_type,created_at').eq('id',operation);if(result.error)throw new Error('발송 기록 조회 오류');return {rows:result.data,count:result.data.length};
}
