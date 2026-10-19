'use client';
import {languageLevelLabel} from '@/lib/applicant-languages';
import {useRef,useState,useTransition} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import type {ApplicationRow} from '@/lib/recruitment';
import {applicantEditData} from '@/lib/applicant-inline';
import {saveApplicant} from '@/app/actions/applicants';
import {applicationStatuses,paymentStatuses} from '@/lib/applicant-validation';
import {trafficSources} from '@/lib/attribution';
import {ApplicantResponse} from './applicant-response';
import {ApplicantEditor} from './applicant-editor';

export function ApplicantInlineRow({row,eventMode=false,selection,busy=false,readOnly=false}:{row:ApplicationRow;eventMode?:boolean;selection?:React.ReactNode;busy?:boolean;readOnly?:boolean}){
 const [message,setMessage]=useState('');
 const [pending,startTransition]=useTransition();
 const detail=useRef<HTMLDialogElement>(null);
 const router=useRouter();
 function statusControl(field:'status'|'payment_status',label:string,options:Record<string,string>){
  return <label className="applicant-status-control"><span className="sr-only">{row.name} {label}</span><select aria-label={`${row.name} ${label}`} value={row[field]} disabled={pending||busy||readOnly||!row.event_slug} onChange={e=>{
   const data=applicantEditData(row,field,e.target.value);
   startTransition(async()=>{try{
    const result=await saveApplicant(row.event_slug!,{code:''},data);
    setMessage(({saved:'저장했습니다.',conflict:'다른 운영진이 수정했습니다. 최신 목록을 불러와 다시 선택해주세요.',duplicate:'같은 연락처의 신청자가 있습니다.',invalid:'입력값을 확인해주세요.',forbidden:'관리자 권한을 확인해주세요.'} as Record<string,string>)[result.code]??'저장하지 못했습니다. 다시 시도해주세요.');
    if(result.code==='saved')router.refresh();
   }catch{setMessage('저장하지 못했습니다. 다시 시도해주세요.');}});
  }}>{Object.entries(options).map(([value,text])=><option key={value} value={value}>{text}</option>)}</select></label>;
 }
 return <tr>{selection&&<td>{selection}</td>}
 {!eventMode&&<td><Link href={`/admin/events/${encodeURIComponent(row.event_slug??'')}/applicants`}>{row.event_title??'이벤트 신청자·운영'}</Link></td>}
 <td>{row.name}<small>{row.source==='manual'?'수동':'온라인'}</small><Link href={`/admin/events/${encodeURIComponent(row.event_slug??'')}/participants/${row.source}/${row.id}`}>참여·출석 기록 →</Link></td>
 <td><span className="applicant-badge">{trafficSources[row.utm_source as keyof typeof trafficSources]??(row.utm_source||'미확인')}</span></td>
 {!eventMode&&<td>{row.utm_medium||'—'}<small>{row.utm_campaign||'—'}</small></td>}
 <td>{row.contact}<small>{row.contact_type==='phone'?'전화':'인스타그램'}</small></td>
 <td>{row.birth_year?`${row.birth_year}년생`:'—'}</td><td>{row.nationality||'—'}</td><td className="applicant-language-cell">{languageLevelLabel('korean',row.korean_level)}</td><td className="applicant-language-cell">{languageLevelLabel('english',row.english_level)}</td>
 <td>{statusControl('status','선발 상태',applicationStatuses)}</td>
 <td>{statusControl('payment_status','입금 확인',paymentStatuses)}<small>운영진 수동 기록</small></td>
 <td>{new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',dateStyle:'short'}).format(new Date(row.created_at))}</td>
 <td><ApplicantResponse eventId={row.event_id} source={row.source} id={row.id} name={row.name}/><button type="button" className="applicant-cell-button" disabled={pending||busy||readOnly||!row.event_slug} onClick={()=>detail.current?.showModal()}>상세·수정</button><small>{row.internal_note}</small><p role="status">{pending?'저장 중…':message}</p>{message.includes('최신 목록')&&<button type="button" onClick={()=>router.refresh()}>최신 목록 불러오기</button>}
 <dialog ref={detail} className="applicant-detail-dialog" aria-label={`${row.name} 상세·수정`}><button type="button" onClick={()=>detail.current?.close()}>닫기</button>{row.event_slug&&<><p>유입경로: {row.utm_source||'미확인'} · 매체: {row.utm_medium||'—'} · 캠페인: {row.utm_campaign||'—'}</p><ApplicantEditor slug={row.event_slug} row={row}/></>}</dialog></td>
 </tr>;
}
