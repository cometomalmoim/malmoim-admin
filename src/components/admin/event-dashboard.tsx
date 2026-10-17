import {DashboardParticipants}from './dashboard-participants';
import {DashboardParticipationRate,DashboardParticipationTrend}from './dashboard-participation-rate';
import 'server-only';import Link from 'next/link';import {getAdminAccess}from '@/lib/auth';import {createClient}from '@/lib/supabase/server';import {eventHasEnded,withinUpcomingWindow}from '@/lib/event-lifecycle';import {EventDeadline}from './event-deadline';import {AdminShell}from './admin-shell';import './events.css';import './event-dashboard.css';
type DashboardEvent={id:string;slug:string;title:string;created_at:string;starts_at:string|null;ends_at:string|null;closes_at:string|null;location:string;status:string;applications_open:boolean;visual_theme:string};
const fields='id,slug,title,created_at,starts_at,ends_at,closes_at,location,status,applications_open,visual_theme';
const statuses:Record<string,string>={draft:'초안',published:'게시',closed:'모집 마감'};
const dateFormat=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',dateStyle:'medium',timeStyle:'short'});
async function getDashboard(){
 if((await getAdminAccess()).status!=='admin')return null;
 try{const client=await createClient(),rows:DashboardEvent[]=[];
 for(let offset=0;;offset+=100){const result=await client.from('recruitment_events').select(fields).eq('is_test',false).eq('is_archived',false).order('created_at',{ascending:false}).order('id').range(offset,offset+99);if(result.error)return null;rows.push(...result.data as DashboardEvent[]);if(result.data.length<100)break;}
 const now=Date.now(),active=rows.filter(event=>!eventHasEnded(event,now)),ended=rows.filter(event=>eventHasEnded(event,now)).sort((a,b)=>Date.parse(b.ends_at!)-Date.parse(a.ends_at!));
 const upcoming=active.filter(event=>withinUpcomingWindow(event.starts_at,now)).sort((a,b)=>Date.parse(a.starts_at!)-Date.parse(b.starts_at!));
 const current=active.filter(event=>!event.starts_at||Date.parse(event.starts_at)<now);
 return {upcoming:upcoming.slice(0,5),current:current.slice(0,6),ended:ended.slice(0,5),total:active.length,upcomingCount:upcoming.length,endedCount:ended.length,eventIds:rows.map(event=>event.id),analyticsEvents:rows};
 }catch{return null;}
}
function EventRows({events,upcoming=false}:{events:DashboardEvent[];upcoming?:boolean}){
 return <ul className="dash-events">{events.map((event,index)=><li key={event.id} className={event.visual_theme==='halloween'?'dash-event-halloween':''}>{upcoming&&<span className="dash-order" aria-label={`${index+1}번째 일정`}>{String(index+1).padStart(2,'0')}</span>}<div className="dash-event-info"><div className="dash-event-title"><Link href={`/admin/events/${encodeURIComponent(event.slug)}/overview`}>{event.title}</Link><EventDeadline closesAt={event.closes_at}/><span className="ops-tag">{statuses[event.status]??'상태 확인 필요'}</span></div><p>{event.starts_at?<time dateTime={event.starts_at}>{dateFormat.format(new Date(event.starts_at))}</time>:'행사 일시 미정'}{event.location&&<> · {event.location}</>}</p><small>실제 접수: {event.applications_open?'접수 허용 설정':'비활성'}</small></div></li>)}</ul>;
}
export async function EventDashboard({email}:{email:string}){
 const data=await getDashboard();
 return <AdminShell current="" title="대시보드" email={email}><div className="ops-heading dash-heading"><div><span className="dash-eyebrow">EVENT OPERATIONS</span><h1>이벤트 운영 대시보드</h1><p>앞으로 한 달의 행사와 모집 마감일을 먼저 확인하세요.</p></div></div><div className="dash-topbar"><Link className="ops-link dash-register" href="/admin/events/new">＋ 이벤트 등록</Link><aside className="ops-panel dash-quick" aria-label="운영 메뉴 바로가기"><h2>운영 메뉴 바로가기</h2><nav><Link href="/admin/events">이벤트 관리</Link><Link href="/admin/recruitment">전체 신청자관리</Link><Link href="/admin/resources">자료실</Link><Link href="/admin/schedule">스케줄</Link></nav></aside></div>
 {!data?<section className="ops-panel" role="alert"><h2>이벤트 현황을 불러오지 못했습니다</h2><Link href="/admin">다시 시도</Link></section>:<><section className="ops-stats" aria-label="이벤트 운영 요약">{[['전체 운영 이벤트',data.total,'종료·테스트·삭제 제외'],['30일 내 예정',data.upcomingCount,'앞으로 한 달 내 시작']].map(([label,count,note])=><article className="ops-panel" key={label}><h2>{label}</h2><strong>{count}</strong><p className="ops-muted">{note}</p></article>)}<DashboardParticipationRate eventIds={data.eventIds}/></section>
 <section className="ops-panel"><div className="dash-section-heading"><h2>예정된 이벤트</h2><span>30일 이내 · 가까운 시작일 순 · 최대 5개</span></div><p className="ops-muted">앞으로 30일 안에 시작하는 행사만 표시합니다. 모집 마감 3일 이내는 빨간색이며, 이후 일정은 이벤트 관리에서 확인할 수 있습니다.</p>{data.upcoming.length?<EventRows events={data.upcoming} upcoming/>:<p className="ops-empty">30일 이내에 시작하는 이벤트가 없습니다.</p>}</section>
 {data.current.length>0&&<details className="ops-panel dash-secondary"><summary>진행·일정 확인 이벤트 · {data.current.length}개 표시</summary><p className="ops-muted">시작일이 지났거나 미정인 이벤트입니다. 종료일이 지난 행사는 아래 목록에 표시합니다.</p><EventRows events={data.current}/></details>}
 {data.endedCount>0&&<section className="ops-panel dash-ended"><div className="dash-section-heading"><h2>종료된 이벤트 · {data.endedCount}개</h2><Link href="/admin/events#ended-events">전체 보기 →</Link></div><ul>{data.ended.map(event=><li key={event.id}><Link href={`/admin/events/${encodeURIComponent(event.slug)}/overview`}>{event.title}</Link><time dateTime={event.ends_at!}>{dateFormat.format(new Date(event.ends_at!))}</time></li>)}</ul></section>}</>}
 <div className="dash-analytics">{data&&<DashboardParticipationTrend eventIds={data.eventIds} events={data.analyticsEvents}/>}<DashboardParticipants/></div>
 </AdminShell>;
}
