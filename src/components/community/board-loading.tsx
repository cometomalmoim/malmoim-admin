import type { PublicLocale } from "@/lib/public-content";
import { boardText } from "@/lib/community-board-model";
import "./community.css";

function Bar({ className = "" }: { className?: string }) {
 return <span className={"community-skeleton " + className} />;
}

// Keep the shared PublicFrame outside this boundary, just as on the loaded page.
export function CommunityLoading({ locale = "ko", view = "list" }: { locale?: PublicLocale; view?: "list" | "detail" | "new" | "edit" }) {
 const t = (ko: string, en: string) => boardText(locale, ko, en);
 const message = view === "list" ? t("게시판을 불러오는 중", "Loading the board") : view === "detail" ? t("게시글을 불러오는 중", "Loading the post") : t("작성 화면을 준비하는 중", "Preparing the editor");
 const status = <div className="community-loading-status" role="status"><span className="community-loading-dots" aria-hidden="true"><i /><i /><i /></span><strong>{message}</strong><span>{t("잠시만 기다려주세요.", "Please wait a moment.")}</span></div>;
 return <main id="public-main" lang={locale} tabIndex={-1} aria-busy="true">
  {view === "list" ? <section className="community-board community-public-list community-loading">
   <div className="community-heading"><div className="community-heading-inner"><div><h1>{t("주요 안내사항", "Announcements")}</h1><p>{t("운영진이 전하는 모집·활동·참여 안내입니다.", "Updates from the MALMOIM team.")}</p></div><div className="community-loading-heading-actions">{status}<span aria-hidden="true"><Bar className="community-skeleton-yellow" /></span></div></div></div>
   <div className="community-content" aria-hidden="true"><div className="community-tabs community-skeleton-tabs">{[0,1,2,3].map(i => <Bar key={i} />)}</div>
    <div className="community-layout"><div><div className="community-skeleton-filters"><Bar /><Bar /><Bar /><Bar className="community-skeleton-yellow" /></div><Bar className="community-skeleton-count" />
     <div className="community-skeleton-rows">{[0,1,2,3,4,5].map(i => <div className="community-skeleton-row" key={i}><Bar className="community-skeleton-category" /><div><Bar /><Bar className="community-skeleton-short" /></div><Bar className="community-skeleton-date" /></div>)}</div>
    </div></div>
   </div>
  </section> : <section className={"community-board community-loading " + (view === "detail" ? "community-detail community-detail-public" : "community-editor")}>
   {status}<div aria-hidden="true" className={view === "detail" ? "community-post-panel" : "community-skeleton-editor"}>
    <Bar className="community-skeleton-short" /><Bar className="community-skeleton-title" />
    {view === "detail" ? <><div className="community-skeleton-meta"><Bar /><Bar /><Bar /></div><div className="community-skeleton-body"><Bar /><Bar /><Bar className="community-skeleton-short" /></div><div className="community-skeleton-buttons"><Bar /><Bar className="community-skeleton-yellow" /></div></> : <><Bar className="community-skeleton-field" /><Bar className="community-skeleton-field" /><Bar className="community-skeleton-textarea" /><Bar className="community-skeleton-yellow community-skeleton-short" /></>}
   </div>{view === "detail" && <div className="community-comments" aria-hidden="true"><Bar className="community-skeleton-short" /><div className="community-skeleton-body"><Bar /><Bar /></div><Bar className="community-skeleton-field" /></div>}
  </section>}
 </main>;
}
