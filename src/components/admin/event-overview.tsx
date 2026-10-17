import {EventRecruitmentLinks} from './event-recruitment-links';
import Link from 'next/link';
import { getEventApplicationCount, type EventRow } from '@/lib/events';
import { HalloweenBanner } from './halloween-banner';
import './event-overview.css';

const statuses:Record<string,string>={draft:'초안',published:'게시',closed:'모집 마감'};


export async function EventOverview({row}:{row:EventRow}) {
  const count=await getEventApplicationCount(row.id);
  const base=`/admin/events/${encodeURIComponent(row.slug)}`;
  const functions=[
    {title:'이벤트 정보',description:'제목·일정·장소·정원과 모집 기간을 확인하고 수정합니다.',href:`${base}/information`,label:'정보 확인 →'},
    {title:'신청자·선발',description:'이 행사 신청자만 조회하고 선발·입금 상태를 관리합니다.',href:`${base}/applicants`,label:'신청자 관리 →'},
    {title:'참여·출석',description:'신청자별 참가 확정과 출석 기록을 확인하고 관리합니다.',href:`${base}/attendance`,label:'참여·출석 관리 →'},
  ];
  return <div className="evt-overview"><EventRecruitmentLinks slug={row.slug}/>
    <section className={`ops-panel evt-detail evt-overview-intro ${row.visual_theme==='halloween'?'evt-halloween-detail':''}`} aria-label="이벤트 소개">
      {row.visual_theme==='halloween'&&<HalloweenBanner/>}
      <div className="evt-overview-intro-heading"><div><span className="evt-overview-eyebrow">EVENT OVERVIEW</span><h2>이벤트 운영 홈</h2></div><Link className="ops-link" href={`${base}/information`}>이벤트 정보 →</Link></div>
      <p>{row.description||'이벤트 소개를 아직 입력하지 않았습니다.'}</p>
    </section>
    <section className="evt-overview-stats" aria-label="이벤트 현황">
      <article className="ops-panel"><h2>등록 상태</h2><strong>{statuses[row.status]??'확인 필요'}</strong><p>이벤트에 저장된 상태</p></article>
      <article className="ops-panel"><h2>접수 설정</h2><strong>{row.applications_open?'허용 설정':'비활성'}</strong><p>모집 기간·신청 폼 연결과 별도입니다</p></article>
      <article className="ops-panel"><h2>접수된 신청</h2><strong>{count===null?'조회 실패':`${count}건`}</strong><p>{count===null?'조회 권한과 연결 상태를 확인해주세요.':'선발·참가 확정 인원과 구분합니다'}</p><Link href={`/admin/events/${encodeURIComponent(row.slug)}/applicants`}>신청자 확인 →</Link></article>
    </section>
    <section className="ops-panel"><h2>운영 작업 선택</h2><p className="ops-muted">이 행사에 필요한 작업을 선택하세요. 여러 행사 비교와 사람별 전체 이력은 사이드바의 독립 메뉴에서 확인합니다.</p><div className="evt-overview-tools">{functions.map(item=><article key={item.title}><div className="evt-overview-section-heading"><h3>{item.title}</h3><span className={item.href?'evt-tool-ready':'evt-tool-pending'}>{item.href?'이용 가능':'준비 중'}</span></div><p>{item.description}</p>{item.href?<Link href={item.href}>{item.label}</Link>:<span className="ops-muted">담당 기능 연결 예정</span>}</article>)}</div></section>
  </div>;
}
