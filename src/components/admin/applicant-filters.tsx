'use client';
import {useState} from 'react';
import Link from 'next/link';
import {applicantLanguageLevels} from '@/lib/applicant-languages';
import {trafficSources} from '@/lib/attribution';
import {applicationStatuses,paymentStatuses,type ApplicantQuery} from '@/lib/applicant-validation';

export function ApplicantFilters({slug,query,events,cohort,hasFilters,resetHref}:{slug?:string;query:ApplicantQuery;events:{id:string;title:string}[];cohort:boolean;hasFilters:boolean;resetHref:string}){
 const queryKey=JSON.stringify(query);
 const [snapshot,setSnapshot]=useState({key:queryKey,values:query});
 // Keep the form's DOM identity stable during RSC navigation. Reset only its controlled values.
 if(snapshot.key!==queryKey)setSnapshot({key:queryKey,values:query});
 const draft=snapshot.key===queryKey?snapshot.values:query;
 const change=(name:keyof ApplicantQuery,value:string)=>setSnapshot(previous=>({...previous,values:{...previous.values,[name]:value}}));
 return (
 <form method="get" className="applicant-filters" aria-label="신청자 검색·필터">
 {cohort&&query.preferred_class&&<input type="hidden" name="preferred_class" value={query.preferred_class}/>}{query.archived==='1'&&<input type="hidden" name="archived" value="1"/>}{query.nationality_group&&<input type="hidden" name="nationality_group" value={query.nationality_group}/>}
 {!slug&&<label className="applicant-filter-wide">이벤트<select name="event" value={draft.event??''} onChange={event=>change('event',event.target.value)}><option value="">전체 이벤트</option>{events.map(e=><option key={e.id} value={e.id}>{e.title}</option>)}</select></label>}
 <label className="applicant-filter-wide">이름·연락처 검색<input name="q" value={draft.q??''} onChange={event=>change('q',event.target.value)} maxLength={100}/></label>
 <label>선발 상태<select name="status" value={draft.status??''} onChange={event=>change('status',event.target.value)}><option value="">전체</option>{Object.entries(applicationStatuses).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
 <label>입금 여부<select name="payment" value={draft.payment??''} onChange={event=>change('payment',event.target.value)}><option value="">전체</option>{Object.entries(paymentStatuses).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
 <details className="applicant-advanced" open={['utm_source','utm_medium','year','nationality','korean','english'].some(key=>!!query[key as keyof ApplicantQuery])}><summary>상세 필터 · 언어·유입경로 등</summary><div className="applicant-advanced-fields"> <label>유입경로 (SOURCE)<select name="utm_source" value={draft.utm_source??''} onChange={event=>change('utm_source',event.target.value)}><option value="">전체</option>{Object.entries(trafficSources).map(([value,label])=><option key={value} value={value}>{label}</option>)}<option value="__unknown">미확인</option></select></label>
 <label>매체 (MEDIUM)<input name="utm_medium" maxLength={150} value={draft.utm_medium??''} onChange={event=>change('utm_medium',event.target.value)} placeholder="social, paid_social 등"/></label>
 <label>출생연도<input name="year" type="number" min={1900} max={new Date().getUTCFullYear()} value={draft.year??''} onChange={event=>change('year',event.target.value)}/></label>
 <label>국적 원문 검색<input name="nationality" value={draft.nationality??''} onChange={event=>change('nationality',event.target.value)} maxLength={100}/></label>
 {(['korean','english'] as const).map(language=><label key={language}>{language==='korean'?'한국어 수준':'영어 수준'}<select name={language} value={draft[language]??''} onChange={event=>change(language,event.target.value)}><option value="">전체</option>{Object.entries(applicantLanguageLevels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>)}</div></details><div className="applicant-filter-actions"><button type="submit" className="evt-primary">조회</button>{hasFilters&&<Link href={resetHref}>검색 초기화</Link>}</div></form>
 );
}
