import 'server-only';
import {cache}from 'react';
import {getDashboardAcquisition}from '@/lib/dashboard-acquisition';
import type {MarketingEvent}from '@/lib/marketing-comparison';
import {MonthlyAcquisitionChart}from './monthly-acquisition-chart';
import Link from 'next/link';
import {getAdminAccess}from '@/lib/auth';
import {createClient}from '@/lib/supabase/server';
import {koreanDate,summarizeParticipationRate,groupParticipationTrends,type DashboardSession}from '@/lib/participation-rate';
const getAcquisition=cache(getDashboardAcquisition);
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
 return <article className="ops-panel dash-rate"><h2>이벤트 참여율</h2>{!data?<><strong>조회 실패</strong><p className="ops-muted">출석 현황을 다시 확인해주세요.</p></>:<><strong>{data.percent===null?'집계 전':`${data.percent}%`}</strong><p className="ops-muted">출석 {data.attended} / 참가 확정 {data.confirmed}명 · {data.sessions}회차</p>{data.unrecorded>0&&<p className="dash-rate-warning">출석 미입력 {data.unrecorded}명 · 잠정 수치</p>}<details><summary>참여율 기준</summary><p>지난 날짜의 회차별 출석 ÷ 참가 확정 인원입니다. 같은 사람이 여러 회차에 참여하면 회차마다 집계합니다. 오늘·예정 회차, 테스트·삭제 이벤트, 날짜 없는 과거 출석은 제외합니다. 미입력도 확정 인원에 포함하므로 출석 입력 후 수치가 바뀔 수 있습니다.</p></details></>}</article>;
}

export async function DashboardParticipationTrend({eventIds,events}:{eventIds:string[];events:MarketingEvent[]}){
 const [rates,acquisition]=await Promise.all([getRate(eventIds),getAcquisition(events)]);
 const comparison=events.filter(event=>acquisition?.eventCounts.has(event.id)||rates?.events.some(row=>row.eventId===event.id)).sort((a,b)=>(b.starts_at??b.created_at).localeCompare(a.starts_at??a.created_at)).slice(0,5);
 const maxApplications=Math.max(1,...comparison.map(event=>acquisition?.eventCounts.get(event.id)??0));
 return <section className="ops-panel dash-trends"><div className="dash-section-heading"><h2>신청·참여 추이</h2><span>최근 12개월 · 현재 월 진행 중</span></div>{!acquisition||!rates?<p role="status">신청·참여 분석을 불러오지 못했습니다.</p>:<><MonthlyAcquisitionChart rows={acquisition.monthly}/><details open className="dash-analysis-detail"><summary>이벤트별 신청·참여 비교</summary><p className="ops-muted">최근 일정 순 최대 5개. 신청은 누적 건수, 참여율은 지난 회차의 출석 / 참가 확정 연인원입니다. 단위가 달라 각각의 눈금을 사용합니다.</p>{comparison.length?<ul className="dash-trend-list">{comparison.map(event=>{const rate=rates.events.find(row=>row.eventId===event.id),count=acquisition.eventCounts.get(event.id)??0;return <li key={event.id}><div className="dash-trend-heading"><Link href={`/admin/events/${encodeURIComponent(event.slug)}/overview`}>{event.title}</Link></div><label className="dash-comparison-label">신청 {count}건 <small>0–{maxApplications}건</small><meter className="dash-application-meter" min={0} max={maxApplications} value={count}/></label><label className="dash-comparison-label">참여율 {rate?.totals.percent==null?'집계 전':`${rate.totals.percent}%`}{rate&&rate.totals.unrecorded>0?' · 잠정':''} <small>0–100%</small><meter className="dash-rate-meter" min={0} max={100} value={rate?.totals.percent??0}/></label>{rate&&<details><summary>{rate.sessions.length}회차 상세</summary><ul>{rate.sessions.map(session=>{const value=summarizeParticipationRate([session]);return <li key={session.id}><Link href={`/admin/events/${encodeURIComponent(event.slug)}/attendance?session=${session.id}`}>{session.session_date} · {session.title}</Link><span>{value.percent==null?'집계 전':`${value.percent}%`} · 출석 {value.attended} / 확정 {value.confirmed}명{value.unrecorded?` · 미입력 ${value.unrecorded}명`:''}</span></li>;})}</ul></details>}</li>;})}</ul>:<p className="ops-empty">비교할 신청·회차 기록이 없습니다.</p>}</details></>}<Link className="dash-detail-link" href="/admin/participants?view=sessions">전체 회차 현황 →</Link></section>;
}

export async function DashboardAcquisitionChannels({events}:{events:MarketingEvent[]}){
 const data=await getAcquisition(events);
 return <section className="ops-panel dash-channel-panel"><div className="dash-section-heading"><h2>유입경로별 신청·참석 현황</h2><Link href="/admin/recruitment">신청자 자세히 보기 →</Link></div><p className="ops-muted">누적 신청 기준 · 테스트·삭제 기록 제외. 참석률은 참석 기록 건수 ÷ 신청 건수이며, 미연결·출석 미입력으로 달라질 수 있습니다.</p>{!data?<p role="status">유입 현황을 불러오지 못했습니다.</p>:data.channels.length?<div className="ops-table-scroll"><table className="dash-channel-table"><thead><tr><th>유입경로</th><th>신청</th><th>참석</th><th>신청 대비 참석률</th><th>이력 미연결</th></tr></thead><tbody>{data.channels.map(row=><tr key={row.source}><th scope="row"><Link href={`/admin/recruitment?utm_source=${encodeURIComponent(row.source==='unknown'?'__unknown':row.source==='other'?'':row.source)}`}>{row.label}</Link></th><td>{row.applications}건</td><td>{row.attended}건</td><td>{row.applications?`${Math.round(row.attended/row.applications*100)}%`:'—'}</td><td>{row.unlinked}건</td></tr>)}</tbody></table></div>:<p>집계할 신청이 없습니다.</p>}<details><summary>집계 기준</summary><p className="ops-muted">이벤트별 신청 한 건을 기준으로 세며 동일인의 여러 이벤트 신청은 각각 포함합니다. 날짜 없는 과거 참석도 포함합니다. 유입 미확인을 직접 방문으로 추정하지 않습니다. 참석률은 광고 클릭 대비 전환율이나 광고 성과의 인과관계를 나타내지 않습니다. 기타 경로는 전체 목록에서 확인합니다.</p></details></section>;
}
