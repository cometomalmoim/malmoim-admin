import Link from 'next/link';
import {notFound} from 'next/navigation';
import {getRecruitment} from '@/lib/recruitment';
import {createClient} from '@/lib/supabase/server';
import {EventSessionEditor,type EventSession} from './event-session-editor';
import {validId} from '@/lib/participation-validation';
import {AttendanceRoster} from './attendance-roster';
import {AdminShell} from './admin-shell';
import './events.css';

export async function EventAttendanceView({email,slug,page,query={}}:{email:string;slug:string;page?:number;query?:{q?:string;session?:string}}){
 const data=await getRecruitment(slug,page,{q:query.q});
 if(data.kind==='missing')notFound();
 const base=`/admin/events/${encodeURIComponent(slug)}`;
 let sessions:EventSession[]=[];
 let selected:EventSession|undefined;
 let records:{source:string;application_id:string;confirmation:string;attendance:string;note:string;revision:number;legacy_attendance:string}[]=[];
 let dated:{source:string;application_id:string;attendance:string;revision:number}[]=[];
 let failed=data.kind==='error';
 if(data.kind==='ready'&&data.event){
  try{
   const client=await createClient();
   const result=await client.from('event_sessions').select('id,session_date,title,revision').eq('event_id',data.event.id).order('session_date',{ascending:false}).limit(500);
   if(result.error)failed=true;else sessions=result.data;
   const today=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Seoul'});
   selected=query.session?sessions.find(s=>s.id===query.session):sessions.find(s=>s.session_date<=today)??sessions.at(-1);
   if(query.session&&(!validId(query.session)||!selected))failed=true;
   if(data.rows.length){
    const links=await client.from('event_participation').select('source,application_id,confirmation,attendance,note,revision,legacy_attendance').eq('event_id',data.event.id).in('application_id',data.rows.map(row=>row.id));
    if(links.error)failed=true;else records=links.data;
    if(selected){const marks=await client.from('event_session_attendance').select('source,application_id,attendance,revision').eq('session_id',selected.id).in('application_id',data.rows.map(row=>row.id));if(marks.error)failed=true;else dated=marks.data;}
   }
  }catch{failed=true;}
 }
 return <AdminShell email={email} current="events" title="이벤트 참여·출석"><nav className="ops-breadcrumb" aria-label="페이지 이동 경로"><Link href="/admin/events">이벤트 관리</Link><span>/</span><Link href={`${base}/overview`}>{data.kind==='ready'?data.event?.title:'이벤트'}</Link><span>/</span><span>참여·출석</span></nav><div className="ops-heading"><h1>참여·출석</h1><p>진행 날짜를 선택하고 그날의 출석을 기록합니다. 참가 확정은 이벤트 기준, 출석은 날짜 기준입니다.</p></div><nav className="ops-tabs" aria-label="이벤트 관리"><Link href={`${base}/overview`}>운영 홈</Link><Link href={`${base}/information`}>이벤트 정보</Link><Link href={`${base}/applicants`}>신청자·선발</Link><Link href={`${base}/attendance`} aria-current="page">참여·출석</Link></nav>
 {failed?<section className="ops-panel" role="alert"><h2>참여·출석을 불러오지 못했습니다</h2><p>연결 설정과 조회 권한을 확인한 뒤 다시 시도해주세요.</p><Link href={`${base}/attendance`}>다시 시도</Link></section>:data.kind==='ready'&&<section className="ops-panel"><h2>{data.event?.title} · {data.count}건</h2><p>① 진행 날짜 추가 → ② 날짜 선택 → ③ 명단에서 출석 체크</p><EventSessionEditor slug={slug}/><form key={selected?.id??'empty'} method="get" className="event-attendance-header"><input type="hidden" name="q" value={query.q??''}/><label>출석을 확인할 날짜<select name="session" defaultValue={selected?.id??''} required><option value="" disabled>진행 날짜 선택</option>{sessions.map(session=><option key={session.id} value={session.id}>{session.session_date} · {session.title}</option>)}</select></label><button className="evt-primary" disabled={!sessions.length}>날짜 보기</button></form>{selected?<><div className="session-current"><span>선택한 진행 날짜</span><h3>{selected.session_date} · {selected.title}</h3></div><EventSessionEditor key={`${selected.id}:${selected.revision}`} slug={slug} current={selected}/><p className="attendance-hint">기존 날짜 없는 출석은 보존됩니다. 자동으로 특정 날짜에 배정하지 않습니다.</p><form method="get" className="event-attendance-header"><input type="hidden" name="session" value={selected.id}/><label>이름·연락처 검색<input name="q" defaultValue={query.q??''} maxLength={100}/></label><button className="evt-primary">검색</button>{query.q&&<Link href={`${base}/attendance?session=${selected.id}`}>검색 초기화</Link>}</form>{!data.rows.length?<p>조건에 맞는 신청자가 없습니다.</p>:<AttendanceRoster key={selected.id} sessionId={selected.id} sessionRevision={selected.revision} slug={slug} rows={data.rows.map(row=>({id:row.id,source:row.source,name:row.name,contact:row.contact,record:(()=>{const linked=records.find(item=>item.source===row.source&&item.application_id===row.id);const mark=dated.find(item=>item.source===row.source&&item.application_id===row.id);return linked?{...linked,attendance:mark?.attendance??'unrecorded',session_revision:mark?.revision??0}:null;})()}))}/>}<nav className="ops-shortcuts" aria-label="참여·출석 목록 페이지">{data.page>1&&<Link href={`${base}/attendance?${new URLSearchParams({q:query.q??'',session:selected.id,page:String(data.page-1)})}`}>← 이전</Link>}<span>{data.page}페이지</span>{data.page*25<data.count&&<Link href={`${base}/attendance?${new URLSearchParams({q:query.q??'',session:selected.id,page:String(data.page+1)})}`}>다음 →</Link>}</nav></>:<div className="session-empty"><h3>등록된 진행 날짜가 없습니다</h3><p>위의 ‘진행 날짜 추가’에서 첫 회차를 등록해주세요. 지난 출석 기록은 그대로 보존되어 있습니다.</p></div>}</section>}
 </AdminShell>;
}
