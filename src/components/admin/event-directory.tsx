import Link from 'next/link';
import type {RecruitmentEvent} from '@/lib/recruitment';
import {groupEventDirectory} from '@/lib/event-lifecycle';
import {EventArchiveControl} from './event-archive-control';
import {EventDeadline} from './event-deadline';
import {EventDirectoryThumbnail} from './event-directory-thumbnail';
import './event-directory.css';
const date=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'short',day:'numeric'});
function eventDate(value:string|null){return value&&Number.isFinite(Date.parse(value))?date.format(new Date(value)):'일정 미정';}
function eventState(event:RecruitmentEvent){
 if(event.status==='draft')return {label:'초안',kind:'draft'};
 if(event.status==='closed'||(event.closes_at&&Date.parse(event.closes_at)<=Date.now()))return {label:'모집 마감',kind:'closed'};
 return event.applications_open?{label:'모집 중',kind:'open'}:{label:'접수 중지',kind:'draft'};
}
export function EventDirectory({events}:{events:RecruitmentEvent[]}){
 const {active,ended,archived}=groupEventDirectory(events);
 function menu(event:RecruitmentEvent){return <details className="event-card-menu"><summary aria-label={`${event.title} 관리 메뉴`}>···</summary><div><EventArchiveControl key={`${event.id}:${event.archive_revision}`} slug={event.slug} title={event.title} revision={event.archive_revision} archived={event.is_archived}/></div></details>;}
 const compact=(items:RecruitmentEvent[])=><ul className="event-directory-small">{items.map(event=><li key={event.id}><Link href={`/admin/events/${encodeURIComponent(event.slug)}/overview`}><span>{event.title}</span><time>{eventDate(event.ends_at)}</time><span aria-hidden="true">→</span></Link>{menu(event)}</li>)}</ul>;
 return <div className="event-catalog"><section className="ops-panel event-catalog-panel"><div className="event-catalog-heading"><h2>운영 이벤트</h2><span>{active.length}개</span></div><p className="ops-muted">이벤트를 선택하면 모집페이지·신청자·출석 등 운영 작업으로 이동합니다.</p>{active.length?<ul className="event-catalog-list">{active.map(event=>{const state=eventState(event);const poster=event.image_url||(event.slug==='season9'?'/season9/recruitment-poster-ko.png':event.visual_theme==='halloween'?'/events/halloween-2026/poster.png':null);return <li key={event.id} className="event-catalog-card"><Link className="event-card-main" href={`/admin/events/${encodeURIComponent(event.slug)}/overview`}><EventDirectoryThumbnail src={poster}/><span className="event-card-copy"><strong>{event.title}</strong><span className="event-card-date">행사 일정 · {eventDate(event.starts_at)}{event.ends_at&&eventDate(event.ends_at)!==eventDate(event.starts_at)?` ~ ${eventDate(event.ends_at)}`:''}</span><span className="event-card-status"><span className={`event-card-state is-${state.kind}`}>{state.label}</span><EventDeadline closesAt={event.closes_at}/></span></span><span className="event-card-arrow" aria-hidden="true">→</span></Link>{menu(event)}</li>;})}</ul>:<div className="ops-empty">운영 중인 이벤트가 없습니다. 상단에서 새 이벤트를 등록해주세요.</div>}</section>{ended.length>0&&<details className="ops-panel event-catalog-ended" id="ended-events"><summary>종료된 이벤트 <span>{ended.length}개</span></summary><p className="ops-muted">지난 이벤트의 신청·출석 기록을 확인할 수 있습니다.</p>{compact(ended)}</details>}{archived.length>0&&<details className="ops-panel event-catalog-ended"><summary>삭제된 이벤트 <span>{archived.length}개</span></summary><p className="ops-muted">관련 기록을 보존합니다. 복원해도 신청 접수는 자동으로 열리지 않습니다.</p>{compact(archived)}</details>}</div>;
}
