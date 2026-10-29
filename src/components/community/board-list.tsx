import {communityAuthorName} from "@/lib/member-nickname";
import Link from "next/link";
import { BoardForm } from "./board-form";
import { boardCategories, boardText, boardHref, type CommunityList, type CommunityPost, type CommunityQuery } from "@/lib/community-board-model";
import type { PublicLocale } from "@/lib/public-content";
import { localizedPublicPath } from "@/lib/public-locale";

export function BoardFilters({ base, query, locale = "ko", admin = false }: { base: string; query: CommunityQuery; locale?: PublicLocale; admin?: boolean }) {
  const t = (ko: string, en: string) => boardText(locale, ko, en);
  return <form className="community-filters" action={base} method="get">
    <input type="hidden" name="category" value={query.category} />
    <label>{t("검색 범위", "Search in")}<select name="scope" defaultValue={query.scope}>
      {[["all", "글 + 댓글", "Posts + comments"], ["title", "제목만", "Titles"], ["author", "글작성자", "Post author"], ["comments", "댓글내용", "Comments"]].map(([value, ko, en]) => <option key={value} value={value}>{t(ko, en)}</option>)}
    </select></label>
    <label>{t("기간", "Period")}<select name="period" defaultValue={query.period}>
      {[["all", "전체기간", "All time"], ["day", "최근 1일", "Past day"], ["week", "최근 1주", "Past week"], ["month", "최근 1개월", "Past month"], ["quarter", "최근 3개월", "Past 3 months"], ["year", "최근 1년", "Past year"]].map(([value, ko, en]) => <option key={value} value={value}>{t(ko, en)}</option>)}
    </select></label>
    {admin && <>
      <label>공개 상태<select name="status" defaultValue={query.status}>{[["all", "전체"], ["public", "공개"], ["reported", "신고 대기"], ["hidden", "숨김"], ["deleted", "삭제"]].map(([v, l]) => <option value={v} key={v}>{l}</option>)}</select></label>
      <label>고정 여부<select name="pinned" defaultValue={query.pinned}>{[["all", "전체"], ["pinned", "고정"], ["unpinned", "고정 안 됨"]].map(([v, l]) => <option value={v} key={v}>{l}</option>)}</select></label>
      <label>작성자<input name="author" defaultValue={query.author} maxLength={100} placeholder="공개 별칭" /></label>
    </>}
    <label className="community-search">{t("검색어", "Search term")}<span className="community-search-control"><input type="search" name="q" defaultValue={query.q} maxLength={100} placeholder={t("검색어를 입력하세요.", "Enter a search term.")} /><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" focusable="false"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></svg></span></label>
    <button type="submit">{t("검색", "Search")}</button>
  </form>;
}

function Category({ value, locale }: { value: string; locale: PublicLocale }) {
  const category = boardCategories.find(c => c.value === value);
  return <span className={"community-category community-category--" + value}>{category ? boardText(locale, category.ko, category.en) : value}</span>;
}

function PostTable({ data, query, base, locale, admin }: { data: CommunityList | null; query: CommunityQuery; base: string; locale: PublicLocale; admin: boolean }) {
  const t = (ko: string, en: string) => boardText(locale, ko, en);
  const headers = admin ? ["ID", "카테고리", "제목", "작성자", "작성일", "조회", "댓글", "상태", "고정 / 관리"] : [t("번호", "No."), t("카테고리", "Category"), t("제목", "Title"), t("작성자", "Author"), t("작성일", "Date"), t("조회", "Views"), t("댓글", "Replies")];
  const empty = !data ? t("게시판 연결을 준비하고 있습니다. 아직 글을 조회하거나 저장할 수 없습니다.", "The board is not available yet. Posts cannot be loaded or saved until setup is complete.") : query.q || query.category !== "all" || query.period !== "all" ? t("조건에 맞는 게시글이 없습니다.", "No posts match these filters.") : t("아직 등록된 안내사항이 없습니다.", "No announcements yet.");
  const pinControl = (post: CommunityPost) => post.status === "deleted" ? <span>삭제됨</span> : <BoardForm key={post.updated_at + String(post.is_pinned)} action="pin" label={post.is_pinned ? "고정 해제" : "상단 고정"} hidden={{ id: post.id, version: post.updated_at, is_pinned: String(!post.is_pinned), reason: "목록에서 " + (post.is_pinned ? "고정 해제" : "상단 고정"), admin: "true" }} />;
  return <div className="community-table-wrap">
    <table className={"community-table " + (admin ? "community-admin-table" : "community-public-table")}>
      <caption className="community-sr-only">{t("게시글 목록. 고정된 글 다음 최신 글 순서입니다.", "Posts, with pinned posts first, then newest posts.")}</caption>
      <thead><tr>{headers.map(h => <th scope="col" key={h}>{h}</th>)}</tr></thead>
      <tbody>{!data?.posts.length ? <tr className="community-empty-row"><td colSpan={headers.length}><p className="community-empty" role={!data ? "alert" : "status"}>{empty}</p></td></tr> : data.posts.map((p, index) => <tr key={p.id} className={p.is_pinned ? "is-pinned" : undefined}>
        <td className="community-post-number">{admin ? <span title={p.id}>{p.id.slice(0, 8)}</span> : p.is_pinned ? t("고정", "Pinned") : p.category === "notice" ? t("공지", "Notice") : data.total - (query.page - 1) * 20 - index}</td>
        <td className="community-post-category-cell"><Category value={p.category} locale={locale} /></td>
        <td className="community-post-title"><Link href={base + "/" + p.id}>{p.is_pinned && <span className="community-mobile-pin">{t("고정", "Pinned")} · </span>}{p.title}</Link></td>
        <td className="community-post-author">{communityAuthorName(p.author_name,locale)}</td>
        <td className="community-post-date"><time dateTime={p.created_at}>{listDate(p.created_at, locale)}</time></td>
        <td className="community-post-views" title={t("로그인 회원별 하루 1회 집계", "Counted once per signed-in member per day")}><span className="community-mobile-label">{t("조회", "Views")} </span>{p.view_count.toLocaleString(locale)}</td>
        <td className="community-post-comments"><span className="community-mobile-label">{t("댓글", "Replies")} </span>{p.comment_count.toLocaleString(locale)}</td>
        {admin && <><td><span className={"community-status community-status--" + p.status}>{({ public: "공개", hidden: "숨김", deleted: "삭제" } as Record<string, string>)[p.status] ?? p.status}</span></td><td className="community-inline-actions">{pinControl(p)}<Link href={base + "/" + p.id}>상세·관리</Link></td></>}
      </tr>)}</tbody>
    </table>
  </div>;
}

