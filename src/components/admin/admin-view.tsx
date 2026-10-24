import Link from "next/link";
import { HistoryPhotoUi } from "./simple-history-photo-ui";
import { adminPages, eventTabs } from "@/lib/admin-navigation";
import { AdminShell } from "./admin-shell";
import { ScopedPanel } from "./scoped-panel";
export function AdminView({ segments = [], email, preview = false }: { segments?: string[]; email?: string; preview?: boolean }) {
  const slug = segments[0] ?? "";
  const page = adminPages.find(p => p.slug === slug)!;
  const event = segments.length >= 2;
  const tab = eventTabs.find(t => t.slug === (segments[2] ?? "overview"));
  const base = preview ? "/preview/admin" : "/admin";
  const title = event ? "이벤트 구조 미리보기" : page.title;
  const description = event ? tab?.description : page.description;
  const shared = ["recruitment", "messages", "certificates", "resources"].includes(event ? tab?.slug ?? "" : slug);
  return <AdminShell current={slug} title={title} email={email} preview={preview}><nav className="ops-breadcrumb" aria-label="페이지 이동 경로"><Link href={base}>홈</Link>{slug && <><span aria-hidden="true">/</span><Link href={`${base}/${slug}`}>{page.title}</Link></>}{event && <><span aria-hidden="true">/</span><span>구조 미리보기</span></>}</nav><div className="ops-heading"><h1>{title}</h1><p>{description}</p></div>
  {event && <nav className="ops-tabs" aria-label="이벤트 상세 탭">{eventTabs.map(t => <Link key={t.slug} href={`${base}/events/structure/${t.slug}`} aria-current={tab?.slug === t.slug ? "page" : undefined}>{t.title}</Link>)}</nav>}
  {!slug ? <><section className="ops-stats" aria-label="운영 요약">{["이벤트", "신청", "회원"].map(t => <article className="ops-panel" key={t}><h2>{t}</h2><strong>—</strong><p className="ops-muted">아직 표시할 정보가 없습니다</p></article>)}</section><div className="ops-grid"><section className="ops-panel"><h2>예정된 이벤트</h2><div className="ops-empty"><p>표시할 예정 이벤트가 없습니다.</p></div></section><section className="ops-panel"><h2>처리할 운영 항목</h2><div className="ops-empty"><p>표시할 운영 항목이 없습니다.</p></div></section></div><section className="ops-panel"><h2>주요 메뉴 바로가기</h2><div className="ops-shortcuts">{["events","recruitment","schedule","accounts"].map(s => <Link key={s} href={`${base}/${s}`}>{adminPages.find(p => p.slug === s)?.title} →</Link>)}</div></section></> : slug === "history" && !preview ? <HistoryPhotoUi /> : shared ? <ScopedPanel feature={event ? tab!.slug : slug} scope={event ? {kind:"event",eventId:"structure",preview} : {kind:"all"}} preview={preview} base={base} /> : <section className="ops-panel"><h2>{event ? tab?.title : page.title}</h2><div className="ops-empty"><span className="ops-tag">준비 중</span><h3>{event ? "이벤트 상세 화면의 구성을 확인하세요" : "등록된 항목이 없습니다"}</h3><p>{event ? "실제 이벤트가 없는 개발 전용 미리보기입니다." : "안내와 운영 기능을 준비하고 있습니다."}</p></div>{slug === "events" && preview && <Link className="ops-link" href={`${base}/events/structure/overview`}>이벤트 상세 구조 미리보기 →</Link>}</section>}
  </AdminShell>;
}
