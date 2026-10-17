import 'server-only';
import Link from 'next/link';
import {getAdminAccess}from '@/lib/auth';
import {createClient}from '@/lib/supabase/server';
import {summarizeParticipants}from '@/lib/participation-rate';
async function getParticipants(){
 if((await getAdminAccess()).status!=='admin')return null;
 try{const client=await createClient(),rows:{attendance_count:number|string}[]=[];
  for(let offset=0;;offset+=100){const result=await client.from('event_person_totals').select('id,attendance_count').gt('attendance_count',0).order('id').range(offset,offset+99);if(result.error)return null;rows.push(...result.data);if(result.data.length<100)break;}
  return summarizeParticipants(rows);
 }catch{return null;}
}
export async function DashboardParticipants(){
 const data=await getParticipants();
 return <section className="ops-panel dash-participants"><div className="dash-section-heading"><h2>참여자 요약</h2><Link className="dash-detail-link" href="/admin/participants">참여 이력 →</Link></div>{!data?<p role="status">참여자 요약을 불러오지 못했습니다.</p>:<div className="dash-participant-grid"><div><span className="ops-muted">실제 참여자</span><strong>{data.participants}<small>명</small></strong><p className="ops-muted">동일인 연결된 실제 참석자 · 테스트 제외</p></div><div><div className="dash-participant-label"><span>첫 참여 · 재참여 비중</span><strong>{data.repeatPercent===null?'집계 전':`재참여 ${data.repeatPercent}%`}</strong></div>{data.participants>0?<><div className="dash-composition" role="img" aria-label={`1개 이벤트 참여 ${data.firstOnly}명, 2개 이상 이벤트 재참여 ${data.repeat}명`}><span style={{width:`${100-(data.repeatPercent??0)}%`}}/><span style={{width:`${data.repeatPercent}%`}}/></div><div className="dash-chart-legend"><span>1개 이벤트 {data.firstOnly}명</span><span>2개 이상 재참여 {data.repeat}명</span></div></>:<p className="ops-empty">실제 출석 기록이 쌓이면 비중을 표시합니다.</p>}<p className="ops-muted">누적 이력 기준으로 삭제된 이벤트의 참석도 보존합니다. 여러 회차의 같은 이벤트는 1개로 셉니다.</p></div></div>}</section>;
}
