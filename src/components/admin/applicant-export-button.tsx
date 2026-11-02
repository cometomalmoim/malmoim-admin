'use client';
import {useState} from 'react';
import type {ApplicantQuery} from '@/lib/applicant-validation';
export function ApplicantExportButton({query,count}:{query:ApplicantQuery;count:number}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function download(){
  setBusy(true);setError('');
  try{
   const params=new URLSearchParams();for(const [key,value] of Object.entries(query))if(value)params.set(key,value);
   const response=await fetch(`/api/admin/applicants/export?${params}`,{cache:'no-store'});
   if(!response.ok){const result=await response.json();throw new Error(result.error??'다운로드하지 못했습니다.');}
   const blob=await response.blob(),url=URL.createObjectURL(blob),link=document.createElement('a');
   link.href=url;link.download=response.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1]??'malmoim-applicants.xlsx';
   document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(error){setError(error instanceof Error?error.message:'다운로드하지 못했습니다. 다시 시도해주세요.');}
  finally{setBusy(false);}
 }
 return <div className="applicant-export"><button className="ops-link" type="button" disabled={busy||count===0} onClick={()=>void download()}>{busy?'엑셀 준비 중…':`엑셀 다운로드 · ${count}명`}</button><small>조회한 조건의 전체 명단 · 엑셀 필터 포함</small>{error&&<p role="alert">{error}</p>}</div>;
}
