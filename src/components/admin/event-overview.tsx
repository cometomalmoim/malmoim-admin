import Link from 'next/link';
import { getEventApplicationCount, type EventRow } from '@/lib/events';
import { HalloweenBanner } from './halloween-banner';
import './event-overview.css';

const statuses:Record<string,string>={draft:'초안',published:'게시',closed:'모집 마감'};
const format=(value:string|null)=>value?new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',dateStyle:'medium',timeStyle:'short'}).format(new Date(value)):'미정';

export async function EventOverview({row}:{row:EventRow}) {
  const count=await getEventApplicationCount(row.id);
  const base=`/admin/events/${encodeURIComponent(row.slug)}`;
  const landings=row.slug==='halloween-2026'
    ? [{label:'한국어 모집 페이지',url:'https://malmoim.com/2026halloweenparty'},{label:'English',url:'https://malmoim.com/2026halloweenparty/en'}]
    : row.slug==='season9'
      ? [{label:'한국어 모집 페이지',url:'https://malmoim.com/season9'},{label:'English',url:'https://malmoim.com/season9/en'}] : [];
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
      <div className="evt-overview-intro-heading"><div><span className="evt-overview-eyebrow">EVENT OVERVIEW</span><h2>이벤트 한눈에 보기</h2></div><Link className="ops-link" href={`${base}/edit`}>정보 수정 →</Link></div>
      <p>{row.description||'이벤트 소개를 아직 입력하지 않았습니다.'}</p>
    </section>
    <section className="evt-overview-stats" aria-label="이벤트 현황">
      <article className="ops-panel"><h2>등록 상태</h2><strong>{statuses[row.status]??'확인 필요'}</strong><p>이벤트에 저장된 상태</p></article>
      <article className="ops-panel"><h2>접수 설정</h2><strong>{row.applications_open?'허용 설정':'비활성'}</strong><p>모집 기간·신청 폼 연결과 별도입니다</p></article>
      <article className="ops-panel"><h2>접수된 신청</h2><strong>{count===null?'조회 실패':`${count}건`}</strong><p>{count===null?'조회 권한과 연결 상태를 확인해주세요.':'선발·참가 확정 인원과 구분합니다'}</p><Link href={`${base}/applicants`}>신청자 확인 →</Link></article>
    </section>
    <div className="evt-overview-grid">
      <section className="ops-panel"><div className="evt-overview-section-heading"><h2>기본 정보</h2><Link href={`${base}/edit`}>수정</Link></div>
        <dl className="evt-overview-facts"><div><dt>행사 시작</dt><dd>{format(row.starts_at)}</dd></div><div><dt>행사 종료</dt><dd>{format(row.ends_at)}</dd></div><div><dt>장소</dt><dd>{row.location||'미정'}</dd></div><div><dt>정원</dt><dd>{row.capacity===null?'미정':`${row.capacity}명`}</dd></div><div><dt>대표 이미지</dt><dd>{row.image_url?<a href={row.image_url} target="_blank" rel="noopener noreferrer">등록 이미지 보기 ↗</a>:'미등록'}</dd></div></dl><p className="ops-muted">모든 일시는 한국시간(KST) 기준입니다.</p>
      </section>
      <section className="ops-panel"><div className="evt-overview-section-heading"><h2>모집 기간</h2><Link href={`${base}/edit`}>기간 수정</Link></div><dl className="evt-overview-facts"><div><dt>모집 시작</dt><dd>{format(row.opens_at)}</dd></div><div><dt>모집 마감</dt><dd>{format(row.closes_at)}</dd></div></dl>
        {!row.opens_at||!row.closes_at?<p className="evt-overview-note">모집 기간이 미정입니다. 정보 수정에서 시작일과 마감일을 설정해주세요.</p>:<p className="evt-overview-note">기간을 설정해도 접수가 자동으로 활성화되지는 않습니다.</p>}
        <p className="ops-muted">실제 접수 전에는 모집 기간과 신청 폼 연결 상태를 함께 확인해주세요.</p>
      </section>
      <section className="ops-panel"><div className="evt-overview-section-heading"><h2>참가비 안내</h2><Link href={`${base}/edit`}>안내 수정</Link></div><p className="evt-overview-fee">{row.fee_notice||'참가비 안내 미입력'}</p><p className="ops-muted">이벤트에 저장된 안내를 표시합니다. 결제·개인별 납부 관리는 별도 기능입니다.</p></section>
      <section className="ops-panel"><h2>모집 페이지</h2><p className="ops-muted">현재 연결된 안내 페이지입니다. 페이지 공개와 실제 접수 가능 여부는 별개입니다.</p>
        {landings.length?<div className="evt-landing-links">{landings.map(item=><a className="ops-link" key={item.url} href={item.url} target="_blank" rel="noopener noreferrer">{item.label} ↗</a>)}</div>:<p className="evt-overview-note">연결된 모집 페이지가 없습니다.</p>}
        <p className="ops-muted">모집 페이지 제작·게시 기능은 담당 기능에서 연결합니다.</p>
      </section>
    </div>
    <section className="ops-panel"><h2>이벤트 운영</h2><p className="ops-muted">이벤트별 관리 화면으로 이동합니다. 준비 중인 항목은 기능이 연결된 뒤 사용할 수 있습니다.</p><div className="evt-overview-tools">{functions.map(item=><article key={item.title}><div className="evt-overview-section-heading"><h3>{item.title}</h3><span className={item.href?'evt-tool-ready':'evt-tool-pending'}>{item.href?'이용 가능':'준비 중'}</span></div><p>{item.description}</p>{item.href?<Link href={item.href}>{item.label}</Link>:<span className="ops-muted">담당 기능 연결 예정</span>}</article>)}</div></section>
  </div>;
}
