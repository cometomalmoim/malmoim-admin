import 'server-only';
import { getAdminAccess } from './auth';
import { createClient } from './supabase/server';
import { validUuid } from './resource-validation';
export type ResourceFile={id:string;resource_id:string;original_name:string;size_bytes:number;state:string};
export type ResourceRow={id:string;title:string;kind:string;event_id:string|null;season:number|null;session_number:number|null;cumulative_week:number|null;topic:string;description:string;external_url:string;author_email:string;created_at:string;updated_at:string;resource_files:ResourceFile[]};
export type ResourceQuery={q?:string;kind?:string;event?:string;season?:string;session?:string;page?:string;order?:string};
export async function resourceData(query:ResourceQuery={},id?:string,slug?:string){
 if((await getAdminAccess()).status!=='admin') return {error:true as const};
 const client=await createClient();
 const events=await client.from('recruitment_events').select('id,slug,title').order('created_at',{ascending:false});
 if(events.error)return {error:true as const};
 const event=slug ? events.data.find(e=>e.slug===slug):undefined;
 if(slug&&!event)return {missing:true as const};
 if(id&&!validUuid(id))return {missing:true as const};
 let request=client.from('resources').select('*,resource_files(*)',{count:'exact'});
 if(id) request=request.eq('id',id);
 if(event) request=request.eq('event_id',event.id);
 else if(query.event&&validUuid(query.event))request=request.eq('event_id',query.event);
 if(['english','korean','common'].includes(query.kind??''))request=request.eq('kind',query.kind!);
 const search=(query.q??'').slice(0,100).replace(/[^\p{L}\p{N}\s-]/gu,'').trim();
 if(search)request=request.or(`title.ilike.%${search}%,topic.ilike.%${search}%`);
 for(const [key,column] of [['season','season'],['session','session_number']] as const){if(/^\d{1,6}$/.test(query[key]??''))request=request.eq(column,Number(query[key]));}
 const page=Math.min(100000,Math.max(1,Number(query.page)||1))|0;
 const result=await request.order('created_at',{ascending:query.order==='oldest'}).order('id').range((page-1)*20,page*20-1);
 if(result.error)return {error:true as const};
 if(id&&!result.data.length)return {missing:true as const};
 return {ready:true as const,rows:result.data as ResourceRow[],events:events.data,event,count:result.count??0,page};
}
