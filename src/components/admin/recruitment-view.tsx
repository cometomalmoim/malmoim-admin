import {ApplicantList} from './applicant-list';
import type {ApplicantQuery} from '@/lib/applicant-validation';
import Link from "next/link";
import { notFound } from "next/navigation";
import { getRecruitment } from "@/lib/recruitment";
import { AdminShell } from "./admin-shell";
import { HalloweenBanner } from './halloween-banner';
import './events.css';
const labels: Record<string,string> = { draft: "초안", published: "게시", closed: "마감", received: "접수", reviewing: "검토 중", accepted: "참가 확정", declined: "미선발", withdrawn: "취소" };
export async function RecruitmentView({ email, slug, page, query, recruitment = false }: { email: string; slug?: string; page?: number; query?:ApplicantQuery; recruitment?: boolean }) {
  const result = await getRecruitment(slug, page, query);
  if (result.kind === "missing") notFound();
  const title = slug ? "신청자 관리" : recruitment ? "모집 페이지" : "이벤트 관리";
  return <AdminShell email={email} current={recruitment ? "recruitment" : "events"} title={title}>
    <nav className="ops-breadcrumb" aria-label="페이지 이동 경로"><Link href="/admin">홈</Link><span>/</span><Link href="/admin/events">이벤트 관리</Link>{slug && <><span>/</span><span>{result.kind === "ready" ? result.event?.title : "신청자"}</span></>}</nav>
    <div className="ops-heading"><h1>{title}</h1>{!slug && !recruitment && <Link className="ops-link" href="/admin/events/new">+ 이벤트 등록</Link>}<p>{slug ? "이벤트별 신청 내역을 확인합니다. 신청 접수와 참가 확정은 별도 상태입니다." : "모집과 신청자 관리를 이벤트별로 확인합니다."}</p></div>
    {result.kind === "error" ? <section className="ops-panel" role="alert"><h2>목록을 불러오지 못했습니다</h2><p>연결 설정 또는 조회 권한을 확인한 뒤 다시 시도해주세요.</p><Link className="ops-link" href={slug ? `/admin/events/${encodeURIComponent(slug)}/applicants` : recruitment ? "/admin/recruitment" : "/admin/events"}>다시 시도</Link></section> : slug ? <>
      <nav className="ops-tabs" aria-label="이벤트 관리"><Link href="/admin/events">이벤트 목록</Link><Link href={`/admin/events/${encodeURIComponent(slug)}/applicants`} aria-current="page">신청자</Link><Link href={`/admin/events/${encodeURIComponent(slug)}/resources`}>자료</Link></nav>
      <ApplicantList slug={slug} title={result.event?.title??'이벤트'} rows={result.rows} count={result.count} page={result.page} query={query}/></> : <section className="ops-panel"><h2>{recruitment ? "모집 페이지 목록" : "이벤트 목록"}</h2>{!result.events.length ? <div className="ops-empty">등록된 이벤트가 없습니다.</div> : <div className="ops-grid">{result.events.map(event=><article key={event.id} className={`ops-recruitment-card ${event.visual_theme === "halloween" ? "evt-halloween-card" : ""}`} >{event.visual_theme === "halloween" && <HalloweenBanner/>}<span className="ops-tag">{labels[event.status] ?? "알 수 없음"}</span><h2>{event.title}{recruitment ? " 모집 페이지" : ""}</h2><p>연결 이벤트: {event.title}</p><p>실제 접수: {event.applications_open ? "접수 허용 설정" : "비활성"}</p>{event.slug === "halloween-2026" && <p className="evt-landing-links"><a className="ops-link" href="https://malmoim.com/2026halloweenparty" target="_blank" rel="noopener noreferrer">한국어 모집 페이지 ↗</a> <a className="ops-link" href="https://malmoim.com/2026halloweenparty/en" target="_blank" rel="noopener noreferrer">English ↗</a></p>}{event.slug === "season9" && <p><Link className="ops-link" href="/season9">한국어 모집 페이지</Link> <Link className="ops-link" href="/season9/en">영어 모집 페이지</Link></p>}<Link className="ops-link" href={`/admin/events/${encodeURIComponent(event.slug)}/overview`}>이벤트 정보·수정 →</Link> <Link className="ops-link" href={`/admin/events/${encodeURIComponent(event.slug)}/applicants`}>신청자 관리 →</Link> <Link className="ops-link" href={`/admin/events/${encodeURIComponent(event.slug)}/resources`}>자료 →</Link></article>)}</div>}</section>}
  </AdminShell>;
}
