import {adminNoticeFeed,noticeEvents} from "@/lib/admin-notices";
import {communityAuthorName} from "@/lib/member-nickname";
import Link from "next/link";
import {Suspense} from "react";
import {notFound} from "next/navigation";
import {AdminShell} from "@/components/admin/admin-shell";
import {communityList,communityDetail} from "@/lib/community-board";
import {boardCategories,type CommunityDetail,type CommunityPost} from "@/lib/community-board-model";
import {adminBoardStats,adminReports,hiddenPostLogs} from "@/lib/member-board-admin";
import {adminTimeline} from "@/lib/member-board-timeline";
import {adminBoardBase as base,adminBoardHref as href,reportParent,reportTarget,reportOptions,reportStates,reportReasons,visibilityLabels,logLabels,type AdminBoardQuery,type AdminLog,type ModerationOption} from "@/lib/member-board-admin-model";
import {AdminModerationForm} from "./admin-moderation-form";
import {AdminReportPanel} from "./admin-report-panel";
import {BoardForm} from "./board-form";
import {date} from "./board-list";
import "./admin-board.css";
import {AdminNoticeList} from "./announcements";

const category=(value:string)=>boardCategories.find(c=>c.value===value)?.ko??value;
function Badge({value,label}:{value:string;label?:string}){return <span className={"member-badge member-badge--"+value}>{label??visibilityLabels[value]??reportStates[value]??value}</span>;}
export function AdminBoardLoading({panel=false}:{panel?:boolean}){return <div className={"member-admin member-loading "+(panel?"member-panel":"")} aria-busy="true"><span role="status" className="member-sr-only">{panel?"상세 정보를 불러오는 중":"주요 안내사항을 불러오는 중"}</span><div aria-hidden="true">{!panel&&<div className="member-stats">{[0,1,2,3].map(i=><span className="member-skeleton" key={i}/>)}</div>}{panel&&[0,1,2,3,4].map(i=><div className="member-skeleton member-skeleton-row" key={i}/>)}</div></div>;}
export function AdminBoardWorkspace({email,query}:{email:string;query:AdminBoardQuery}){
 return <AdminShell current="member-board" title="주요 안내사항 관리" email={email}><div className="member-admin">
  <header className="member-heading"><div><h1>주요 안내사항 관리</h1><p>홈페이지의 주요 안내사항을 작성하고 관리합니다. 기존 게시글·댓글·신고 기록은 보존됩니다.</p></div><Link className="member-primary" href={base+"/new"}>안내사항 작성</Link><Link className="member-text-link" href="https://malmoim.com/board" target="_blank" rel="noopener noreferrer">홈페이지 보기 ↗</Link></header>
  {query.tab!=="notices"&&<Suspense fallback={<AdminBoardLoading/>}><Stats/></Suspense>}
  {query.tab!=="notices"&&<Link href={base}>← 주요 안내사항으로</Link>}
  <details className="notice-admin-archive"><summary>기존 게시 기록 관리</summary><nav aria-label="기존 게시 기록"><Link href={href({tab:"posts"})}>기존 게시글</Link><Link href={href({tab:"reports"})}>신고 내역</Link><Link href={href({tab:"hidden"})}>숨김 기록</Link></nav></details>
  <Suspense key={JSON.stringify(query)} fallback={<div className={"member-report-workspace"+(query.tab==="reports"&&query.selected?" has-selection":"")}><AdminBoardLoading panel/>{query.tab==="reports"&&query.selected&&<AdminBoardLoading panel/>}</div>}>{query.tab==="reports"?<ReportWorkspace query={query}/>:<PostWorkspace query={query}/>}</Suspense>
 </div></AdminShell>;
}
export async function AdminPostRoute({id,query,page,commentQuery}:{id:string;query:AdminBoardQuery;page:number;commentQuery:string}){
 const result=await communityDetail(id,true,page,commentQuery);
 if(result.unavailable)return <div className="member-admin member-panel"><ErrorState/><Link href={href(query)}>← 목록으로</Link></div>;
 if(!result.data)notFound();
 return <AdminPostDetail data={result.data} query={query} commentQuery={commentQuery}/>;
}
async function Stats(){
 const counts=await adminBoardStats();
 const targets=[{tab:"posts"},{tab:"reports"},{tab:"hidden"},{tab:"posts",pinned:"pinned"}];
 return <div className="member-stats">{["전체 게시글","신고 대기","숨김 게시글","상단 고정 게시글"].map((label,i)=><Link href={href(targets[i] as Partial<AdminBoardQuery>,i===1?{report_status:"open",outcome:""}:{})} key={label}><span>{label}</span><strong>{counts?counts[i].toLocaleString():"조회 불가"}</strong><span aria-hidden="true">›</span></Link>)}{!counts&&<p role="alert">운영 현황을 조회하지 못했습니다. 권한 또는 DB 연결을 확인해주세요.</p>}</div>;
}
function Filters({query,reports=false}:{query:AdminBoardQuery;reports?:boolean}){
 return <form action={base} method="get" className="member-filters"><input type="hidden" name="tab" value={query.tab}/>
  <label>카테고리<select name="category" defaultValue={query.category} disabled={query.tab==="notices"}><option value="all">전체</option>{boardCategories.map(c=><option key={c.value} value={c.value}>{c.ko}</option>)}</select></label>
  <label>기간<select name="period" defaultValue={query.period}>{[["all","전체기간"],["day","최근 1일"],["week","최근 1주"],["month","최근 1개월"],["quarter","최근 3개월"],["year","최근 1년"]].map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></label>
  {reports?<><label>처리 상태<select name="report_status" defaultValue={query.report_status}><option value="all">전체</option><option value="open">미처리 (대기 + 검토)</option>{Object.entries(reportStates).map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></label><label>신고 대상<select name="target" defaultValue={query.target}><option value="all">전체</option><option value="post">게시글</option><option value="comment">댓글</option></select></label><label>처리 결과<select name="outcome" defaultValue={query.outcome}><option value="all">전체</option><option value="no_action">조치 없음으로 종료</option></select></label></>:<><label>공개 상태<select name="status" defaultValue={query.status} disabled={query.tab==="hidden"}><option value="all">전체</option>{Object.entries(visibilityLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><label>고정 여부<select name="pinned" defaultValue={query.pinned}><option value="all">전체</option><option value="pinned">고정</option><option value="unpinned">고정 안 됨</option></select></label><label>작성자<input name="author" defaultValue={query.author} placeholder="공개 별칭" maxLength={100}/></label></>}
  <label>검색 범위<select name="scope" defaultValue={query.scope}>{[["all","글 + 댓글"],["title","게시글 제목"],["author","대상 작성자"],["comments","댓글 내용"]].map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></label>
  <label className="member-filter-search">검색어<input name="q" type="search" maxLength={100} defaultValue={query.q} placeholder="검색어를 입력하세요."/></label><button className="member-primary">검색</button><Link href={href({tab:query.tab})}>초기화</Link>
 </form>;
}
function Pagination({query,total,page=query.page}:{query:AdminBoardQuery;total:number;page?:number}){const pages=Math.max(1,Math.ceil(total/20));return pages>1||page>1?<nav className="member-pagination" aria-label="관리 목록 페이지">{page>1&&<Link href={href(query,{page:page-1,selected:""})} aria-label="이전 페이지">‹</Link>}<span>{page} / {pages}</span>{page<pages&&<Link href={href(query,{page:page+1,selected:""})} aria-label="다음 페이지">›</Link>}</nav>:null;}
function ErrorState(){return <p className="member-empty member-error" role="alert">데이터를 조회하지 못했습니다. 권한 및 DB 연결을 확인한 후 다시 시도해주세요.</p>;}
function postOptions(p:CommunityPost):ModerationOption[]{return p.status==="deleted"?[]:[{value:"visibility",label:p.status==="hidden"?"게시글 숨김 해제":"게시글 숨김",action:p.status==="hidden"?"show_post":"hide_post",id:p.id,version:p.updated_at},{value:"pin",label:p.is_pinned?"상단 고정 해제":"상단 고정",action:"pin",id:p.id,version:p.updated_at,is_pinned:String(!p.is_pinned)}];}
async function PostWorkspace({query}:{query:AdminBoardQuery}){
 if(query.tab==="notices"){const [data,events]=await Promise.all([adminNoticeFeed(query),noticeEvents()]);return <AdminNoticeList data={data} query={query} events={events}/>;}
 const data=await communityList(query,true);
 const hidden=query.tab==="hidden"&&data?await hiddenPostLogs(data.posts.map(p=>p.id)):undefined;
 return <section className="member-panel"><h2>{query.tab==="hidden"?"숨김 게시글":"게시글 목록"} {data&&<span>{data.total.toLocaleString()}건</span>}</h2><Filters query={query}/>
  {!data?<ErrorState/>:<><div className="member-table-wrap"><table className="member-table member-post-table"><caption className="member-sr-only">회원 게시글 관리 목록</caption><thead><tr>{["카테고리","제목","작성자","작성일","조회 / 댓글","공개 상태","고정","관리"].map(h=><th key={h} scope="col">{h}</th>)}</tr></thead><tbody>
   {!data.posts.length&&<tr><td colSpan={8} className="member-empty">조건에 맞는 게시글이 없습니다.</td></tr>}
   {data.posts.map(p=>{const log=hidden?.find(l=>l.post_id===p.id);return <tr key={p.id}><td><Badge value={p.category} label={category(p.category)}/></td><td className="member-title"><Link href={base+"/"+p.id+"?"+new URLSearchParams(Object.entries(query).map(([k,v])=>[k,String(v)]))}>{p.title}</Link><details><summary>게시글 ID</summary><code>{p.id}</code></details>{query.tab==="hidden"&&<small>{hidden===null?"숨김 기록 조회 실패":log?<>{log.reason}<br/>{date(log.created_at,"ko")} · 관리자 {log.actor_id}</>:"숨김 기록 없음"}</small>}</td><td>{communityAuthorName(p.author_name,"ko")}</td><td><time dateTime={p.created_at}>{date(p.created_at,"ko")}</time></td><td>{p.view_count} / {p.comment_count}</td><td><Badge value={p.status}/></td><td>{p.is_pinned?"고정":"—"}</td><td><Link className="member-text-link" href={base+"/"+p.id+"?"+new URLSearchParams(Object.entries(query).map(([k,v])=>[k,String(v)]))}>상세·관리</Link>{p.category==="notice"&&p.status!=="deleted"&&<Link className="member-text-link" href={base+"/"+p.id+"/edit"}>공지 수정</Link>}</td></tr>;})}
  </tbody></table></div><Pagination query={query} total={data.total}/></>}
 </section>;
}
async function ReportWorkspace({query}:{query:AdminBoardQuery}){
 const data=await adminReports(query);
 const selected=data?.selected;
 return <div className={"member-report-workspace"+(selected?" has-selection":"")}><section className="member-panel member-report-list"><h2>신고 내역 {data&&<span>{data.total.toLocaleString()}건</span>}</h2><Filters query={query} reports/>
  {!data?<ErrorState/>:<><div className="member-table-wrap"><table className="member-table member-report-table"><caption className="member-sr-only">미처리 신고 우선, 최신 신고 순서</caption><thead><tr>{["상태","대상","카테고리","제목 / 내용 요약","신고 사유","작성자","신고일","관리"].map(h=><th key={h} scope="col">{h}</th>)}</tr></thead><tbody>
   {!data.rows.length&&<tr><td colSpan={8} className="member-empty">조건에 맞는 신고가 없습니다.</td></tr>}
   {data.rows.map(r=>{const parent=reportParent(r),target=reportTarget(r);return <tr key={r.id} className={selected?.id===r.id?"is-selected":undefined}><td><Badge value={r.status} label={r.status==="resolved"&&data.noActionIds.includes(r.id)?"조치 없음":undefined}/></td><td>{r.comment_id?"댓글":"게시글"}</td><td>{parent?<Badge value={parent.category} label={category(parent.category)}/>:"확인 불가"}</td><td className="member-title"><Link href={href(query,{selected:r.id,page:data.page})} aria-current={selected?.id===r.id?"true":undefined}>{parent?.title??"원문 확인 불가"}</Link><small>{r.original_content.slice(0,110)}</small></td><td>{reportReasons[r.reason]??r.reason}</td><td>{target?communityAuthorName(target.author_name,"ko"):"확인 불가"}</td><td><time dateTime={r.created_at}>{date(r.created_at,"ko")}</time></td><td><Link href={href(query,{selected:r.id,page:data.page})} className="member-text-link" aria-label={`${parent?.title??"신고"} 신고 상세`}>상세</Link></td></tr>;})}
  </tbody></table></div><Pagination query={query} total={data.total} page={data.page}/></>}
 </section>{selected&&data&&<ReportPanel report={selected} logs={data.logs} query={query} noAction={data.noActionIds.includes(selected.id)}/>}{query.selected&&data&&!selected&&<aside className="member-panel"><p role="alert">선택한 신고를 찾을 수 없습니다.</p><Link href={href(query,{selected:""})}>선택 해제</Link></aside>}</div>;
}
function ReportPanel({report:r,logs,query,noAction}:{report:NonNullable<Awaited<ReturnType<typeof adminReports>>>["rows"][number];logs:AdminLog[]|null;query:AdminBoardQuery;noAction:boolean}){
 const parent=reportParent(r),target=reportTarget(r);
 return <AdminReportPanel key={r.id} closeHref={href(query,{selected:""})}><header><h2 id="member-report-detail-title">신고 상세</h2><Link className="member-close" href={href(query,{selected:""})} aria-label="신고 상세 닫기">×</Link></header>
  <h3>기본 정보</h3><dl className="member-facts"><dt>신고 대상</dt><dd>{r.comment_id?"댓글":"게시글"}</dd><dt>처리 상태</dt><dd><Badge value={r.status} label={noAction&&r.status==="resolved"?"조치 없음으로 종료":undefined}/></dd><dt>접수일</dt><dd>{date(r.created_at,"ko")}</dd><dt>신고자</dt><dd>공개 식별 정보 미제공</dd><dt>대상 작성자</dt><dd>{target?communityAuthorName(target.author_name,"ko"):"확인 불가"}</dd></dl>
  <h3>신고 당시 원문</h3>{parent&&<p><Badge value={parent.category} label={category(parent.category)}/> <Link className="member-text-link" href={base+"/"+parent.id}>관련 게시글 확인 ↗</Link></p>}<blockquote className="member-original">{r.original_content}</blockquote>
  <details className="member-current-content"><summary>현재 원문 및 공개 상태</summary>{parent&&<h4>{parent.title}</h4>}<p>{target?<Badge value={target.status}/>:"대상 정보를 조회할 수 없습니다."}</p><div className="member-original">{target?.content??"현재 원문 확인 불가"}</div>{parent&&r.comment_id&&<p>상위 게시글: <Badge value={parent.status}/></p>}</details>
  <h3>신고 사유</h3><div className="member-report-reason"><strong>{reportReasons[r.reason]??r.reason}</strong><p>{r.detail||"추가 설명이 없습니다."}</p></div>
  <h3>운영 조치</h3><p className="member-note">숨김·복구는 원문 공개 상태만 변경합니다. 확인 후 별도로 처리 완료 또는 조치 없음 종료를 실행하세요. 사유는 각 조치 기록에 저장됩니다.</p>
  <AdminModerationForm options={reportOptions(r)}/><h3>운영 조치 기록</h3><p className="member-note">최근 200개 대상 조치 기록 · 최신순 · 관리자는 저장된 계정 ID로 표시됩니다.</p><LogList logs={logs} receipt={{id:r.id,created_at:r.created_at}}/>
 </AdminReportPanel>;
}
function LogList({logs,receipt}:{logs:AdminLog[]|null;receipt?:{id:string;created_at:string}}){
 const entries=adminTimeline(logs,receipt);
 return <><ol className="member-log">{entries.map(entry=><li key={entry.key}>
  <strong>{entry.kind==="receipt"?"신고 접수":logLabels[entry.log.action]??entry.log.action}</strong>
  <time dateTime={entry.created_at}>{date(entry.created_at,"ko")}</time>
  {entry.kind==="action"&&<><p>{entry.log.reason}</p><small>관리자 {entry.log.actor_id}</small></>}
 </li>)}</ol>{logs===null?<p role="alert">운영 기록을 조회하지 못했습니다.</p>:!entries.length?<p className="member-note">운영 조치 기록이 없습니다.</p>:null}</>;
}

export function AdminPostDetail({data,query,commentQuery=""}:{data:CommunityDetail;query:AdminBoardQuery;commentQuery?:string}){
 const p=data.post;
 return <div className="member-admin"><Link className="member-back" href={href(query,{selected:""})}>← 목록으로</Link><div className="member-post-workspace"><div><article className="member-panel member-post-content"><div className="member-badges"><Badge value={p.category} label={category(p.category)}/><Badge value={p.status}/>{p.is_pinned&&<Badge value="pinned" label="상단 고정"/>}</div><h1>{p.title}</h1><div className="member-meta"><span>{communityAuthorName(p.author_name,"ko")}</span><time dateTime={p.created_at}>{date(p.created_at,"ko")}</time><span>조회 {p.view_count} · 댓글 {data.comment_total}</span></div><div className="member-original">{p.content}</div><details><summary>게시글 ID / 마지막 수정일</summary><p>{p.id}<br/>{date(p.updated_at,"ko")}</p></details>{p.category==="notice"&&p.can_edit&&<div className="member-notice-actions"><Link className="member-primary" href={base+"/"+p.id+"/edit"}>공지사항 수정</Link><BoardForm action="post_delete" label="공지 삭제" hidden={{id:p.id,version:p.updated_at,admin:"true"}} confirm="이 공지사항을 삭제할까요?"/></div>}</article>
   <section className="member-panel"><h2>댓글 <span>{data.comment_total}</span></h2><form className="member-comment-search" action={base+"/"+p.id}><label>댓글 검색<input name="cq" defaultValue={commentQuery} maxLength={100}/></label><button className="member-outline">검색</button></form>{!data.comments.length&&<p className="member-empty">표시할 댓글이 없습니다.</p>}{data.comments.map(c=><article className="member-comment" key={c.id} id={"comment-"+c.id}><div className="member-meta"><strong>{communityAuthorName(c.author_name,"ko")}</strong><time dateTime={c.created_at}>{date(c.created_at,"ko")}</time><Badge value={c.status}/></div><p className="member-original">{c.content}</p>{c.status!=="deleted"&&<details><summary>댓글 숨김·복구</summary><AdminModerationForm options={[{value:"visibility",label:c.status==="hidden"?"이 댓글 숨김 해제":"이 댓글만 숨김",action:c.status==="hidden"?"show_comment":"hide_comment",id:c.id,version:c.updated_at}]}/></details>}</article>)}{(data.comment_total>30||data.comment_page>1)&&<nav className="member-pagination" aria-label="댓글 페이지">{data.comment_page>1&&<Link href={base+"/"+p.id+"?cp="+(data.comment_page-1)+"&cq="+encodeURIComponent(commentQuery)}>이전</Link>}<span>{data.comment_page} / {Math.max(1,Math.ceil(data.comment_total/30))}</span>{data.comment_page*30<data.comment_total&&<Link href={base+"/"+p.id+"?cp="+(data.comment_page+1)+"&cq="+encodeURIComponent(commentQuery)}>다음</Link>}</nav>}{p.status==="public"&&<BoardForm action="comment_save" label="댓글 등록" hidden={{post_id:p.id,admin:"true"}} fields={[{name:"content",label:"댓글",type:"textarea",required:true,maxLength:2000}]}/>}</section>
  </div><aside><section className="member-panel"><h2>게시글 운영 조치</h2><p className="member-note">회원 글의 제목·본문은 수정하지 않습니다. 숨김·복구·고정은 사유와 함께 기록됩니다.</p><AdminModerationForm options={postOptions(p)}/></section><section className="member-panel"><h2>관련 신고 <span>{data.reports?.length??0}</span></h2>{!data.reports?.length&&<p className="member-note">접수된 신고가 없습니다.</p>}{data.reports?.map(r=><Link className="member-related-report" key={r.id} href={href({tab:"reports",selected:r.id})}><Badge value={r.status}/><span>{r.comment_id?"댓글":"게시글"} · {reportReasons[r.reason]??r.reason}</span></Link>)}</section><details className="member-panel"><summary>운영 조치 기록</summary><LogList logs={data.logs as AdminLog[]|null}/></details></aside></div></div>;
}
