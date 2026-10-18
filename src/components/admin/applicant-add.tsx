'use client';
import {useState} from 'react';
import {ApplicantEditor} from './applicant-editor';

export function ApplicantAdd({events,initialEvent}:{events:{id:string;slug:string;title:string}[];initialEvent?:string}){
 const [eventId,setEventId]=useState(initialEvent??'');
 const event=events.find(item=>item.id===eventId);
 return <details className="applicant-add"><summary>+ 신청자 직접 추가</summary><p>신청자를 등록할 이벤트를 먼저 선택해주세요.</p><label>등록 이벤트<select value={eventId} onChange={e=>setEventId(e.target.value)}><option value="">이벤트 선택</option>{events.map(item=><option key={item.id} value={item.id}>{item.title}</option>)}</select></label>{event?<ApplicantEditor key={event.id} slug={event.slug} returnHref={`/admin/recruitment?event=${event.id}`}/>:<p>이벤트를 선택하면 등록 양식이 표시됩니다.</p>}</details>;
}
