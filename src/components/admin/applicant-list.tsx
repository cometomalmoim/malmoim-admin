import Link from 'next/link';
import type {ApplicationRow} from '@/lib/recruitment';
import {applicationStatuses,paymentStatuses,paymentConfirmationTime,type ApplicantQuery} from '@/lib/applicant-validation';
import {ApplicantEditor} from './applicant-editor';
import {ApplicantPayment} from './applicant-payment';
import {ApplicantRefunds} from './applicant-refunds';
import {getApplicantRefunds} from '@/lib/refunds';
import './applicants.css';
export async function ApplicantList({slug,title,rows,count,page,query={}}:{slug:string;title:string;rows:ApplicationRow[];count:number;page:number;query?:ApplicantQuery}){
 const refunds=await getApplicantRefunds(slug,rows);
 const base=`/admin/events/${encodeURIComponent(slug)}/applicants`;
 const pageLink=(next:number)=>{const params=new URLSearchParams();for(const [k,v]of Object.entries(query))if(['q','status','payment','nationality','year'].includes(k)&&v)params.set(k,v);params.set('page',String(next));return `${base}?${params}`;};
 return <section className="ops-panel"><div className="applicant-heading"><div><h2>{title} · 조회 {count}건</h2><p className="ops-muted">검색·필터를 적용한 결과입니다. 입금 기록은 운영진이 수동 확인합니다.</p></div></div>
 <details className="applicant-add"><summary>+ 신청자 직접 추가</summary><ApplicantEditor slug={slug}/></details>
 <form key={JSON.stringify(query)} method="get" className="applicant-filters" aria-label="신청자 검색·필터">
 <label>이름·연락처 검색<input name="q" defaultValue={query.q} maxLength={100}/></label>
 <label>선발 상태<select name="status" defaultValue={query.status??''}><option value="">전체</option>{Object.entries(applicationStatuses).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
 <label>입금 여부<select name="payment" defaultValue={query.payment??''}><option value="">전체</option>{Object.entries(paymentStatuses).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
 <label>출생연도<input name="year" type="number" min={1900} max={new Date().getUTCFullYear()} defaultValue={query.year}/></label>
 <label>국적<input name="nationality" defaultValue={query.nationality} maxLength={100}/></label>
 <button type="submit" className="evt-primary">조회</button><Link href={base}>초기화</Link></form>
 {!rows.length?<div className="ops-empty">조건에 맞는 신청자가 없습니다. 필터를 초기화하거나 신청자를 직접 추가해주세요.</div>:<div className="ops-table-scroll"><table className="ops-applications applicant-table"><caption>개인정보는 행사 운영 목적에 필요한 범위에서 확인해주세요. 출생연도·국적은 미확인 시 —로 표시합니다.</caption><thead><tr>{['이름','연락처','출생연도','국적','선발 상태','입금 확인','실제 납부액','확인 담당자 ID','확인 일시 (KST)','접수일','상세·수정'].map(label=><th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{rows.map(row=><tr key={`${row.source}-${row.id}`}><td>{row.name}<small>{row.source==='manual'?'운영진 추가':'온라인 신청'}</small><Link href={`/admin/events/${encodeURIComponent(slug)}/participants/${row.source}/${row.id}`}>참여 이력 →</Link></td><td>{row.contact}<small>{row.contact_type==='phone'?'전화':'인스타그램'}</small></td><td>{row.birth_year?`${row.birth_year}년생`:'—'}</td><td>{row.nationality||'—'}</td><td><span className="applicant-badge">{applicationStatuses[row.status as keyof typeof applicationStatuses]??'확인 필요'}</span></td><td><span className={`applicant-badge ${row.payment_status==='paid'?'applicant-paid':''}`}>{paymentStatuses[row.payment_status as keyof typeof paymentStatuses]??'미확인'}</span></td><td>{row.paid_amount_krw==null?'미확인':`${row.paid_amount_krw.toLocaleString('ko-KR')}원`}</td><td>{row.payment_confirmed_by||'미기록'}</td><td>{paymentConfirmationTime(row.payment_confirmed_at)}</td><td>{new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',dateStyle:'short'}).format(new Date(row.created_at))}</td><td><details><summary>상세·수정</summary><ApplicantEditor slug={slug} row={row}/><ApplicantPayment slug={slug} row={row} locked={refunds.kind==='error'||refunds.rows.some(refund=>refund.application_id===row.id&&refund.source===row.source&&refund.status!=='rejected')}/><ApplicantRefunds actualPaidAmount={row.paid_amount_krw} slug={slug} applicationId={row.id} source={row.source} paymentStatus={row.payment_status} rows={refunds.kind==='ready'?refunds.rows.filter(refund=>refund.application_id===row.id&&refund.source===row.source):[]} error={refunds.kind==='error'}/></details></td></tr>)}</tbody></table></div>}
 <nav className="ops-shortcuts" aria-label="신청자 목록 페이지">{page>1&&<Link href={pageLink(page-1)}>← 이전</Link>}<span>{page}페이지</span>{page*25<count&&<Link href={pageLink(page+1)}>다음 →</Link>}</nav>
 </section>;
}
