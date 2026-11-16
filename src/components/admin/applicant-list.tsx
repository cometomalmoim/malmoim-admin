import {ApplicantClassSummary} from './applicant-class-summary';
import type {ApplicantClassCount} from '@/lib/recruitment';
import {applicantPages} from '@/lib/applicant-pagination';
import {ApplicantMore} from './applicant-more';
import {ApplicantTable} from './applicant-table';
import Link from 'next/link';
import type {ApplicationRow} from '@/lib/recruitment';
import type {ApplicantQuery} from '@/lib/applicant-validation';
import {ApplicantFilters} from './applicant-filters';
import {ApplicantExportButton} from './applicant-export-button';
import {ApplicantEditor} from './applicant-editor';
import {ApplicantAdd} from './applicant-add';
import './applicants.css';
export function ApplicantList({slug,title,rows,count,page,query={},events=[],classCounts}:{classCounts?:ApplicantClassCount[]|null;slug?:string;events?:{id:string;title:string;slug:string;is_archived?:boolean}[];title:string;rows:ApplicationRow[];count:number;page:number;query?:ApplicantQuery}){
 const base=slug?`/admin/events/${encodeURIComponent(slug)}/applicants`:'/admin/recruitment';
 const hasFilters=Object.entries(query).some(([key,value])=>['preferred_class','nationality_group','korean','english','q','status','payment','nationality','year','event','utm_source','utm_medium'].includes(key)&&!!value);
 const hasNarrowingFilters=Object.entries(query).some(([key,value])=>key!=='archived'&&!!value);
 const pageSize=slug?25:20,totalPages=Math.max(1,Math.ceil(count/pageSize));
 const pageLink=(next:number)=>{const params=new URLSearchParams();for(const [k,v]of Object.entries(query))if(['preferred_class','nationality_group','korean','english','q','status','payment','nationality','year','event','utm_source','utm_medium','archived'].includes(k)&&v)params.set(k,v);params.set('page',String(next));return `${base}?${params}`;};
 const tabLink=(group='',archived=false)=>{const params=new URLSearchParams();for(const [key,value] of Object.entries(query))if(!['page','nationality_group','archived'].includes(key)&&value)params.set(key,value);if(group)params.set('nationality_group',group);if(archived)params.set('archived','1');return `${base}${params.size?'?'+params:''}`;};
 const cohort=slug==='season9'||(!slug&&(!query.event||events.find(event=>event.id===query.event)?.slug==='season9'));
 const classLink=(value='')=>{const params=new URLSearchParams();for(const [key,v] of Object.entries(query))if(!['page','preferred_class'].includes(key)&&v)params.set(key,v);if(value)params.set('preferred_class',value);return `${base}${params.size?'?'+params:''}`;};
 const resetParams=new URLSearchParams();if(query.archived==='1')resetParams.set('archived','1');if(query.nationality_group)resetParams.set('nationality_group',query.nationality_group);if(query.preferred_class)resetParams.set('preferred_class',query.preferred_class);const resetHref=`${base}${resetParams.size?'?'+resetParams:''}`;
 return <section className="ops-panel"><div className="applicant-heading"><div><h2>{title} · 조회 {count}건</h2><p className="ops-muted">{slug?'이벤트별 상세 응답과 참여 이력을 확인합니다.':'전체 이벤트의 신청·유입경로를 비교합니다. 선발·입금 상태만 목록에서 수정하고, 나머지는 상세·수정에서 변경합니다.'} 입금 기록은 운영진이 수동 확인합니다.</p></div>{!slug&&<div className="applicant-heading-actions">{!slug&&query.archived!=='1'&&<ApplicantAdd events={events.filter(event=>!event.is_archived)} initialEvent={query.event}/>}<ApplicantExportButton query={query} count={count}/></div>}</div>
 {slug&&<details className="applicant-add"><summary>+ 신청자 직접 추가</summary><ApplicantEditor slug={slug}/></details>}
 <ApplicantFilters slug={slug} query={query} events={events} cohort={cohort} hasFilters={hasFilters} resetHref={resetHref}/>
 {!slug&&query.archived!=='1'&&classCounts!==undefined&&<ApplicantClassSummary counts={classCounts} query={query}/> }
 <div className="applicant-segments">{!slug&&<nav className="applicant-list-tabs" aria-label="신청자 목록 구분"><Link href={tabLink()} aria-current={query.archived!=='1'&&!query.nationality_group?'page':undefined}>신청자 목록</Link><Link href={tabLink('',true)} aria-current={query.archived==='1'?'page':undefined}>삭제된 신청자</Link>{(classCounts==null||query.archived==='1')&&[['korean','한국인'],['foreign','외국인'],['unknown','국적 미확인']].map(([value,label])=><Link key={value} href={tabLink(value)} aria-current={query.archived!=='1'&&query.nationality_group===value?'page':undefined}>{label}</Link>)}</nav>}
 {cohort&&(classCounts==null||query.archived==='1')&&<nav className="applicant-class-tabs" aria-label="기수 모집 반 구분">{[['','전체 반'],['thursday','목요일반'],['saturday','토요일반']].map(([value,label])=><Link key={value} href={classLink(value)} aria-current={(query.preferred_class??'')===value?'page':undefined}>{label}</Link>)}{!slug&&!query.event&&<small>반 선택 시 기수 모집 신청만 표시됩니다.</small>}</nav>}
 </div>
 {!rows.length?<div className="ops-empty" role="status"><h3>{hasNarrowingFilters?'검색 조건에 맞는 신청자가 없습니다.':query.archived==='1'?'삭제된 신청자가 없습니다.':'아직 접수된 신청자가 없습니다.'}</h3><p>{hasNarrowingFilters?'이벤트·반·언어·검색어 조건을 확인하거나 전체 목록으로 돌아가세요.':'새 신청이 접수되거나 운영진이 신청자를 추가하면 이곳에 표시됩니다.'}</p>{hasNarrowingFilters&&<Link className="ops-link" href={`${base}${query.archived==='1'?'?archived=1':''}`}>조회 조건 모두 초기화</Link>}</div>:!slug?<ApplicantMore key={JSON.stringify(query)} rows={rows} count={count} query={query} archived={query.archived==='1'}/>:<ApplicantTable key={JSON.stringify({slug,query})} rows={rows} eventMode={!!slug} archived={!slug&&query.archived==='1'}/>}

 {slug&&<nav className="ops-shortcuts applicant-pagination" aria-label="신청자 목록 페이지"><span>총 {count}명 · 페이지당 {pageSize}명</span>{page>1&&<Link href={pageLink(page-1)}>← 이전</Link>}{applicantPages(page,totalPages).map((n,i)=>n===null?<span key={`gap-${i}`}>…</span>:<Link key={n} href={pageLink(n)} aria-label={`${n}페이지`} aria-current={n===page?'page':undefined}>{n}</Link>)}{page*pageSize<count&&<Link href={pageLink(page+1)}>다음 →</Link>}</nav>}
 </section>;
}
