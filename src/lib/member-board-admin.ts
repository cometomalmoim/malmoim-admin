import "server-only";
import {getAdminAccess} from "./auth";
import {createClient} from "./supabase/server";
import {uuid} from "./community-board-model";
import {filterReports,type AdminBoardQuery,type AdminReport,type AdminLog} from "./member-board-admin-model";
import {sortAdminLogs} from "./member-board-timeline";

const postFields="id,category,title,content,author_name,status,updated_at";
const reportFields=`id,post_id,comment_id,reason,detail,original_content,status,created_at,updated_at,post:board_posts!board_reports_post_id_fkey(${postFields}),comment:board_comments!board_reports_comment_id_fkey(id,post_id,content,author_name,status,updated_at,post:board_posts!board_comments_post_id_fkey(${postFields}))`;
const logFields="id,actor_id,post_id,comment_id,report_id,action,reason,created_at";
export async function adminBoardStats(){
 if((await getAdminAccess()).status!=="admin")return null;
 try{
  const client=await createClient();
  const results=await Promise.all([
   client.from("board_posts").select("id",{count:"exact",head:true}),
   client.from("board_reports").select("id",{count:"exact",head:true}).in("status",["pending","reviewing"]),
   client.from("board_posts").select("id",{count:"exact",head:true}).eq("status","hidden"),
   client.from("board_posts").select("id",{count:"exact",head:true}).eq("is_pinned",true).neq("status","deleted"),
  ]);
  if(results.some(r=>r.error||r.count===null))return null;
  return results.map(r=>r.count!);
 }catch{return null;}
}
// Existing RPC has no global report feed. Read through the authenticated client/RLS;
// never select reporter_id, Auth users, or use a service-role credential.
export async function adminReports(query:AdminBoardQuery){
 if((await getAdminAccess()).status!=="admin")return null;
 try{
  const client=await createClient(),rows:AdminReport[]=[],outcomes:AdminLog[]=[];
  for(let offset=0;;offset+=500){
   let request=client.from("board_reports").select(reportFields).order("created_at",{ascending:false}).order("id");
   if(query.report_status==="open")request=request.in("status",["pending","reviewing"]);
   else if(query.report_status!=="all")request=request.eq("status",query.report_status);
   if(query.target==="post")request=request.not("post_id","is",null);
   if(query.target==="comment")request=request.not("comment_id","is",null);
   const result=await request.range(offset,offset+499);
   if(result.error) return null;
   rows.push(...result.data as unknown as AdminReport[]);
   if(result.data.length<500)break;
  }
  // Latest report completion determines its outcome. Do not add unsupported DB states.
  for(let offset=0;;offset+=500){
   const result=await client.from("board_moderation_logs").select(logFields).eq("action","report_resolved").order("created_at",{ascending:false}).order("id",{ascending:false}).range(offset,offset+499);
   if(result.error)return null;
   outcomes.push(...result.data as AdminLog[]);if(result.data.length<500)break;
  }
  const latest=new Map<string,AdminLog>();for(const log of sortAdminLogs(outcomes))if(log.report_id&&!latest.has(log.report_id))latest.set(log.report_id,log);
  const noActionIds=new Set([...latest].filter(([,log])=>log.reason.startsWith("[조치 없음] ")).map(([id])=>id));
  const filtered=filterReports(rows,query,Date.now(),noActionIds);
  const page=Math.min(query.page,Math.max(1,Math.ceil(filtered.length/20)));
  let selected=rows.find(r=>r.id===query.selected)??null;
  if(!selected&&uuid(query.selected)){
   const result=await client.from("board_reports").select(reportFields).eq("id",query.selected).maybeSingle();
   if(result.error)return null;selected=result.data as unknown as AdminReport|null;
  }
  let logs:AdminLog[]|null=[];
  if(selected){
   const target=selected.comment_id?`comment_id.eq.${selected.comment_id}`:`post_id.eq.${selected.post_id}`;
   const result=await client.from("board_moderation_logs").select(logFields).or(`report_id.eq.${selected.id},${target}`).order("created_at",{ascending:false}).order("id",{ascending:false}).limit(200);
   logs=result.error?null:sortAdminLogs(result.data as AdminLog[]);
  }
  return {rows:filtered.slice((page-1)*20,page*20),total:filtered.length,page,selected,logs,noActionIds:[...noActionIds]};
 }catch{return null;}
}
export async function hiddenPostLogs(ids:string[]){
 if((await getAdminAccess()).status!=="admin")return null;
 if(!ids.length)return [];
 try{
  const client=await createClient(),rows:AdminLog[]=[];
  for(let offset=0;;offset+=500){
   const result=await client.from("board_moderation_logs").select(logFields).in("post_id",ids).eq("action","hide_post").order("created_at",{ascending:false}).order("id").range(offset,offset+499);
   if(result.error)return null;rows.push(...result.data as AdminLog[]);if(result.data.length<500)return rows;
  }
 }catch{return null;}
}
