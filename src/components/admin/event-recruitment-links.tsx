export function EventRecruitmentLinks({slug,compact=false}:{slug:string;compact?:boolean}){
 const pages=slug==='halloween-2026'
  ? [{label:'모집페이지 열기',href:'https://malmoim.com/2026halloweenparty'},{label:'English ↗',href:'https://malmoim.com/2026halloweenparty/en'}]
  :slug==='season9'
   ? [{label:'모집페이지 열기',href:'https://malmoim.com/season9'},{label:'English ↗',href:'https://malmoim.com/season9/en'}]:[];
 return <section className={`ops-panel evt-recruitment-access ${compact?'evt-recruitment-compact':''}`} aria-label="이 이벤트의 모집페이지"><div>{!compact&&<span className="evt-overview-eyebrow">참가자에게 안내할 페이지</span>}<h2>모집페이지</h2><p>{pages.length?(compact?'참가자에게 공유할 안내 페이지 · 신청 접수 설정과 별도':'이 이벤트의 모집 안내 화면을 새 탭에서 확인하세요.'):'이 이벤트에 연결된 모집페이지가 없습니다.'}</p></div>{pages.length>0&&<nav aria-label="모집페이지 바로가기">{pages.map((page,index)=><a key={page.href} className={index===0?'evt-recruitment-primary':'ops-link'} href={page.href} target="_blank" rel="noopener noreferrer">{page.label}{index===0?' ↗':''}</a>)}</nav>}{!compact&&<small>페이지 공개 여부와 실제 신청 접수 설정은 별개입니다.</small>}</section>;
}
