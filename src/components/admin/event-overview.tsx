import {EventRecruitmentLinks} from './event-recruitment-links';
import Link from 'next/link';
import {getEventApplicationCount,type EventRow} from '@/lib/events';
import {HalloweenBanner} from './halloween-banner';
import './event-overview.css';
const statuses:Record<string,string>={draft:'초안',published:'게시',closed:'모집 마감'};
export async function EventOverview({row}:{row:EventRow}){
 const count=await getEventApplicationCount(row.id);
 const base=`/admin/events/${encodeURIComponent(row.slug)}`;
 const tasks=[
  {title:'이벤트 정보',description:'일정·장소·정원·모집 기간을 확인하고 수정합니다.',href:`${base}/information`,action:'정보 확인·수정'},
  {title:'신청자 관리',description:'신청 내역을 확인하고 선발·입금 상태를 관리합니다.',href:`${base}/applicants`,action:'신청자 보기'},
  {title:'문의 확인하기',description:'이 이벤트에 접수된 문의를 확인하고 답변합니다.',href:`${base}/inquiries`,action:'문의 확인·답변'},
  {title:'날짜별 출석',description:'진행 날짜를 선택하고 참석·미참석·노쇼를 기록합니다.',href:`${base}/attendance`,action:'출석 체크'},
 ];
 return <div className="evt-overview evt-home">
  <EventRecruitmentLinks slug={row.slug} compact/>
  <section className="ops-panel evt-home-tasks" aria-label="이벤트 운영 작업"><h2>운영 작업 선택</h2><p className="ops-muted">필요한 작업을 선택하세요. 카드 전체를 눌러 이동할 수 있습니다.</p>
   <div className="evt-home-workflows">{tasks.map(task=><Link key={task.title} className="evt-home-workflow" href={task.href}><strong>{task.title}</strong><p>{task.description}</p><span>{task.action} <span aria-hidden="true">→</span></span></Link>)}</div>
   <nav className="evt-home-more" aria-label="추가 이벤트 업무"><Link href={`${base}/reviews`}>후기 관리</Link><Link href={`${base}/resources`}>자료</Link><Link href={`${base}/certificates`}>수료증</Link></nav>
  </section>
  <section className="evt-overview-stats evt-home-summary" aria-label="이벤트 현황">
   <article className="ops-panel"><h2>등록 상태</h2><strong>{statuses[row.status]??'확인 필요'}</strong><p>이벤트에 저장된 상태</p></article>
   <article className="ops-panel"><h2>접수 설정</h2><strong>{row.applications_open?'허용 설정':'비활성'}</strong><p>모집페이지 공개와 별도입니다</p></article>
   <article className="ops-panel"><h2>접수된 신청</h2><strong>{count===null?'조회 실패':`${count}건`}</strong><p>{count===null?'조회 권한과 연결 상태를 확인해주세요.':'선발·참가 확정 인원과 구분합니다'}</p></article>
  </section>
  <section className={`ops-panel evt-detail evt-overview-intro ${row.visual_theme==='halloween'?'evt-halloween-detail':''}`} aria-label="이벤트 소개">
   {row.visual_theme==='halloween'&&<HalloweenBanner/>}
   <h2>이벤트 소개</h2><p>{row.description||'이벤트 소개를 아직 입력하지 않았습니다.'}</p>
  </section>
 </div>;
}
