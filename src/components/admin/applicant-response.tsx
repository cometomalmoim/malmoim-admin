'use client';
import {useRef,useState,useTransition} from 'react';
import {getApplicantResponse,type FormResponse} from '@/app/actions/applicant-response';
export function ApplicantResponse({eventId,source,id,name}:{eventId:string;source:string;id:string;name:string}){
 const dialog=useRef<HTMLDialogElement>(null);const [data,setData]=useState<FormResponse|null>(null);const [pending,start]=useTransition();
 return <><button type="button" className="applicant-cell-button" onClick={()=>{dialog.current?.showModal();setData(null);start(async()=>{try{setData(await getApplicantResponse(eventId,source,id));}catch{setData({code:'error'});}});}}>신청서 보기</button>
 <dialog ref={dialog} className="applicant-detail-dialog" aria-label={`${name} 신청서 답변`}><button type="button" onClick={()=>dialog.current?.close()}>닫기</button><h2>{name} 신청서 답변</h2><p>제출한 원본 응답입니다. 기본 정보 수정 내용과 다를 수 있습니다.</p>{pending?<p role="status">답변을 불러오는 중…</p>:data?.code==='ready'?<dl className="applicant-form-response">{data.fields.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>:<p role="alert">{data?.code==='missing'?'신청서를 찾을 수 없습니다.':'답변을 불러오지 못했습니다. 닫은 뒤 다시 시도해주세요.'}</p>}</dialog></>;
}