export function CommunityListView({ data, query, locale = "ko", admin = false }: { data: CommunityList | null; query: CommunityQuery; locale?: PublicLocale; admin?: boolean }) {
  const t = (ko: string, en: string) => boardText(locale, ko, en);
  const base = admin ? "/admin/member-board" : localizedPublicPath("/board", locale);
  return <section className={"community-board " + (admin ? "community-admin" : "community-public-list")}>
    <div className="community-heading"><div className="community-heading-inner"><div><h1>{admin ? "회원 게시판 관리" : t("주요 안내사항", "Announcements")}</h1><p>{admin ? "회원 게시글·댓글·신고와 공지사항을 관리합니다." : t("운영진이 전하는 모집·활동·참여 안내입니다.", "Recruitment, activities and participation updates from our team.")}</p></div>
      {admin&&<Link className="community-write" href={base+"/new"}>공지사항 작성</Link>}
    </div></div>
    <div className="community-content">
      {admin && data?.stats && <dl className="community-stats"><div><dt>전체 게시글</dt><dd>{data.stats.total}</dd></div><div><dt>신고 대기</dt><dd>{data.stats.reports}</dd></div><div><dt>숨김 게시글</dt><dd>{data.stats.hidden}</dd></div></dl>}
      {admin&&<nav className="community-tabs" aria-label={t("게시판 카테고리", "Board categories")}>
        <Link href={boardHref(base, { ...query, category: "all", page: 1 })} aria-current={query.category === "all" ? "page" : undefined}>{t("전체", "All")}</Link>
        {boardCategories.map(c => <Link key={c.value} href={boardHref(base, { ...query, category: c.value, page: 1 })} aria-current={query.category === c.value ? "page" : undefined}>{t(c.ko, c.en)}</Link>)}
      </nav>}
      <div className="community-layout"><div>
        <BoardFilters key={boardHref(base, query)} base={base} query={query} locale={locale} admin={admin} />
        {data && <p className="community-result-count">{t("게시글", "Posts")} <strong>{data.total.toLocaleString(locale)}</strong></p>}
        <PostTable data={data} query={query} base={base} locale={locale} admin={admin} />
        {data && <BoardPagination base={base} query={query} total={data.total} locale={locale} />}
      </div></div>
    </div>
  </section>;
}

export function date(value: string, locale: PublicLocale) {
  return new Intl.DateTimeFormat(locale, { timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
function listDate(value: string, locale: PublicLocale) {
  return new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-GB", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}
export function BoardPagination({ base, query, total, locale = "ko" }: { base: string; query: CommunityQuery; total: number; locale?: PublicLocale }) {
  const pages = Math.max(1, Math.ceil(total / 20));
  const t = (ko: string, en: string) => boardText(locale, ko, en);
  return <nav className="community-pagination" aria-label={t("게시글 페이지", "Post pages")}>
    {query.page > 1 && <Link href={boardHref(base, { ...query, page: query.page - 1 })} aria-label={t("이전 페이지", "Previous page")}>‹</Link>}
    <span>{query.page} / {pages}</span>
    {query.page < pages && <Link href={boardHref(base, { ...query, page: query.page + 1 })} aria-label={t("다음 페이지", "Next page")}>›</Link>}
  </nav>;
}
