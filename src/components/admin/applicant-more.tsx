'use client';
import {useEffect,useRef,useState} from 'react';
import type {ApplicationRow} from '@/lib/recruitment';
import type {ApplicantQuery} from '@/lib/applicant-validation';
import {loadMoreApplicants} from '@/app/actions/applicant-more';
import {applicantKey} from '@/lib/applicant-selection';
import {ApplicantTable} from './applicant-table';
export function ApplicantMore({rows,count,query,archived}:{rows:ApplicationRow[];count:number;query:ApplicantQuery;archived:boolean}){
 const [extra,setExtra]=useState<ApplicationRow[]>([]),[page,setPage]=useState(1),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const loaded=useRef(1),generation=useRef(0);
 // Refresh expanded pages after status edits/deletion, keeping this table mounted.
 useEffect(()=>{
  let live=true;generation.current++;
  if(loaded.current>1){
   (async()=>{try{const next:ApplicationRow[]=[];for(let p=2;p<=loaded.current;p++){const result=await loadMoreApplicants(p,query);next.push(...result.rows);}if(live)setExtra(next);}catch{if(live)setMessage('추가 목록을 갱신하지 못했습니다. 다시 불러와주세요.');}})();
  }
  return()=>{live=false;};
 },[rows,query]);
 const combined=[...rows,...extra].filter((row,index,all)=>all.findIndex(item=>applicantKey(item)===applicantKey(row))===index);
 async function more(){
  setBusy(true);setMessage('');const version=generation.current;
  try{const result=await loadMoreApplicants(page+1,query);if(version!==generation.current)return;setExtra(previous=>[...previous,...result.rows]);setPage(page+1);loaded.current=page+1;}
  catch{if(version===generation.current)setMessage('목록을 불러오지 못했습니다. 선택은 유지됩니다. 더보기를 다시 눌러주세요.');}
  finally{setBusy(false);}
 }
 return <><ApplicantTable rows={combined} archived={archived} expanded/><div className="ops-shortcuts applicant-pagination" aria-busy={busy}><span>{combined.length} / {count}명 표시</span>{page*20<count&&<button type="button" disabled={busy} onClick={()=>void more()}>{busy?'불러오는 중…':'신청자 더보기 · 20명'}</button>}{message&&<p role="alert">{message}</p>}</div></>;
}
