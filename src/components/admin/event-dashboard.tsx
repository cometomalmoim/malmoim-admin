import 'server-only';
import Link from 'next/link';
import { getAdminAccess } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { AdminShell } from './admin-shell';
import './event-dashboard.css';

type DashboardEvent = {
  id: string; slug: string; title: string; starts_at: string | null; ends_at: string | null;
  location: string; status: string; applications_open: boolean; visual_theme: string;
};
const fields = 'id,slug,title,starts_at,ends_at,location,status,applications_open,visual_theme';
const statuses: Record<string,string> = {draft:'초안',published:'게시',closed:'모집 마감'};
const dateFormat = new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'long',day:'numeric',weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false});

async function getDashboard() {
  if ((await getAdminAccess()).status !== 'admin') return null;
  try {
    const client = await createClient();
    const now = new Date().toISOString();
    const [recent,upcoming,unscheduled] = await Promise.all([
      client.from('recruitment_events').select(fields,{count:'exact'}).order('created_at',{ascending:false}).order('id',{ascending:true}).limit(6),
      // Recruitment closure is separate from the event date: future closed events still appear.
      client.from('recruitment_events').select(fields,{count:'exact'}).gte('starts_at',now).order('starts_at',{ascending:true}).order('id',{ascending:true}).limit(5),
      client.from('recruitment_events').select('id',{count:'exact',head:true}).is('starts_at',null),
    ]);
    if (recent.error || upcoming.error || unscheduled.error) return null;
    return {events:recent.data as DashboardEvent[],upcoming:upcoming.data as DashboardEvent[],total:recent.count??0,upcomingCount:upcoming.count??0,unscheduled:unscheduled.count??0};
  } catch { return null; }
}

function EventRows({events,upcoming=false}:{events:DashboardEvent[];upcoming?:boolean}) {
  return <ul className="dash-events">{events.map((event,index)=><li key={event.id} className={event.visual_theme==='halloween'?'dash-event-halloween':''}>
    {upcoming&&<span className="dash-order" aria-label={`${index+1}번째 일정`}>{String(index+1).padStart(2,'0')}</span>}
    <div className="dash-event-info"><div className="dash-event-title"><Link href={`/admin/events/${encodeURIComponent(event.slug)}/overview`}>{event.title}</Link><span className="ops-tag">{statuses[event.status]??'상태 확인 필요'}</span></div>
    <p>{event.starts_at?<time dateTime={event.starts_at}>{dateFormat.format(new Date(event.starts_at))}</time>:'행사 일시 미정'}{event.location&&<> · {event.location}</>}</p>
    <small>실제 접수: {event.applications_open?'접수 허용 설정':'비활성'}</small></div>
    <div className="dash-event-actions"><Link href={`/admin/events/${encodeURIComponent(event.slug)}/edit`}>정보 수정</Link><Link href={`/admin/events/${encodeURIComponent(event.slug)}/applicants`}>신청자</Link></div>
  </li>)}</ul>;
}

export async function EventDashboard({email}:{email:string}) {
  const data = await getDashboard();
  return <AdminShell current="" title="대시보드" email={email}>
    <div className="ops-heading dash-heading"><div><span className="dash-eyebrow">EVENT OPERATIONS</span><h1>이벤트 운영 대시보드</h1><p>다가오는 일정과 등록된 이벤트를 한곳에서 확인하세요.</p></div><Link className="ops-link" href="/admin/events/new">+ 이벤트 등록</Link></div>
    {!data?<section className="ops-panel" role="alert"><h2>이벤트 현황을 불러오지 못했습니다</h2><p>연결 설정과 조회 권한을 확인한 뒤 다시 시도해주세요.</p><Link className="ops-link" href="/admin">다시 시도</Link></section>:<>
    <section className="ops-stats" aria-label="이벤트 운영 요약">{[['등록된 이벤트',data.total,'전체 등록 건수'],['예정된 이벤트',data.upcomingCount,'시작 전 이벤트 · 초안 포함'],['일시 미정',data.unscheduled,'행사 시작일을 설정해주세요']].map(([label,count,note])=><article className="ops-panel" key={label}><h2>{label}</h2><strong>{count}</strong><p className="ops-muted">{note}</p></article>)}</section>
    <section className="ops-panel"><div className="dash-section-heading"><h2>예정된 이벤트</h2><span>가까운 시작일 순 · 한국시간</span></div><p className="ops-muted">시작 전 이벤트를 최대 5개 표시합니다. 모집 마감 여부와 행사 일정은 별개입니다.</p>{data.upcoming.length?<EventRows events={data.upcoming} upcoming/>:<p className="ops-empty">시작일이 지정된 예정 이벤트가 없습니다.</p>}</section>
    <section className="ops-panel"><div className="dash-section-heading"><h2>이벤트 목록</h2><Link className="ops-link" href="/admin/events">전체 {data.total}개 보기 →</Link></div><p className="ops-muted">최근 등록한 이벤트 최대 6개입니다. 날짜가 미정인 이벤트도 표시합니다.</p>{data.events.length?<EventRows events={data.events}/>:<div className="ops-empty"><p>아직 등록된 이벤트가 없습니다.</p><Link className="ops-link" href="/admin/events/new">첫 이벤트 등록</Link></div>}</section>
    </>}
    <section className="ops-panel"><h2>운영 메뉴 바로가기</h2><div className="ops-shortcuts"><Link href="/admin/events">이벤트 관리 →</Link><Link href="/admin/recruitment">모집 페이지 →</Link><Link href="/admin/resources">자료실 →</Link><Link href="/admin/schedule">스케줄 →</Link></div></section>
  </AdminShell>;
}
