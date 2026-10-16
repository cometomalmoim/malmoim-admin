import {ApplicantInlineRow} from './applicant-inline-row';
import {trafficSources} from '@/lib/attribution';
import Link from 'next/link';
import type {ApplicationRow} from '@/lib/recruitment';
import {applicationStatuses,paymentStatuses,type ApplicantQuery} from '@/lib/applicant-validation';
import {ApplicantEditor} from './applicant-editor';
import './applicants.css';
export function ApplicantList({slug,title,rows,count,page,query={},events=[]}:{slug?:string;events?:{id:string;title:string}[];title:string;rows:ApplicationRow[];count:number;page:number;query?:ApplicantQuery}){
 const base=slug?`/admin/events/${encodeURIComponent(slug)}/applicants`:'/admin/recruitment';
 const pageLink=(next:number)=>{const params=new URLSearchParams();for(const [k,v]of Object.entries(query))if(['q','status','payment','nationality','year','event','utm_source','utm_medium'].includes(k)&&v)params.set(k,v);params.set('page',String(next));return `${base}?${params}`;};
 return <section className="ops-panel"><div className="applicant-heading"><div><h2>{title} · 조회 {count}건</h2><p className="ops-muted">{slug?'이벤트별 상세 응답과 참여 이력을 확인합니다.':'여러 이벤트의 신청·유입경로를 비교합니다. ✎가 있는 값을 누르면 목록에서 수정할 수 있습니다.'} 입금 기록은 운영진이 수동 확인합니다.</p></div></div>
 {slug&&<details className="applicant-add"><summary>+ 신청자 직접 추가</summary><ApplicantEditor slug={slug}/></details>}
 <form key={JSON.stringify(query)} method="get" className="applicant-filters" aria-label="신청자 검색·필터">
 {!slug&&<label>이벤트<select name="event" defaultValue={query.event??''}><option value="">전체 이벤트</option>{events.map(e=><option key={e.id} value={e.id}>{e.title}</option>)}</select></label>}
 <label>유입경로 (SOURCE)<select name="utm_source" defaultValue={query.utm_source??''}><option value="">전체</option>{Object.entries(trafficSources).map(([value,label])=><option key={value} value={value}>{label}</option>)}<option value="__unknown">미확인</option></select></label>
 <label>매체 (MEDIUM)<input name="utm_medium" maxLength={150} defaultValue={query.utm_medium} placeholder="social, paid_social 등"/></label>
 <label>이름·연락처 검색<input name="q" defaultValue={query.q} maxLength={100}/></label>
 <label>선발 상태<select name="status" defaultValue={query.status??''}><option value="">전체</option>{Object.entries(applicationStatuses).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
 <label>입금 여부<select name="payment" defaultValue={query.payment??''}><option value="">전체</option>{Object.entries(paymentStatuses).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
 <label>출생연도<input name="year" type="number" min={1900} max={new Date().getUTCFullYear()} defaultValue={query.year}/></label>
 <label>국적<input name="nationality" defaultValue={query.nationality} maxLength={100}/></label>
 <button type="submit" className="evt-primary">조회</button><Link href={base}>초기화</Link></form>
 {!rows.length?<div className="ops-empty">조건에 맞는 신청자가 없습니다. 필터를 초기화하거나 신청자를 직접 추가해주세요.</div>:<div className="ops-table-scroll"><table className="ops-applications applicant-table"><caption>개인정보는 행사 운영 목적에 필요한 범위에서 확인해주세요. 출생연도·국적은 미확인 시 —로 표시합니다.</caption><thead><tr>{['이벤트','이름','유입경로','매체·캠페인','연락처','출생연도','국적','선발 상태','입금 확인','접수일',slug?'상세·수정':'내부 메모·저장 결과'].map(label=><th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{rows.map(row=>!slug?<ApplicantInlineRow key={`${row.source}-${row.id}-${row.revision}`} row={row}/>:<tr key={`${row.source}-${row.id}`}><td>{row.event_title??title}</td><td>{row.name}<small>{row.source==='manual'?'운영진 추가':'온라인 신청'}</small><Link href={`/admin/events/${encodeURIComponent(row.event_slug??slug??'')}/participants/${row.source}/${row.id}`}>참여 이력 →</Link></td><td><span className="applicant-badge">{trafficSources[row.utm_source as keyof typeof trafficSources]??(row.utm_source||'미확인')}</span></td><td>{row.utm_medium||'—'}<small>{row.utm_campaign||'—'}</small></td><td>{row.contact}<small>{row.contact_type==='phone'?'전화':'인스타그램'}</small></td><td>{row.birth_year?`${row.birth_year}년생`:'—'}</td><td>{row.nationality||'—'}</td><td><span className="applicant-badge">{applicationStatuses[row.status as keyof typeof applicationStatuses]??'확인 필요'}</span></td><td><span className={`applicant-badge ${row.payment_status==='paid'?'applicant-paid':''}`}>{paymentStatuses[row.payment_status as keyof typeof paymentStatuses]??'미확인'}</span></td><td>{new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',dateStyle:'short'}).format(new Date(row.created_at))}</td><td><details><summary>상세·수정</summary>{(row.event_slug??slug)&&<ApplicantEditor slug={row.event_slug??slug!} row={row}/>}</details></td></tr>)}</tbody></table></div>}
 <nav className="ops-shortcuts" aria-label="신청자 목록 페이지">{page>1&&<Link href={pageLink(page-1)}>← 이전</Link>}<span>{page}페이지</span>{page*25<count&&<Link href={pageLink(page+1)}>다음 →</Link>}</nav>
 </section>;
}
