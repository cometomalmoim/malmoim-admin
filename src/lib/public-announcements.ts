import 'server-only';
import {cacheLife,cacheTag} from 'next/cache';
import {createPublicClient} from './supabase/public';
import type {CommunityList} from './community-board-model';

async function cachedNotices(search:string,page:number,language:'ko'|'en'):Promise<CommunityList>{
 'use cache';
 cacheLife({stale:30,revalidate:60,expire:300});
 cacheTag('public-announcements');
 // No cookies, user session, admin data, comment counts or keyword aggregation.
 const client=createPublicClient();
 let query=client.from('public_notice_list').select('id,title,content,category,is_pinned,created_at,updated_at,status,view_count,language,images',{count:'exact'})
  .eq('language',language).eq('category','notice').eq('status','public').order('is_pinned',{ascending:false}).order('created_at',{ascending:false}).order('id',{ascending:false});
 if(search)query=query.or(`title.ilike.%${search}%,content.ilike.%${search}%`);
 const result=await query.range((page-1)*20,page*20-1);
 if(result.error)throw new Error('public_announcements_unavailable');
 return {posts:result.data.map(row=>({...row,author_name:'말모임 운영진',can_edit:false,comment_count:0,report_count:null})),total:result.count??0,page,keywords:[],authenticated:false,admin:false,stats:null};
}
export async function publicAnnouncements(search:string,page:number,language:'ko'|'en'='ko'):Promise<CommunityList|null>{
 const safeSearch=search.slice(0,100).replace(/[^\p{L}\p{N}\s_-]/gu,'').trim();
 try{return await cachedNotices(safeSearch,Math.max(1,Math.min(10000,Math.floor(page)||1)),language);}catch{return null;}
}
