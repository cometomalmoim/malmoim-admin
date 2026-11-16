import Link from 'next/link';
import type {ApplicantQuery} from '@/lib/applicant-validation';
import type {ApplicantClassCount} from '@/lib/recruitment';

export function applicantClassHref(query:ApplicantQuery,day='',group='') {
  const params=new URLSearchParams();
  for(const [key,value] of Object.entries(query)) {
    if(value&&!['page','preferred_class','nationality_group'].includes(key))params.set(key,value);
  }
  if(day)params.set('preferred_class',day);
  if(group)params.set('nationality_group',group);
  return `/admin/recruitment${params.size?'?'+params:''}`;
}

export function ApplicantClassSummary({counts,query}:{counts:ApplicantClassCount[]|null;query:ApplicantQuery}) {
  return <section className="applicant-class-summary" aria-label="반별 신청 현황">
    <div className="applicant-class-summary-heading"><strong>반별 신청 현황</strong><small>검색·선발·납부 등 현재 조건 기준 · 반·국적 선택과 무관하게 전체 신청 건수 집계</small>
      {(query.preferred_class||query.nationality_group)&&<Link href={applicantClassHref(query)}>전체 반·국적 보기</Link>}
    </div>
    {counts===null?<p role="status">인원을 불러오지 못했습니다. 기존 반·국적 필터로 조회해주세요.</p>:<div className="applicant-class-summary-grid">
      {[['thursday','목요일반'],['saturday','토요일반']].map(([day,label])=><div key={day} className="applicant-class-summary-day">
        <Link className="applicant-class-summary-title" href={applicantClassHref(query,day)} aria-current={query.preferred_class===day&&!query.nationality_group?'page':undefined}>{label}</Link>
        {[['korean','한국인'],['foreign','외국인'],['unknown','국적 미확인']].map(([group,name])=>{
          const count=counts.find(row=>row.day===day&&row.group===group)?.count??0;
          return <Link key={group} href={applicantClassHref(query,day,group)} aria-label={`${label} ${name} ${count}명`} aria-current={query.preferred_class===day&&query.nationality_group===group?'page':undefined}>
            <span>{name}</span><strong>{count}<small>명</small></strong>
          </Link>;
        })}
      </div>)}
    </div>}
    {(query.preferred_class||query.nationality_group)&&<p className="applicant-class-summary-selected" role="status">현재 목록: {query.preferred_class==='thursday'?'목요일반':query.preferred_class==='saturday'?'토요일반':'전체 반'} · {query.nationality_group==='korean'?'한국인':query.nationality_group==='foreign'?'외국인':query.nationality_group==='unknown'?'국적 미확인':'전체 국적'}</p>}
  </section>;
}
