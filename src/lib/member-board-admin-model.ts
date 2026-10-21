import { communityQuery, type CommunityQuery } from "./community-board-model";

export const adminBoardBase = "/admin/member-board";
export const reportStates: Record<string,string> = {pending:"처리 대기",reviewing:"검토 중",resolved:"처리 완료"};
export const reportReasons: Record<string,string> = {spam:"스팸·홍보",abuse:"괴롭힘·부적절한 내용",privacy:"개인정보 노출",other:"기타"};
export const visibilityLabels: Record<string,string> = {public:"공개",hidden:"숨김",deleted:"삭제됨"};
export const logLabels: Record<string,string> = {hide_post:"게시글 숨김",show_post:"게시글 복구",hide_comment:"댓글 숨김",show_comment:"댓글 복구",pin:"고정 상태 변경",report_reviewing:"신고 검토",report_resolved:"신고 종료",notice_save:"공지 저장",notice_delete:"공지 삭제"};
export type AdminBoardQuery = CommunityQuery & {tab:"posts"|"reports"|"hidden"|"notices";report_status:string;target:string;selected:string;outcome:string};
export type ReportPost = {id:string;category:string;title:string;content:string;author_name:string;status:string;updated_at:string};
export type ReportComment = {id:string;post_id:string;content:string;author_name:string;status:string;updated_at:string;post:ReportPost|null};
export type AdminReport = {id:string;post_id:string|null;comment_id:string|null;reason:string;detail:string;original_content:string;status:string;created_at:string;updated_at:string;post:ReportPost|null;comment:ReportComment|null};
export type AdminLog = {id:string;actor_id:string;post_id:string|null;comment_id:string|null;report_id:string|null;action:string;reason:string;created_at:string};
export type ModerationOption = {value:string;label:string;action:string;id:string;version:string;status?:string;is_pinned?:string;prefix?:string};
export function adminBoardQuery(raw:Record<string,string|string[]|undefined>):AdminBoardQuery {
 const choice=(key:string,values:string[],fallback:string)=>typeof raw[key]==="string"&&values.includes(raw[key])?raw[key]:fallback;
 const tab=choice("tab",["posts","reports","hidden","notices"],"posts") as AdminBoardQuery["tab"];
 const query=communityQuery(raw);
 if(tab==="hidden")query.status="hidden";
 if(tab==="notices")query.category="notice";
 return {...query,tab,report_status:choice("report_status",["all","open","pending","reviewing","resolved"],"all"),target:choice("target",["all","post","comment"],"all"),selected:typeof raw.selected==="string"?raw.selected:"",outcome:choice("outcome",["all","no_action"],"all")};
}
export function adminBoardHref(query:Partial<AdminBoardQuery>,changes:Record<string,string|number|undefined>={}) {
 const params=new URLSearchParams();
 for(const [key,value] of Object.entries({...query,...changes}))if(value!==undefined&&value!=="")params.set(key,String(value));
 return adminBoardBase+(params.size?"?"+params:"");
}
export function reportParent(report:AdminReport){return report.post??report.comment?.post??null;}
export function reportTarget(report:AdminReport){return report.comment_id?report.comment:report.post;}
export function filterReports(rows:AdminReport[],query:AdminBoardQuery,now=Date.now(),noActionIds=new Set<string>()){
 const before=new Date(now),months:Record<string,number>={month:1,quarter:3,year:12};
 if(months[query.period]){
  const day=before.getUTCDate();before.setUTCDate(1);before.setUTCMonth(before.getUTCMonth()-months[query.period]);
  const last=new Date(Date.UTC(before.getUTCFullYear(),before.getUTCMonth()+1,0)).getUTCDate();before.setUTCDate(Math.min(day,last));
 }
 const cutoff=query.period==="day"?now-86400000:query.period==="week"?now-7*86400000:months[query.period]?before.getTime():-Infinity;
 const term=query.q.toLocaleLowerCase();
 return rows.filter(r=>{
  const parent=reportParent(r),target=reportTarget(r);
  if(query.report_status==="open"?r.status==="resolved":query.report_status!=="all"&&r.status!==query.report_status)return false;
  if(query.target!=="all"&&(r.comment_id?"comment":"post")!==query.target)return false;
  if(query.category!=="all"&&parent?.category!==query.category)return false;
  if(Date.parse(r.created_at)<cutoff)return false;
  if(query.outcome==="no_action"&&(r.status!=="resolved"||!noActionIds.has(r.id)))return false;
  const text=query.scope==="title"?parent?.title:query.scope==="author"?target?.author_name:query.scope==="comments"?(r.comment_id?r.original_content:""):[parent?.title,r.original_content,r.detail,target?.author_name].join(" ");
  return !term||(text??"").toLocaleLowerCase().includes(term);
 }).sort((a,b)=>(Number(a.status==="resolved")-Number(b.status==="resolved"))||b.created_at.localeCompare(a.created_at)||b.id.localeCompare(a.id));
}
export function reportOptions(report:AdminReport):ModerationOption[]{
 const target=reportTarget(report),kind=report.comment_id?"comment":"post",options:ModerationOption[]=[];
 if(target&&target.status!=="deleted")options.push({value:"visibility",label:target.status==="hidden"?`${kind==="comment"?"댓글":"게시글"} 숨김 해제 (신고 상태 유지)`:`${kind==="comment"?"댓글":"게시글"} 숨김 (신고 상태 유지)`,action:(target.status==="hidden"?"show_":"hide_")+kind,id:target.id,version:target.updated_at});
 options.push({value:"review",label:"검토 중으로 표시",action:"report_review",id:report.id,version:report.updated_at,status:"reviewing"},
 {value:"resolve",label:"처리 완료 (원문 상태 유지)",action:"report_review",id:report.id,version:report.updated_at,status:"resolved"},
 {value:"no_action",label:"조치 없음으로 종료 (원문 상태 유지)",action:"report_review",id:report.id,version:report.updated_at,status:"resolved",prefix:"[조치 없음] "});
 return options;
}
