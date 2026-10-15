import Link from 'next/link';
import { getEventApplicationCount, type EventRow } from '@/lib/events';
import { HalloweenBanner } from './halloween-banner';
import './event-overview.css';

const statuses:Record<string,string>={draft:'초안',published:'게시',closed:'모집 마감'};


export async function EventOverview({row}:{row:EventRow}) {
  const count=await getEventApplicationCount(row.id);
  const base=`/admin/events/${encodeURIComponent(row.slug)}`;
  const functions=[
    {title:'신청자 관리',description:'이 이벤트의 접수 내역을 확인합니다.',href:`${base}/applicants`,label:'신청자 목록 →'},
    {title:'이벤트 자료',description:'운영 자료와 PDF 첨부파일을 관리합니다.',href:`${base}/resources`,label:'자료실 →'},
    {title:'참여자·출석',description:'참가 확정과 회차별 출석을 연결할 영역입니다.'},
    {title:'문자 안내',description:'문자 대상·템플릿·발송 내역을 연결할 영역입니다.'},
    {title:'수료증',description:'발급 대상과 수료증 기능을 연결할 영역입니다.'},
    {title:'회차 관리',description:'여러 회차의 일정과 장소를 연결할 영역입니다.'},
  ];
  return <div className="evt-overview">
    <section className={`ops-panel evt-detail evt-overview-intro ${row.visual_theme==='halloween'?'evt-halloween-detail':''}`} aria-label="이벤트 소개">
      {row.visual_theme==='halloween'&&<HalloweenBanner/>}
      <div className="evt-overview-intro-heading"><div><span className="evt-overview-eyebrow">EVENT OVERVIEW</span><h2>이벤트 한눈에 보기</h2></div><Link className="ops-link" href={`${base}/information`}>이벤트 정보 →</Link></div>
      <p>{row.description||'이벤트 소개를 아직 입력하지 않았습니다.'}</p>
    </section>
    <section className="evt-overview-stats" aria-label="이벤트 현황">
      <article className="ops-panel"><h2>등록 상태</h2><strong>{statuses[row.status]??'확인 필요'}</strong><p>이벤트에 저장된 상태</p></article>
      <article className="ops-panel"><h2>접수 설정</h2><strong>{row.applications_open?'허용 설정':'비활성'}</strong><p>모집 기간·신청 폼 연결과 별도입니다</p></article>
      <article className="ops-panel"><h2>접수된 신청</h2><strong>{count===null?'조회 실패':`${count}건`}</strong><p>{count===null?'조회 권한과 연결 상태를 확인해주세요.':'선발·참가 확정 인원과 구분합니다'}</p><Link href={`${base}/applicants`}>신청자 확인 →</Link></article>
    </section>
    <section className="ops-panel"><h2>이벤트 운영</h2><p className="ops-muted">이벤트별 관리 화면으로 이동합니다. 준비 중인 항목은 기능이 연결된 뒤 사용할 수 있습니다.</p><div className="evt-overview-tools">{functions.map(item=><article key={item.title}><div className="evt-overview-section-heading"><h3>{item.title}</h3><span className={item.href?'evt-tool-ready':'evt-tool-pending'}>{item.href?'이용 가능':'준비 중'}</span></div><p>{item.description}</p>{item.href?<Link href={item.href}>{item.label}</Link>:<span className="ops-muted">담당 기능 연결 예정</span>}</article>)}</div></section>
  </div>;
}
