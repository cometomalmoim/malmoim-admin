import {applicantPages} from '@/lib/applicant-pagination';
import {trafficSources} from '@/lib/attribution';
import {ApplicantTable} from './applicant-table';
import Link from 'next/link';
import type {ApplicationRow} from '@/lib/recruitment';
import {applicationStatuses,paymentStatuses,type ApplicantQuery} from '@/lib/applicant-validation';
import {ApplicantEditor} from './applicant-editor';
import {ApplicantAdd} from './applicant-add';
import './applicants.css';
export function ApplicantList({slug,title,rows,count,page,query={},events=[]}:{slug?:string;events?:{id:string;title:string;slug:string}[];title:string;rows:ApplicationRow[];count:number;page:number;query?:ApplicantQuery}){
 const base=slug?`/admin/events/${encodeURIComponent(slug)}/applicants`:'/admin/recruitment';
 const pageSize=slug?25:20,totalPages=Math.max(1,Math.ceil(count/pageSize));
 const pageLink=(next:number)=>{const params=new URLSearchParams();for(const [k,v]of Object.entries(query))if(['q','status','payment','nationality','year','event','utm_source','utm_medium','archived'].includes(k)&&v)params.set(k,v);params.set('page',String(next));return `${base}?${params}`;};
 return <section className="ops-panel"><div className="applicant-heading"><div><h2>{title} · 조회 {count}건</h2><p className="ops-muted">{slug?'이벤트별 상세 응답과 참여 이력을 확인합니다.':'전체 이벤트의 신청·유입경로를 비교합니다. 선발·입금 상태만 목록에서 수정하고, 나머지는 상세·수정에서 변경합니다.'} 입금 기록은 운영진이 수동 확인합니다.</p></div></div>
 {!slug&&query.archived!=='1'&&<ApplicantAdd events={events} initialEvent={query.event}/>}
 {slug&&<details className="applicant-add"><summary>+ 신청자 직접 추가</summary><ApplicantEditor slug={slug}/></details>}
 <form key={JSON.stringify(query)} method="get" className="applicant-filters" aria-label="신청자 검색·필터">
 {query.archived==='1'&&<input type="hidden" name="archived" value="1"/>}
 {!slug&&<label>이벤트<select name="event" defaultValue={query.event??''}><option value="">전체 이벤트</option>{events.map(e=><option key={e.id} value={e.id}>{e.title}</option>)}</select></label>}
 <label>유입경로 (SOURCE)<select name="utm_source" defaultValue={query.utm_source??''}><option value="">전체</option>{Object.entries(trafficSources).map(([value,label])=><option key={value} value={value}>{label}</option>)}<option value="__unknown">미확인</option></select></label>
 <label>매체 (MEDIUM)<input name="utm_medium" maxLength={150} defaultValue={query.utm_medium} placeholder="social, paid_social 등"/></label>
 <label>이름·연락처 검색<input name="q" defaultValue={query.q} maxLength={100}/></label>
 <label>선발 상태<select name="status" defaultValue={query.status??''}><option value="">전체</option>{Object.entries(applicationStatuses).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
 <label>입금 여부<select name="payment" defaultValue={query.payment??''}><option value="">전체</option>{Object.entries(paymentStatuses).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
 <label>출생연도<input name="year" type="number" min={1900} max={new Date().getUTCFullYear()} defaultValue={query.year}/></label>
 <label>국적<input name="nationality" defaultValue={query.nationality} maxLength={100}/></label>
 <button type="submit" className="evt-primary">조회</button><Link href={base}>초기화</Link></form>
 {!slug&&<nav className="applicant-list-tabs" aria-label="신청자 보관 상태"><Link href="/admin/recruitment" aria-current={query.archived!=='1'?'page':undefined}>신청자 목록</Link><Link href="/admin/recruitment?archived=1" aria-current={query.archived==='1'?'page':undefined}>삭제된 신청자</Link></nav>}
 {!rows.length?<div className="ops-empty">조건에 맞는 신청자가 없습니다.</div>:<ApplicantTable key={JSON.stringify(rows.map(r=>[r.source,r.id,r.revision,r.archive_revision]))} rows={rows} eventMode={!!slug} archived={!slug&&query.archived==='1'}/>}

 <nav className="ops-shortcuts applicant-pagination" aria-label="신청자 목록 페이지"><span>총 {count}명 · 페이지당 {pageSize}명</span>{page>1&&<Link href={pageLink(page-1)}>← 이전</Link>}{applicantPages(page,totalPages).map((n,i)=>n===null?<span key={`gap-${i}`}>…</span>:<Link key={n} href={pageLink(n)} aria-label={`${n}페이지`} aria-current={n===page?'page':undefined}>{n}</Link>)}{page*pageSize<count&&<Link href={pageLink(page+1)}>다음 →</Link>}</nav>
 </section>;
}
