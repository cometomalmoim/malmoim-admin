import Link from 'next/link';
import {getAdminAccess} from '@/lib/auth';
import {createClient} from '@/lib/supabase/server';

export async function EventApplicantSummary({eventId,slug}:{eventId:string;slug:string}){
 if((await getAdminAccess()).status!=='admin')return null;
 const client=await createClient();
 const filters=[['전체 신청','',''],['접수','status','received'],['검토 중','status','reviewing'],['합격','status','accepted'],['대기','status','waitlisted'],['미입금','payment_status','unpaid']] as const;
 const counts=await Promise.all(filters.map(async([label,field,value])=>{
  let request=client.from('event_application_admin_list').select('id',{count:'exact',head:true}).eq('is_archived',false).eq('event_id',eventId);
  if(field)request=request.eq(field,value);
  const result=await request;
  return {label,count:result.error?null:result.count,field,value};
 }));
 const base=`/admin/events/${encodeURIComponent(slug)}/applicants`;
 return <section className="ops-panel"><h2>이 행사 신청자·운영</h2><p>이벤트를 바꾸지 않고 선발·입금 상태를 관리합니다. 날짜별 출석 체크는 상단 ‘참여·출석’에서 진행하세요.</p><nav className="applicant-summary-grid" aria-label="이벤트 신청자 빠른 필터">{counts.map(item=><Link key={item.label} href={item.field?`${base}?${item.field==='payment_status'?'payment':'status'}=${item.value}`:base}><span>{item.label}</span><strong>{item.count===null?'조회 실패':`${item.count}건`}</strong></Link>)}</nav><div className="ops-shortcuts"><Link href={`/admin/recruitment?event=${eventId}`}>전체 신청자관리에서 비교</Link></div></section>;
}
