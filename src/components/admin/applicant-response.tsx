'use client';
import {useEffect,useState} from 'react';
import {getApplicantResponse,type FormResponse} from '@/app/actions/applicant-response';
export function ApplicantResponse({eventId,source,id,name,colSpan,regionId}:{eventId:string;source:string;id:string;name:string;colSpan:number;regionId:string}){
 const [data,setData]=useState<FormResponse|null>(null);
 useEffect(()=>{let active=true;void getApplicantResponse(eventId,source,id).then(result=>{if(active)setData(result);}).catch(()=>{if(active)setData({code:'error'});});return()=>{active=false;};},[eventId,source,id]);
 return <tr className="applicant-response-row"><td colSpan={colSpan}><section id={regionId} aria-label={`${name} 신청서 답변`} className="applicant-response-panel"><h3>{name} 신청서 답변</h3><p>제출한 원본 응답입니다. 기본 정보 수정 내용과 다를 수 있습니다.</p>{!data?<p role="status">답변을 불러오는 중…</p>:data.code==='ready'?<dl className="applicant-form-response">{data.fields.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>:<p role="alert">{data.code==='missing'?'신청서를 찾을 수 없습니다.':'답변을 불러오지 못했습니다. 접었다 다시 펼쳐주세요.'}</p>}</section></td></tr>;
}
