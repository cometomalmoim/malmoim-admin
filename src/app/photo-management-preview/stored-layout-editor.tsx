'use client';
import Image from 'next/image';
import {useState} from 'react';
import type {StoredActivity} from '@/lib/history-activities/activity-storage';
import {moveLayoutPhoto} from '@/lib/history-activities/photo-layout';
import type {HistoryPhoto} from '../(public)/history/history-data';
export function StoredLayoutEditor({activity,preview,busy,save}:{activity:StoredActivity;preview?:HistoryPhoto;busy:boolean;save:(order:string[],cover:string)=>Promise<void>}){
 const [order,setOrder]=useState([...activity.order]),[cover,setCover]=useState(activity.coverId);
 const eligible=activity.order.length>0&&activity.photos.every(p=>p.state==='final'&&!p.deletePending);
 const dirty=cover!==activity.coverId||order.some((id,i)=>id!==activity.order[i]);
 return <fieldset disabled={busy||!eligible} data-layout-activity={activity.id} className="activity-card"><legend>저장된 사진 · 대표 및 순서</legend>
 {!eligible&&<p>모든 사진이 확정되고 삭제 대기 상태가 아닐 때 편집할 수 있습니다.</p>}
 {order.map((id,i)=>{const photo=preview?.slidePhotos?.[activity.order.indexOf(id)];return <div key={id} data-layout-photo={id} style={{padding:12,borderBottom:'1px solid #ddd'}}>
 {photo&&<Image unoptimized src={photo.src} alt={photo.alt} width={120} height={90} style={{objectFit:'contain'}}/>}<p>{i+1}번 · {cover===id?'대표 사진':'추가 사진'}</p>
 <div className="activity-actions" style={{flexWrap:'wrap'}}><button type="button" aria-pressed={cover===id} onClick={()=>setCover(id)}>대표 지정</button>
 <button type="button" disabled={i===0} aria-label={`${i+1}번 위로`} onClick={()=>setOrder(moveLayoutPhoto(order,id,-1))}>↑ 위로</button>
 <button type="button" disabled={i===order.length-1} aria-label={`${i+1}번 아래로`} onClick={()=>setOrder(moveLayoutPhoto(order,id,1))}>↓ 아래로</button></div></div>;})}
 <button type="button" className="activity-primary" disabled={!dirty||!eligible||busy} onClick={()=>{void save(order,cover);}}>대표·순서 저장</button><p>저장 전에는 DB에 반영되지 않습니다. 파일은 다시 업로드하지 않습니다.</p>
 </fieldset>;
}
