import Link from "next/link";
import {Suspense} from "react";
import {connection} from "next/server";
import {notFound} from "next/navigation";
import {communityDetail} from "@/lib/community-board";
import {communityQuery,boardText,uuid} from "@/lib/community-board-model";
import {localizedPublicPath} from "@/lib/public-locale";
import {getAdminAccess} from "@/lib/auth";
import {AdminShell} from "@/components/admin/admin-shell";
import {publicAnnouncements} from "@/lib/public-announcements";
import {AnnouncementList,AnnouncementDetail} from "./announcements";
import {AnnouncementEditor,type NoticeEditorData} from "./announcement-editor";
import {createClient} from "@/lib/supabase/server";
import {AdminBoardWorkspace,AdminPostRoute,AdminBoardLoading} from "./admin-board";
import {adminBoardQuery} from "@/lib/member-board-admin-model";
import type {PublicLocale} from "@/lib/public-content";
import "./community.css";
type RawQuery=Record<string,string|string[]|undefined>;
export async function CommunityRoute({locale="ko",view="list",params,searchParams,admin=false,email=""}:{
 locale?:PublicLocale;view?:"list"|"detail"|"new"|"edit";params?:Promise<{id:string}>;searchParams?:Promise<RawQuery>;admin?:boolean;email?:string;
}){
 if(admin||view!=="list")await connection();
 const raw=searchParams?await searchParams:{},query=communityQuery(raw),t=(ko:string,en:string)=>boardText(locale,ko,en);
 const base=admin?"/admin/member-board":localizedPublicPath("/board",locale);
 const wrap=(content:React.ReactNode)=>admin?<AdminShell current="member-board" title="주요 안내사항 관리" email={email}>{content}</AdminShell>:<main id="public-main" lang={locale} tabIndex={-1}>{content}</main>;
 if(admin&&(await getAdminAccess()).status!=="admin")return wrap(<p role="alert">관리자 권한이 필요합니다.</p>);
 if(admin&&view==="list")return <AdminBoardWorkspace email={email} query={adminBoardQuery({...raw,tab:raw.tab??"notices"})}/>;
 if(admin&&view==="detail"){
  const id=params?(await params).id:"";if(!uuid(id))notFound();
  return wrap(<Suspense key={id+JSON.stringify(raw)} fallback={<AdminBoardLoading panel/>}><AdminPostRoute id={id} query={adminBoardQuery(raw)} page={Math.floor(Math.max(1,Math.min(Number(raw.cp)||1,10000)))} commentQuery={typeof raw.cq==="string"?raw.cq:""}/></Suspense>);
 }
 if(admin&&(view==="new"||view==="edit")){
  let initial:NoticeEditorData|undefined;
  if(view==="edit"){const id=params?(await params).id:"";if(!uuid(id))notFound();const client=await createClient();const result=await client.from('board_posts').select('id,title,content,language,images,updated_at').eq('id',id).eq('category','notice').neq('status','deleted').single();if(result.error||!result.data)notFound();initial=result.data as NoticeEditorData;}
  return wrap(<AnnouncementEditor initial={initial}/>);
 }
 if(!admin&&(view==="new"||view==="edit"))return wrap(<section className="community-board"><h1>{t("운영진 전용 작성 공간입니다","Only our team can publish announcements")}</h1><Link href={base}>{t("주요 안내사항 보기","View announcements")}</Link></section>);
 if(view==="list")return wrap(<AnnouncementList data={publicAnnouncements(query.q,query.page,locale)} query={query} locale={locale}/>);
 let data=null;
 if(view==="detail"||view==="edit"){
  const id=params?(await params).id:"";
  if(!uuid(id))notFound();
  const page=Math.max(1,Math.min(Number(raw.cp)||1,10000));
  const result=await communityDetail(id,admin,Math.floor(page),typeof raw.cq==="string"?raw.cq:"");
  if(result.unavailable)return wrap(<section className="community-board"><p role="alert">{t("게시판을 불러올 수 없습니다. 잠시 후 다시 시도해주세요.","The post could not be loaded. Please try again later.")}</p><Link href={base}>{t("목록으로","Back to posts")}</Link></section>);
  if(!result.data||(!admin&&result.data.post.category!=="notice"))notFound();
  data=result.data;
  const client=await createClient();const extra=await client.from('board_posts').select('language,images').eq('id',id).eq('category','notice').eq('status','public').single();
  if(extra.error||extra.data.language!==locale)notFound();
  data={...data,post:{...data.post,...extra.data}};
  if(view==="detail")return wrap(<AnnouncementDetail data={data} locale={locale}/>);
 }
 notFound();
}
