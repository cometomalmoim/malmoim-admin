import Link from 'next/link';import {getAdminAccess} from '@/lib/auth';import {createClient} from '@/lib/supabase/server';
async function summaryData(){
 if((await getAdminAccess()).status!=='admin')return null;
 try{const client=await createClient();const [people,visits]=await Promise.all([
 client.from('event_person_totals').select('id',{count:'exact',head:true}).gt('attendance_count',0),
 client.from('event_participation').select('application_id,recruitment_events!inner(is_test)',{count:'exact',head:true}).eq('attendance','attended').eq('recruitment_events.is_test',false)]);
 if(people.error||visits.error)throw new Error('lookup');
 return {people:people.count??0,visits:visits.count??0};
 }catch{return null;}
}
export async function ParticipationSummary(){
 const data=await summaryData();
 if(!data)return <section className="ops-panel" role="alert">참여 현황 조회 실패. 연결 상태를 확인해주세요.</section>;
 return <section className="ops-panel"><h2>기존 참여 현황</h2><p>실제 참석한 사람 <strong>{data.people}명</strong> · 누적 이벤트 참석 <strong>{data.visits}회</strong></p><p className="ops-muted">운영진이 기록한 참석만 집계하며 테스트는 제외합니다. 과거 이력을 입력하지 않았다면 0으로 표시됩니다.</p><Link href="/admin/participants">개인별 참여 이력 확인 →</Link></section>;
}
