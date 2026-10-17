import {EventApplicantSummary} from './event-applicant-summary';
import {TrafficLinks} from './traffic-links';
import {ApplicantList} from './applicant-list';
import type {ApplicantQuery} from '@/lib/applicant-validation';
import Link from "next/link";
import { notFound } from "next/navigation";
import { getRecruitment } from "@/lib/recruitment";
import { AdminShell } from "./admin-shell";
import './events.css';
export async function RecruitmentView({ email, slug, page, query, recruitment = false }: { email: string; slug?: string; page?: number; query?:ApplicantQuery; recruitment?: boolean }) {
  const result = await getRecruitment(slug, page, query,recruitment);
  if (result.kind === "missing") notFound();
  const title = slug ? "이벤트 신청자·운영" : recruitment ? "전체 신청자관리" : "이벤트 관리";
  return <AdminShell email={email} current={recruitment ? "recruitment" : "events"} title={title}>
    <nav className="ops-breadcrumb" aria-label="페이지 이동 경로"><Link href="/admin">홈</Link><span>/</span><Link href="/admin/events">이벤트 관리</Link>{slug && <><span>/</span><span>{result.kind === "ready" ? result.event?.title : "신청자"}</span></>}</nav>
    <div className="ops-heading"><h1>{title}</h1>{!slug && !recruitment && <Link className="ops-link" href="/admin/events/new">+ 이벤트 등록</Link>}<p>{slug ? "이벤트별 신청 내역을 확인합니다. 신청 접수와 참가 확정은 별도 상태입니다." : recruitment?'이벤트별 신청 내역과 유입경로를 함께 검색합니다. 선발·입금 상태는 목록에서, 나머지 정보는 상세·수정에서 관리합니다.':'행사를 선택하고 정보·신청자·참여 및 출석을 한곳에서 관리하세요.'}</p></div>
    {result.kind === "error" ? <section className="ops-panel" role="alert"><h2>목록을 불러오지 못했습니다</h2><p>연결 설정 또는 조회 권한을 확인한 뒤 다시 시도해주세요.</p><Link className="ops-link" href={slug ? `/admin/events/${encodeURIComponent(slug)}/applicants` : recruitment ? "/admin/recruitment" : "/admin/events"}>다시 시도</Link></section> : recruitment ? <><details className="ops-panel applicant-overview-help"><summary>전체 조회 안내·바로가기</summary><div className="ops-shortcuts"><Link href="/admin/events">이벤트별 운영 화면</Link><Link href="/admin/participants">전체 참여 이력 관리</Link></div><p>여러 행사의 신청 내역과 유입경로를 비교하는 공간입니다. 행사별 선발·입금·참여 기록 관리는 이벤트 신청자·운영에서, 사람별 실제 참석 횟수는 전체 참여 이력 관리에서 확인합니다.</p>{query?.event&&<div className="ops-shortcuts"><Link href="/admin/recruitment">전체 이벤트 신청자로 보기</Link>{result.events.filter(e=>e.id===query.event).map(e=><Link key={e.id} href={`/admin/events/${encodeURIComponent(e.slug)}/overview`}>{e.title} 개요 →</Link>)}</div>}</details><TrafficLinks/><ApplicantList title="전체 이벤트 신청자" rows={result.rows} count={result.count} page={result.page} query={query} events={result.events}/></> : slug ? <>
      <nav className="ops-tabs" aria-label="이벤트 관리"><Link href={`/admin/events/${encodeURIComponent(slug)}/overview`}>운영 홈</Link><Link href={`/admin/events/${encodeURIComponent(slug)}/applicants`} aria-current="page">신청자·선발</Link><Link href={`/admin/events/${encodeURIComponent(slug)}/attendance`}>참여·출석</Link><Link href={`/admin/events/${encodeURIComponent(slug)}/resources`}>자료</Link></nav>
      {result.event&&<EventApplicantSummary eventId={result.event.id} slug={slug}/>}<ApplicantList slug={slug} title={result.event?.title??'이벤트'} rows={result.rows} count={result.count} page={result.page} query={query}/></> : <section className="ops-panel"><h2>이벤트 선택</h2><p className="ops-muted">이벤트 이름을 선택하면 해당 행사의 운영 홈으로 이동합니다.</p>{!result.events.length?<div className="ops-empty">등록된 이벤트가 없습니다.</div>:<ul className="event-directory">{result.events.map(event=><li key={event.id}><Link href={`/admin/events/${encodeURIComponent(event.slug)}/overview`}><span>{event.title}</span><span aria-hidden="true">→</span></Link></li>)}</ul>}</section>}

  </AdminShell>;
}
