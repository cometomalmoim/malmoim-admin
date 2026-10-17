import 'server-only';
import {getAdminAccess} from './auth';
import {createClient} from './supabase/server';
import {validId} from './participation-validation';
export type SessionOverviewQuery={view?:string;event?:string;from?:string;to?:string;pending?:string;page?:string};
export type SessionOverviewRow={id:string;session_date:string;title:string;event_id:string;event_slug:string;event_title:string;is_test:boolean;application_count:number;confirmed_count:number;attended_count:number;absent_count:number;no_show_count:number;unrecorded_count:number;unlinked_count:number};
function date(value?:string){return !!value&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;}
export async function sessionOverview(query:SessionOverviewQuery){
 if((await getAdminAccess()).status!=='admin')return {kind:'error' as const};
 if((query.event&&!validId(query.event))||(query.from&&!date(query.from))||(query.to&&!date(query.to))||(query.from&&query.to&&query.from>query.to))return {kind:'invalid' as const};
 try{const client=await createClient();const page=Math.min(100000,Math.max(1,Math.floor(Number(query.page)||1)));
 let request=client.from('event_session_overview').select('*',{count:'exact'});
 if(query.event)request=request.eq('event_id',query.event);if(query.from)request=request.gte('session_date',query.from);if(query.to)request=request.lte('session_date',query.to);if(query.pending==='1')request=request.gt('unrecorded_count',0);
 const [events,result]=await Promise.all([client.from('recruitment_events').select('id,title').order('created_at',{ascending:false}),request.order('session_date',{ascending:false}).order('id').range((page-1)*20,page*20-1)]);
 if(events.error||result.error)return {kind:'error' as const};return {kind:'ready' as const,rows:result.data as SessionOverviewRow[],events:events.data,count:result.count??0,page};
 }catch{return {kind:'error' as const};}
}
