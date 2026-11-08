'use client';
import {wideApplicantResponse} from '@/lib/applicant-response-layout';
import {useEffect,useState} from 'react';
import {getApplicantResponse,type FormResponse} from '@/app/actions/applicant-response';
import Link from 'next/link';
import type {ApplicationRow} from '@/lib/recruitment';
import {trafficSources} from '@/lib/attribution';
export function ApplicantResponse({eventId,source,id,name,colSpan,regionId,context}:{eventId:string;source:string;id:string;name:string;colSpan:number;regionId:string;context?:ApplicationRow}){
 const [data,setData]=useState<FormResponse|null>(null);
 useEffect(()=>{let active=true;void getApplicantResponse(eventId,source,id).then(result=>{if(active)setData(result);}).catch(()=>{if(active)setData({code:'error'});});return()=>{active=false;};},[eventId,source,id]);
 return <tr className="applicant-response-row"><td colSpan={colSpan}><section id={regionId} aria-label={`${name} 신청서 답변`} className="applicant-response-panel"><h3>{name} 신청서 답변</h3>{context&&<><dl className="applicant-operation-meta">{[['유입경로',trafficSources[context.utm_source as keyof typeof trafficSources]??context.utm_source??'미확인'],['매체',context.utm_medium||'—'],['캠페인',context.utm_campaign||'—'],['접수일',new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',dateStyle:'short',timeStyle:'short'}).format(new Date(context.created_at))]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>{context.internal_note&&<p>운영 메모: {context.internal_note}</p>}<Link href={`/admin/events/${encodeURIComponent(context.event_slug??'')}/participants/${context.source}/${context.id}`}>참여·출석 기록 보기 →</Link></>}<p>제출한 원본 응답입니다. 기본 정보 수정 내용과 다를 수 있습니다.</p>{!data?<p role="status">답변을 불러오는 중…</p>:data.code==='ready'?<dl className="applicant-form-response">{[...data.fields.filter(([label,value])=>!wideApplicantResponse(label,value)),...data.fields.filter(([label,value])=>wideApplicantResponse(label,value))].map(([label,value])=><div className={wideApplicantResponse(label,value)?'applicant-answer-wide':undefined} key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>:<p role="alert">{data.code==='missing'?'신청서를 찾을 수 없습니다.':'답변을 불러오지 못했습니다. 접었다 다시 펼쳐주세요.'}</p>}</section></td></tr>;
}
