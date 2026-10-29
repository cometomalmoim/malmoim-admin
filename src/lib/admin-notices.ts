import 'server-only';
import {getAdminAccess} from './auth';
import {createClient} from './supabase/server';
import {uuid,type CommunityList,type CommunityQuery} from './community-board-model';
export async function noticeEvents(){
 if((await getAdminAccess()).status!=='admin')throw new Error('관리자 권한이 필요합니다.');
 const client=await createClient();const result=await client.from('recruitment_events').select('id,title').order('created_at',{ascending:false});
 if(result.error)throw new Error('이벤트 목록을 불러오지 못했습니다.');return result.data as {id:string;title:string}[];
}
export async function adminNoticeFeed(query:CommunityQuery&{event?:string}):Promise<CommunityList|null>{
 if((await getAdminAccess()).status!=='admin')return null;
 try{
  const client=await createClient();let request=client.from('board_posts').select('id,title,content,category,author_name,created_at,updated_at,view_count,is_pinned,status,language,images,event_id',{count:'exact'}).eq('category','notice').order('is_pinned',{ascending:false}).order('created_at',{ascending:false}).order('id',{ascending:false});
  request=query.status==='all'?request.neq('status','deleted'):request.eq('status',query.status);
  if(query.event==='common')request=request.is('event_id',null);else if(query.event){if(!uuid(query.event))return null;request=request.eq('event_id',query.event);}
  const search=query.q.replace(/[^\p{L}\p{N}\s_-]/gu,'').trim();if(search)request=request.or(`title.ilike.%${search}%,content.ilike.%${search}%`);
  const result=await request.range((query.page-1)*20,query.page*20-1);if(result.error)return null;
  return {posts:result.data.map(post=>({...post,can_edit:post.status!=='deleted',comment_count:0,report_count:null})),total:result.count??0,page:query.page,keywords:[],authenticated:true,admin:true,stats:null};
 }catch{return null;}
}
