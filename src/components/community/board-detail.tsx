import Link from "next/link";
import {BoardForm,CommunityViewCounter} from "./board-form";
import {date} from "./board-list";
import {boardText,boardCategories,type CommunityDetail,type BoardField} from "@/lib/community-board-model";
import {localizedPublicPath} from "@/lib/public-locale";
import type {PublicLocale} from "@/lib/public-content";
export function CommunityDetailView({data,locale="ko",admin=false,commentQuery=""}:{data:CommunityDetail;locale?:PublicLocale;admin?:boolean;commentQuery?:string}){
 const t=(ko:string,en:string)=>boardText(locale,ko,en),p=data.post,base=admin?"/admin/member-board":localizedPublicPath("/board",locale);
 const category=boardCategories.find(c=>c.value===p.category);
 const reason:BoardField={name:"reason",label:"처리 사유",required:true,maxLength:500};
 const reporting=(target:string,id:string)=><details className="community-report"><summary>{t("신고","Report")}</summary><BoardForm action="report" label={t("신고 접수","Submit report")} locale={locale} hidden={{id,target}} fields={[
  {name:"reason",label:t("신고 사유","Reason"),type:"select",value:"spam",options:[["spam","스팸","Spam"],["abuse","괴롭힘·부적절한 내용","Abuse"],["privacy","개인정보","Privacy"],["other","기타","Other"]].map(([value,ko,en])=>({value,label:t(ko,en)}))},
  {name:"detail",label:t("추가 설명 (선택)","Details (optional)"),type:"textarea",maxLength:1000},
 ]}/></details>;
 return <section className={"community-board community-detail"+(admin?"":" community-detail-public")}><article className="community-post-panel">
  <Link className="community-back" href={base}>{t("← 목록으로","← Back to posts")}</Link>
  <div className="community-post-category">{category?t(category.ko,category.en):p.category}{p.is_pinned?" · "+t("고정","Pinned"):""}{admin?" · "+p.status:""}</div>
  <h1>{p.title}</h1><div className="community-meta"><span className="community-author"><span className="community-avatar" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="8" r="3.5"/><path d="M5 21v-3a7 7 0 0 1 14 0v3"/></svg></span>{p.author_name}</span><time dateTime={p.created_at}>{date(p.created_at,locale)}</time>{p.updated_at!==p.created_at&&<span>{t("수정됨","Edited")} {date(p.updated_at,locale)}</span>}<span title={t("로그인 회원별 하루 1회 집계","Counted once per signed-in member per day")}>{t("조회","Views")} {p.view_count}</span><span>{t("댓글","Comments")} {data.comment_total}</span></div>
  <div className="community-body">{p.content}</div>
  {!admin&&data.authenticated&&<CommunityViewCounter id={p.id}/>}
  {(p.can_edit||(!admin&&data.authenticated))&&<div className="community-post-actions">{p.can_edit&&<div className="community-owner-actions"><Link className="community-edit-button" href={(admin&&p.category!=="notice"?localizedPublicPath("/board",locale):base)+"/"+p.id+"/edit"}>{t("수정","Edit")}</Link><BoardForm action="post_delete" label={t("삭제","Delete")} locale={locale} hidden={{id:p.id,version:p.updated_at,admin:String(admin)}} confirm={t("이 게시글을 삭제할까요?","Delete this post?")}/></div>}
  {!admin&&data.authenticated&&reporting("post",p.id)}</div>}
  {admin&&p.status!=="deleted"&&<section className="community-moderation"><h2>게시글 운영 조치</h2><BoardForm key={p.updated_at+p.status} action={p.status==="hidden"?"show_post":"hide_post"} label={p.status==="hidden"?"숨김 해제":"숨김"} hidden={{id:p.id,version:p.updated_at,admin:"true"}} fields={[reason]}/><BoardForm key={p.updated_at+"pin"} action="pin" label={p.is_pinned?"고정 해제":"상단 고정"} hidden={{id:p.id,version:p.updated_at,is_pinned:String(!p.is_pinned),admin:"true"}} fields={[reason]}/></section>}
  </article><section className="community-comments"><h2>{t("댓글","Comments")} <span>{data.comment_total}</span></h2>
   {admin&&<form method="get"><label>댓글 검색<input name="cq" maxLength={100} defaultValue={commentQuery}/></label><button>검색</button></form>}
   {!data.comments.length&&<div className="community-comments-empty"><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M24 5C12 5 4 12 4 22c0 5 3 10 7 13l-3 8 10-4c2 1 4 1 6 1 12 0 20-8 20-18S36 5 24 5Z"/><circle cx="15" cy="23" r="1"/><circle cx="24" cy="23" r="1"/><circle cx="33" cy="23" r="1"/></svg><p>{commentQuery?t("검색 결과가 없습니다.","No matching comments."):t("아직 댓글이 없습니다.","No comments yet.")}</p>{!commentQuery&&<span>{t("첫 번째 댓글을 남겨보세요!","Start the conversation!")}</span>}</div>}
   {data.comments.map(c=><article key={c.id}><div className="community-meta"><strong>{c.author_name}</strong><time dateTime={c.created_at}>{date(c.created_at,locale)}</time>{c.updated_at!==c.created_at&&<span>{t("수정됨","Edited")}</span>}{admin&&<span>{c.status}</span>}</div><p className="community-body">{c.content}</p>
    {c.can_edit&&<details><summary>{t("수정·삭제","Edit or delete")}</summary><BoardForm action="comment_save" label={t("수정 저장","Save changes")} locale={locale} hidden={{id:c.id,version:c.updated_at,admin:String(admin)}} cancel={base+"/"+p.id} fields={[{name:"content",label:t("댓글 내용","Comment"),value:c.content,type:"textarea",required:true,maxLength:2000}]}/><BoardForm action="comment_delete" label={t("댓글 삭제","Delete comment")} locale={locale} hidden={{id:c.id,version:c.updated_at,admin:String(admin)}} confirm={t("댓글을 삭제할까요?","Delete this comment?")}/></details>}
    {!admin&&data.authenticated&&reporting("comment",c.id)}
    {admin&&c.status!=="deleted"&&<BoardForm key={c.updated_at+c.status} action={c.status==="hidden"?"show_comment":"hide_comment"} label={c.status==="hidden"?"댓글 복구":"댓글 숨김"} hidden={{id:c.id,version:c.updated_at,admin:"true"}} fields={[reason]}/>}
   </article>)}
   {(data.comment_total>30||data.comment_page>1)&&<nav className="community-pagination" aria-label={t("댓글 페이지","Comment pages")}>{data.comment_page>1&&<Link href={base+"/"+p.id+"?cp="+(data.comment_page-1)+(commentQuery?"&cq="+encodeURIComponent(commentQuery):"")}>←</Link>}<span>{data.comment_page} / {Math.max(1,Math.ceil(data.comment_total/30))}</span>{data.comment_page*30<data.comment_total&&<Link href={base+"/"+p.id+"?cp="+(data.comment_page+1)+(commentQuery?"&cq="+encodeURIComponent(commentQuery):"")}>→</Link>}</nav>}
   {data.authenticated&&p.status==="public"?<BoardForm variant="comment" action="comment_save" label={t("댓글 등록","Add comment")} locale={locale} hidden={{post_id:p.id,admin:String(admin)}} fields={[{name:"content",label:t("댓글","Comment"),type:"textarea",required:true,maxLength:2000}]}/>:
    !data.authenticated?<p>{t("댓글 작성은 로그인 후 이용할 수 있습니다.","Log in to write a comment.")} <Link href={localizedPublicPath("/auth/login",locale)+"?returnTo="+encodeURIComponent(base+"/"+p.id)}>{t("로그인","Log in")}</Link></p>:null}
  </section>
  {admin&&<><section className="community-moderation"><h2>신고 내역</h2>{!data.reports?.length&&<p>신고가 없습니다.</p>}{data.reports?.map(r=><article key={r.id}><p>{r.comment_id?"댓글 "+r.comment_id:"게시글"} · {r.reason} · {r.status}</p><p className="community-body">{r.detail}</p><h3>신고 당시 원문</h3><blockquote className="community-body">{r.original_content}</blockquote><BoardForm key={r.updated_at} action="report_review" label="신고 상태 저장" hidden={{id:r.id,version:r.updated_at,admin:"true"}} fields={[{name:"status",label:"처리 상태",type:"select",value:r.status==="resolved"?"resolved":"reviewing",options:[{value:"reviewing",label:"추가 검토"},{value:"resolved",label:"처리 완료"}]},reason]}/></article>)}</section>
   <section className="community-moderation"><h2>운영 조치 기록</h2>{!data.logs?.length&&<p>처리 기록이 없습니다.</p>}{data.logs?.map(l=><p key={l.id}>{date(l.created_at,"ko")} · {l.actor_id} · {l.action} · {l.reason}</p>)}</section></>}
 </section>;
}
