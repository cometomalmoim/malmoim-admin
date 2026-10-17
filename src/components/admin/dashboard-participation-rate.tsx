import 'server-only';
import {cache}from 'react';
import Link from 'next/link';
import {getAdminAccess}from '@/lib/auth';
import {createClient}from '@/lib/supabase/server';
import {koreanDate,summarizeParticipationRate,groupParticipationTrends,type DashboardSession}from '@/lib/participation-rate';
const getRate=cache(async(eventIds:string[])=>{
 if((await getAdminAccess()).status!=='admin')return null;
 try{
  const client=await createClient(),rows:DashboardSession[]=[],today=koreanDate();
  // Page over the aggregate view; never fetch applicant contact details.
  for(let start=0;start<eventIds.length;start+=100){
   for(let offset=0;;offset+=100){
    const result=await client.from('event_session_overview').select('id,event_id,event_title,event_slug,title,session_date,confirmed_count,attended_count,unrecorded_count').eq('is_test',false).in('event_id',eventIds.slice(start,start+100)).lt('session_date',today).order('id').range(offset,offset+99);
    if(result.error)return null;
    rows.push(...result.data);
    if(result.data.length<100)break;
   }
  }
  return {...summarizeParticipationRate(rows),events:groupParticipationTrends(rows)};
 }catch{return null;}
});
export async function DashboardParticipationRate({eventIds}:{eventIds:string[]}){
 const data=await getRate(eventIds);
 return <article className="ops-panel dash-rate"><h2>이벤트 참여율</h2>{!data?<><strong>조회 실패</strong><p className="ops-muted">출석 현황을 다시 확인해주세요.</p></>:<><strong>{data.percent===null?'집계 전':`${data.percent}%`}</strong><p className="ops-muted">출석 {data.attended} / 참가 확정 {data.confirmed}명 · {data.sessions}회차</p>{data.unrecorded>0&&<p className="dash-rate-warning">출석 미입력 {data.unrecorded}명 · 잠정 수치</p>}<details><summary>참여율 기준</summary><p>지난 날짜의 회차별 출석 ÷ 참가 확정 인원입니다. 같은 사람이 여러 회차에 참여하면 회차마다 집계합니다. 오늘·예정 회차, 테스트·삭제 이벤트, 날짜 없는 과거 출석은 제외합니다. 미입력도 확정 인원에 포함하므로 출석 입력 후 수치가 바뀔 수 있습니다.</p></details></>}<Link href="/admin/participants?view=sessions">회차별 현황 →</Link></article>;
}

export async function DashboardParticipationTrend({eventIds}:{eventIds:string[]}){
 const data=await getRate(eventIds);
 return <section className="ops-panel dash-trends"><div className="dash-section-heading"><h2>이벤트별 참여 추이</h2><span>최근 지난 회차 기준 · 최대 5개 이벤트</span></div><p className="ops-muted">막대는 참가 확정 대비 출석 비율입니다. 회차가 여러 개면 펼쳐서 비교하세요.</p>{!data?<p role="status">참여 추이를 불러오지 못했습니다.</p>:!data.events.length?<p className="ops-empty">집계할 지난 회차가 없습니다. 날짜별 출석을 기록하면 그래프가 표시됩니다.</p>:<ul className="dash-trend-list">{data.events.slice(0,5).map(event=><li key={event.eventId}><div className="dash-trend-heading"><Link href={`/admin/events/${encodeURIComponent(event.slug)}/attendance`}>{event.title}</Link><span>{event.totals.percent===null?'집계 전':`${event.totals.percent}%`}{event.totals.unrecorded>0?' · 잠정':''}</span></div><meter className="dash-rate-meter" min={0} max={100} value={event.totals.percent??0} aria-label={`${event.title} 참여율 ${event.totals.percent===null?'집계 전':`${event.totals.percent}%`}`}/><details><summary>{event.totals.sessions}회차 · 출석 {event.totals.attended} / 확정 {event.totals.confirmed}명{event.totals.unrecorded>0?` · 미입력 ${event.totals.unrecorded}명`:''}</summary><ul>{event.sessions.map(session=>{const rate=summarizeParticipationRate([session]);return <li key={session.id}><Link href={`/admin/events/${encodeURIComponent(event.slug)}/attendance?session=${session.id}`}>{session.session_date} · {session.title}</Link><span>{rate.percent===null?'집계 전':`${rate.percent}%`} · {rate.attended}/{rate.confirmed}명{rate.unrecorded>0?` · 미입력 ${rate.unrecorded}명`:''}</span><meter className="dash-rate-meter" min={0} max={100} value={rate.percent??0} aria-label={`${session.session_date} 출석률 ${rate.percent??'집계 전'}`}/></li>;})}</ul></details></li>)}</ul>}<Link className="dash-detail-link" href="/admin/participants?view=sessions">전체 회차 현황 →</Link></section>;
}
