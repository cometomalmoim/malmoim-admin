import { AdminShell } from './admin-shell';
import { ScheduleCalendar } from './schedule-calendar';
import { getSchedules } from '@/lib/schedules';
import { addDays, koreaToday } from '@/lib/schedule-calendar';
import type { ScheduleData } from '@/lib/schedule-types';
export async function ScheduleView({email='',preview=false}:{email?:string;preview?:boolean}) {
 const today=koreaToday();
 const demo:ScheduleData={schedules:[0,1,2,3,4].map((n)=>({id:`demo-${n}`,title:['운영진 회의','가을 행사 준비','정기 모임','장소 확인','홍보 일정'][n],start_date:today,end_date:addDays(today,n===1?3:0),tag_id:`demo-${n%3}`,assignee_id:null,notes:'개발 미리보기 예시',source_kind:'manual',event_id:null,version:1,hidden_at:null})),tags:['회의','행사','정기 모임'].map((name,i)=>({id:`demo-${i}`,name,color:['#22C55E','#EAB308','#38BDF8'][i],system_key:null,version:1})),people:[],events:[]};
 const data=preview?demo:await getSchedules();
 return <AdminShell current="schedule" title="스케줄" email={email} preview={preview}><h1>스케줄</h1><p>월별 운영 일정과 담당 업무를 관리합니다.</p>{data?<ScheduleCalendar initial={data} preview={preview}/>:<section className="ops-panel" role="alert"><h2>일정을 불러오지 못했습니다</h2><p>스케줄 DB 설정과 관리자 권한을 확인한 뒤 새로고침해주세요.</p></section>}</AdminShell>;
}
