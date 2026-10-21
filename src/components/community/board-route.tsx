import Link from "next/link";
import {Suspense} from "react";
import {connection} from "next/server";
import {notFound} from "next/navigation";
import {communityList,communityDetail,communityIdentity} from "@/lib/community-board";
import {communityQuery,boardText,boardCategories,uuid,type BoardField} from "@/lib/community-board-model";
import {localizedPublicPath} from "@/lib/public-locale";
import {getAdminAccess} from "@/lib/auth";
import {AdminShell} from "@/components/admin/admin-shell";
import {CommunityListView} from "./board-list";
import {CommunityDetailView} from "./board-detail";
import {BoardForm} from "./board-form";
import {AdminBoardWorkspace,AdminPostRoute,AdminBoardLoading} from "./admin-board";
import {adminBoardQuery} from "@/lib/member-board-admin-model";
import type {PublicLocale} from "@/lib/public-content";
import "./community.css";
type RawQuery=Record<string,string|string[]|undefined>;
export async function CommunityRoute({locale="ko",view="list",params,searchParams,admin=false,email=""}:{
 locale?:PublicLocale;view?:"list"|"detail"|"new"|"edit";params?:Promise<{id:string}>;searchParams?:Promise<RawQuery>;admin?:boolean;email?:string;
}){
 await connection();
 const raw=searchParams?await searchParams:{},query=communityQuery(raw),t=(ko:string,en:string)=>boardText(locale,ko,en);
 const base=admin?"/admin/member-board":localizedPublicPath("/board",locale);
 const wrap=(content:React.ReactNode)=>admin?<AdminShell current="member-board" title="회원 게시판 관리" email={email}>{content}</AdminShell>:<main id="public-main" lang={locale} tabIndex={-1}>{content}</main>;
 if(admin&&(await getAdminAccess()).status!=="admin")return wrap(<p role="alert">관리자 권한이 필요합니다.</p>);
 if(admin&&view==="list")return <AdminBoardWorkspace email={email} query={adminBoardQuery(raw)}/>;
 if(admin&&view==="detail"){
  const id=params?(await params).id:"";if(!uuid(id))notFound();
  return wrap(<Suspense key={id+JSON.stringify(raw)} fallback={<AdminBoardLoading panel/>}><AdminPostRoute id={id} query={adminBoardQuery(raw)} page={Math.floor(Math.max(1,Math.min(Number(raw.cp)||1,10000)))} commentQuery={typeof raw.cq==="string"?raw.cq:""}/></Suspense>);
 }
 if(view==="list")return wrap(<CommunityListView data={await communityList(query,admin)} query={query} locale={locale} admin={admin}/>);
 let data=null;
 if(view==="detail"||view==="edit"){
  const id=params?(await params).id:"";
  if(!uuid(id))notFound();
  const page=Math.max(1,Math.min(Number(raw.cp)||1,10000));
  const result=await communityDetail(id,admin,Math.floor(page),typeof raw.cq==="string"?raw.cq:"");
  if(result.unavailable)return wrap(<section className="community-board"><p role="alert">{t("게시판을 불러올 수 없습니다. 잠시 후 다시 시도해주세요.","The post could not be loaded. Please try again later.")}</p><Link href={base}>{t("목록으로","Back to posts")}</Link></section>);
  if(!result.data)notFound();
  data=result.data;
  if(view==="detail")return wrap(<CommunityDetailView data={data} locale={locale} commentQuery={typeof raw.cq==="string"?raw.cq:""}/>);
 }
 const user=await communityIdentity();
 if(!user)return wrap(<section className="community-board"><h1>{t("로그인이 필요합니다","Log in to continue")}</h1><p>{t("글 작성은 로그인 후 이용할 수 있습니다.","Please log in before writing a post.")}</p><Link className="community-write" href={localizedPublicPath("/auth/login",locale)+"?returnTo="+encodeURIComponent(view==="edit"&&data?base+"/"+data.post.id+"/edit":base+"/new")}>{t("로그인","Log in")}</Link></section>);
 if(view==="edit"&&(!data?.post.can_edit||(!admin&&data.post.category==="notice")||(admin&&data.post.category!=="notice")))return wrap(<section className="community-board"><h1>{t("수정 권한이 없습니다","You cannot edit this post")}</h1><Link href={base}>{t("목록으로","Back to posts")}</Link></section>);
 if(view==="new"&&!(await communityList(communityQuery({}),admin)))return wrap(<section className="community-board"><p role="alert">{t("게시판 연결을 준비하고 있습니다. 아직 글을 저장할 수 없습니다.","The board is not available yet. Posts cannot be saved until setup is complete.")}</p><Link href={base}>{t("목록으로","Back to posts")}</Link></section>);
 const fields:BoardField[]=[
  {name:"category",label:t("카테고리","Category"),type:"select",required:true,value:data?.post.category??(admin?"notice":"free"),options:boardCategories.filter(c=>admin?c.value==="notice":c.value!=="notice").map(c=>({value:c.value,label:t(c.ko,c.en)}))},
  {name:"title",label:t("제목","Title"),value:data?.post.title??"",required:true,maxLength:200},
  {name:"content",label:t("본문","Content"),value:data?.post.content??"",type:"textarea",required:true,maxLength:20000},
 ];
 return wrap(<section className="community-board community-editor"><h1>{admin?(view==="edit"?"공지사항 수정":"공지사항 작성"):view==="edit"?t("게시글 수정","Edit post"):t("글쓰기","Write a post")}</h1>
  <p>{t("이메일·전화번호 등 개인정보를 본문에 포함하지 마세요. 공개 별칭은 게시판에서 자동 생성됩니다.","Do not include personal information such as email or phone numbers. A public board alias is generated automatically.")}</p>
  <BoardForm action="post_save" locale={locale} fields={fields} hidden={{id:data?.post.id??"",version:data?.post.updated_at??"",admin:String(admin)}} label={t("저장","Save")} cancel={data?base+"/"+data.post.id:base}/>
 </section>);
}
