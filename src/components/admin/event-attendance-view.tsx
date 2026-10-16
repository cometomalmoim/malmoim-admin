import Link from 'next/link';
import {notFound} from 'next/navigation';
import {getRecruitment} from '@/lib/recruitment';
import {createClient} from '@/lib/supabase/server';
import {confirmations,attendances} from '@/lib/participation-validation';
import {AdminShell} from './admin-shell';
import './events.css';

export async function EventAttendanceView({email,slug,page,query={}}:{email:string;slug:string;page?:number;query?:{q?:string}}){
 const data=await getRecruitment(slug,page,{q:query.q});
 if(data.kind==='missing')notFound();
 const base=`/admin/events/${encodeURIComponent(slug)}`;
 let records:{source:string;application_id:string;confirmation:string;attendance:string}[]=[];
 let failed=data.kind==='error';
 if(data.kind==='ready'&&data.event&&data.rows.length){
  try{
   const client=await createClient();
   const result=await client.from('event_participation').select('source,application_id,confirmation,attendance').eq('event_id',data.event.id).in('application_id',data.rows.map(row=>row.id));
   if(result.error)failed=true;else records=result.data;
  }catch{failed=true;}
 }
 return <AdminShell email={email} current="events" title="이벤트 참여·출석"><nav className="ops-breadcrumb" aria-label="페이지 이동 경로"><Link href="/admin/events">이벤트 관리</Link><span>/</span><Link href={`${base}/overview`}>{data.kind==='ready'?data.event?.title:'이벤트'}</Link><span>/</span><span>참여·출석</span></nav><div className="ops-heading"><h1>참여·출석</h1><p>이 행사의 참가 확정과 출석 기록을 확인합니다. 신청·합격·입금과 별도 기록입니다.</p></div><nav className="ops-tabs" aria-label="이벤트 관리"><Link href={`${base}/overview`}>운영 홈</Link><Link href={`${base}/information`}>이벤트 정보</Link><Link href={`${base}/applicants`}>신청자·선발</Link><Link href={`${base}/attendance`} aria-current="page">참여·출석</Link></nav>
 {failed?<section className="ops-panel" role="alert"><h2>참여·출석을 불러오지 못했습니다</h2><p>연결 설정과 조회 권한을 확인한 뒤 다시 시도해주세요.</p><Link href={`${base}/attendance`}>다시 시도</Link></section>:data.kind==='ready'&&<section className="ops-panel"><h2>{data.event?.title} · {data.count}건</h2><p>개인별 기록 화면에서 본인 확인·연결 후 참가 상태와 출석을 저장합니다. 연결되지 않은 신청자를 미참석으로 집계하지 않습니다.</p><form method="get" className="event-attendance-header"><label>이름·연락처 검색<input name="q" defaultValue={query.q??''} maxLength={100}/></label><button className="evt-primary">검색</button><Link href={`${base}/attendance`}>초기화</Link></form>{!data.rows.length?<p>조건에 맞는 신청자가 없습니다.</p>:<div className="ops-table-scroll"><table className="ops-applications"><thead><tr>{['이름','연락처','참가 상태','출석','관리'].map(label=><th key={label}>{label}</th>)}</tr></thead><tbody>{data.rows.map(row=>{const record=records.find(item=>item.source===row.source&&item.application_id===row.id);return <tr key={`${row.source}-${row.id}`}><td>{row.name}</td><td>{row.contact}</td><td>{record?confirmations[record.confirmation as keyof typeof confirmations]??'확인 필요':'사람 연결 전'}</td><td>{record?attendances[record.attendance as keyof typeof attendances]??'확인 필요':'미기록'}</td><td><Link href={`${base}/participants/${row.source}/${row.id}`}>참여·출석 관리 →</Link></td></tr>;})}</tbody></table></div>}<nav className="ops-shortcuts" aria-label="참여·출석 목록 페이지">{data.page>1&&<Link href={`${base}/attendance?${new URLSearchParams({q:query.q??'',page:String(data.page-1)})}`}>← 이전</Link>}<span>{data.page}페이지</span>{data.page*25<data.count&&<Link href={`${base}/attendance?${new URLSearchParams({q:query.q??'',page:String(data.page+1)})}`}>다음 →</Link>}</nav></section>}
 </AdminShell>;
}
