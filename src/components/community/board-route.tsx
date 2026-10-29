import Link from "next/link";
import {Suspense} from "react";
import {connection} from "next/server";
import {notFound} from "next/navigation";
import {communityList,communityDetail,communityIdentity} from "@/lib/community-board";
import {communityQuery,boardText,uuid,type BoardField} from "@/lib/community-board-model";
import {localizedPublicPath} from "@/lib/public-locale";
import {getAdminAccess} from "@/lib/auth";
import {AdminShell} from "@/components/admin/admin-shell";
import {publicAnnouncements} from "@/lib/public-announcements";
import {AnnouncementList,AnnouncementDetail} from "./announcements";
import {BoardForm} from "./board-form";
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
 if(!admin&&(view==="new"||view==="edit"))return wrap(<section className="community-board"><h1>{t("운영진 전용 작성 공간입니다","Only our team can publish announcements")}</h1><Link href={base}>{t("주요 안내사항 보기","View announcements")}</Link></section>);
 if(view==="list")return wrap(<AnnouncementList data={publicAnnouncements(query.q,query.page)} query={query} locale={locale}/>);
 let data=null;
 if(view==="detail"||view==="edit"){
  const id=params?(await params).id:"";
  if(!uuid(id))notFound();
  const page=Math.max(1,Math.min(Number(raw.cp)||1,10000));
  const result=await communityDetail(id,admin,Math.floor(page),typeof raw.cq==="string"?raw.cq:"");
  if(result.unavailable)return wrap(<section className="community-board"><p role="alert">{t("게시판을 불러올 수 없습니다. 잠시 후 다시 시도해주세요.","The post could not be loaded. Please try again later.")}</p><Link href={base}>{t("목록으로","Back to posts")}</Link></section>);
  if(!result.data||(!admin&&result.data.post.category!=="notice"))notFound();
  data=result.data;
  if(view==="detail")return wrap(<AnnouncementDetail data={data} locale={locale}/>);
 }
 const user=await communityIdentity();
 if(!user)return wrap(<section className="community-board"><h1>{t("로그인이 필요합니다","Log in to continue")}</h1><p>{t("글 작성은 로그인 후 이용할 수 있습니다.","Please log in before writing a post.")}</p><Link className="community-write" href={localizedPublicPath("/auth/login",locale)+"?returnTo="+encodeURIComponent(view==="edit"&&data?base+"/"+data.post.id+"/edit":base+"/new")}>{t("로그인","Log in")}</Link></section>);
 if(view==="edit"&&(!data?.post.can_edit||(!admin&&data.post.category==="notice")||(admin&&data.post.category!=="notice")))return wrap(<section className="community-board"><h1>{t("수정 권한이 없습니다","You cannot edit this post")}</h1><Link href={base}>{t("목록으로","Back to posts")}</Link></section>);
 if(view==="new"&&!(await communityList(communityQuery({}),admin)))return wrap(<section className="community-board"><p role="alert">{t("게시판 연결을 준비하고 있습니다. 아직 글을 저장할 수 없습니다.","The board is not available yet. Posts cannot be saved until setup is complete.")}</p><Link href={base}>{t("목록으로","Back to posts")}</Link></section>);
 const fields:BoardField[]=[
  {name:"title",label:t("제목","Title"),value:data?.post.title??"",required:true,maxLength:200},
  {name:"content",label:t("본문","Content"),value:data?.post.content??"",type:"textarea",required:true,maxLength:20000},
 ];
 return wrap(<section className="community-board community-editor"><h1>{admin?(view==="edit"?"공지사항 수정":"공지사항 작성"):view==="edit"?t("게시글 수정","Edit post"):t("글쓰기","Write a post")}</h1>
  <p>{view==="edit"?"수정한 내용이 저장되며 기존 공개·숨김 상태는 유지됩니다.":"게시하면 홈페이지의 주요 안내사항에 바로 표시됩니다. 목록에서 숨기거나 상단에 고정할 수 있습니다."}</p>
  <BoardForm action="post_save" locale={locale} fields={fields} hidden={{id:data?.post.id??"",version:data?.post.updated_at??"",admin:String(admin),category:"notice"}} label={view==="edit"?t("수정 저장","Save changes"):t("홈페이지에 게시","Publish announcement")} cancel={data?base+"/"+data.post.id:base}/>
 </section>);
}
