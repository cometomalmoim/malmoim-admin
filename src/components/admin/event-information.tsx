import Link from 'next/link';
import type { EventRow } from '@/lib/events';
import './event-overview.css';
const format=(value:string|null)=>value?new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',dateStyle:'medium',timeStyle:'short'}).format(new Date(value)):'미정';

export function EventInformation({row}:{row:EventRow}) {
  const base=`/admin/events/${encodeURIComponent(row.slug)}`;
  const landings=row.slug==='halloween-2026'
    ? [{label:'한국어 모집 페이지',url:'https://malmoim.com/2026halloweenparty'},{label:'English',url:'https://malmoim.com/2026halloweenparty/en'}]
    : row.slug==='season9'
      ? [{label:'한국어 모집 페이지',url:'https://malmoim.com/season9'},{label:'English',url:'https://malmoim.com/season9/en'}] : [];
  return <div className="evt-overview"><section className="ops-panel"><div className="evt-overview-section-heading"><h2>이벤트 정보</h2><Link className="ops-link" href={`${base}/edit`}>수정</Link></div><h3>{row.title}</h3><p>{row.description||'소개 미입력'}</p></section>
    <div className="evt-overview-grid">
      <section className="ops-panel"><div className="evt-overview-section-heading"><h2>기본 정보</h2></div>
        <dl className="evt-overview-facts"><div><dt>행사 시작</dt><dd>{format(row.starts_at)}</dd></div><div><dt>행사 종료</dt><dd>{format(row.ends_at)}</dd></div><div><dt>장소</dt><dd>{row.location||'미정'}</dd></div><div><dt>정원</dt><dd>{row.capacity===null?'미정':`${row.capacity}명`}</dd></div><div><dt>대표 이미지</dt><dd>{row.image_url?<a href={row.image_url} target="_blank" rel="noopener noreferrer">등록 이미지 보기 ↗</a>:'미등록'}</dd></div></dl><p className="ops-muted">모든 일시는 한국시간(KST) 기준입니다.</p>
      </section>
      <section className="ops-panel"><div className="evt-overview-section-heading"><h2>모집 기간</h2></div><dl className="evt-overview-facts"><div><dt>모집 시작</dt><dd>{format(row.opens_at)}</dd></div><div><dt>모집 마감</dt><dd>{format(row.closes_at)}</dd></div></dl>
        {!row.opens_at||!row.closes_at?<p className="evt-overview-note">모집 기간이 미정입니다. 정보 수정에서 시작일과 마감일을 설정해주세요.</p>:<p className="evt-overview-note">기간을 설정해도 접수가 자동으로 활성화되지는 않습니다.</p>}
        <p className="ops-muted">실제 접수 전에는 모집 기간과 신청 폼 연결 상태를 함께 확인해주세요.</p>
      </section>
      <section className="ops-panel"><div className="evt-overview-section-heading"><h2>참가비 안내</h2></div><p className="evt-overview-fee">{row.fee_notice||'참가비 안내 미입력'}</p><p className="ops-muted">이벤트에 저장된 안내를 표시합니다. 결제·개인별 납부 관리는 별도 기능입니다.</p></section>
      <section className="ops-panel"><h2>모집 페이지</h2><p className="ops-muted">현재 연결된 안내 페이지입니다. 페이지 공개와 실제 접수 가능 여부는 별개입니다.</p>
        {landings.length?<div className="evt-landing-links">{landings.map(item=><a className="ops-link" key={item.url} href={item.url} target="_blank" rel="noopener noreferrer">{item.label} ↗</a>)}</div>:<p className="evt-overview-note">연결된 모집 페이지가 없습니다.</p>}
        <p className="ops-muted">모집 페이지 제작·게시 기능은 담당 기능에서 연결합니다.</p>
      </section>
    </div>
  </div>;
}
