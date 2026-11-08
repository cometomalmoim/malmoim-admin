'use client';
import {useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {ApplicantEditor} from './applicant-editor';

export function ApplicantAdd({events,initialEvent}:{events:{id:string;slug:string;title:string}[];initialEvent?:string}){
 const dialog=useRef<HTMLDialogElement>(null);const router=useRouter();const [version,setVersion]=useState(0);
 const [eventId,setEventId]=useState(initialEvent??'');
 const event=events.find(item=>item.id===eventId);
 return <><button type="button" className="ops-link" onClick={()=>{setEventId(initialEvent??'');setVersion(value=>value+1);dialog.current?.showModal();}}>+ 신청자 추가</button><dialog ref={dialog} className="applicant-detail-dialog applicant-add-dialog" aria-label="신청자 직접 추가"><header><h2>신청자 직접 추가</h2><button type="button" onClick={()=>dialog.current?.close()}>닫기</button></header><p>신청자를 등록할 이벤트를 먼저 선택해주세요.</p><label>등록 이벤트<select value={eventId} onChange={e=>setEventId(e.target.value)}><option value="">이벤트 선택</option>{events.map(item=><option key={item.id} value={item.id}>{item.title}</option>)}</select></label>{event?<ApplicantEditor key={`${event.id}:${version}`} slug={event.slug} returnHref={`/admin/recruitment?event=${event.id}`} onSaved={()=>{dialog.current?.close();router.refresh();}}/>:<p>이벤트를 선택하면 등록 양식이 표시됩니다.</p>}</dialog></>;
}
