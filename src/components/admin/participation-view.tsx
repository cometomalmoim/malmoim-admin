import Link from 'next/link';import {notFound} from 'next/navigation';
import {participationData} from '@/lib/participation';import {confirmations,attendances} from '@/lib/participation-validation';
import {AdminShell} from './admin-shell';import {ParticipationEditor} from './participation-editor';import './events.css';import './participation.css';
export async function ParticipationView({email,slug,source,id,query={}}:{email:string;slug?:string;source?:string;id?:string;query?:{q?:string;person?:string}}){
 const data=await participationData(slug,source,id,query.q??'',query.person);if('missing'in data)notFound();
 return <AdminShell email={email} current="participants" title="참여이력관리"><div className="ops-heading"><h1>참여이력관리</h1><p>실제 참석으로 기록한 이벤트 수를 집계합니다. 신청·합격·입금과 구분하며 테스트는 실제 횟수에서 제외합니다.</p></div>
 {'error'in data?<section className="ops-panel" role="alert">참여 이력을 불러오지 못했습니다. DB 적용 및 조회 권한을 확인해주세요.</section>:<>
 <nav className="ops-shortcuts"><Link href="/admin/participants">전체 사람 검색</Link>{slug&&<Link href={`/admin/events/${encodeURIComponent(slug)}/applicants`}>이 이벤트 신청자 목록</Link>}</nav>
 {data.application&&<section className="ops-panel"><h2>{data.application.name} · {data.event?.title}</h2><p>{data.application.contact}</p>{data.event?.is_test&&<p className="notice">테스트 이벤트입니다. 출석을 기록해도 실제 참여 횟수에는 포함되지 않습니다.</p>}<p>과거 참여 여부를 적은 신청 응답은 실제 참석 횟수로 자동 변환하지 않습니다.</p></section>}
 <section className="ops-panel"><h2>{slug?'기존 사람 찾기·연결':'사람 검색'}</h2><form key={query.q??''} method="get" className="participation-search"><label>이름·연락처<input name="q" defaultValue={query.q} maxLength={100}/></label><button className="evt-primary">검색</button></form><p className="ops-muted">최대 50명을 표시합니다. 검색어로 범위를 좁혀주세요.</p>
 {!slug&&<ul className="participation-people">{data.people.map(p=><li key={p.id}><Link href={`/admin/participants?person=${p.id}`}>{p.name}</Link><span>{p.contact}</span><strong>실제 참석 {p.attendance_count}회</strong><small>테스트 참석 {p.test_attendance_count}회</small></li>)}</ul>}
 {slug&&data.application&&<ParticipationEditor slug={slug} source={source!} id={id!} current={data.current} people={data.people} profile={data.profile}/>}
 </section>
 {data.profile&&<><section className="ops-panel"><h2>{data.profile.name}의 집계</h2><div className="participation-stats"><p>연결된 신청 <strong>{data.profile.application_count}건</strong></p><p>참가 확정 <strong>{data.profile.confirmed_count}건</strong></p><p>실제 참석 <strong>{data.profile.attendance_count}회</strong></p><p>테스트 참석 <strong>{data.profile.test_attendance_count}회</strong></p></div><p className="ops-muted">같은 이벤트는 한 사람에게 한 번만 연결할 수 있습니다. 신청·참가 확정 건수도 테스트 이벤트를 제외합니다.</p></section>
 <section className="ops-panel"><h2>이벤트별 이력</h2><ul className="participation-history">{data.history.map(row=><li key={`${row.source}-${row.application_id}`}><Link href={`/admin/events/${row.recruitment_events.slug}/participants/${row.source}/${row.application_id}`}>{row.recruitment_events.title}</Link>{row.recruitment_events.is_test&&<strong>테스트</strong>}<span>{confirmations[row.confirmation as keyof typeof confirmations]} · {attendances[row.attendance as keyof typeof attendances]}</span><p>{row.note||'메모 없음'}</p></li>)}</ul></section></>}
 </>}
 </AdminShell>;
}
