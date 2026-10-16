'use client';
import {useEffect,useState} from 'react';
import {loadMessageApplicants,type MessagingApplicant} from '@/app/actions/message-applicants';
import {applicationStatuses} from '@/lib/applicant-validation';
import {messagePhone} from '@/lib/message-preview';
export function MessagingRecipients({eventId,onSelect}:{eventId:string;onSelect:(rows:MessagingApplicant[])=>void}){
 const [rows,setRows]=useState<MessagingApplicant[]>([]),[selected,setSelected]=useState<MessagingApplicant[]>([]);
 const [search,setSearch]=useState(''),[query,setQuery]=useState(''),[status,setStatus]=useState(''),[page,setPage]=useState(1),[count,setCount]=useState(0),[state,setState]=useState('loading'),[retry,setRetry]=useState(0);
 const key=(r:MessagingApplicant)=>JSON.stringify([r.source,r.id]);
 useEffect(()=>{let active=true;loadMessageApplicants(eventId,page,query,status).then(result=>{if(!active)return;if(result.kind==='error'){setState('error');setRows([]);}else{setRows(result.rows);setCount(result.count);setState('ready');}});return()=>{active=false;};},[eventId,page,query,status,retry]);
 const change=(next:MessagingApplicant[])=>{setSelected(next);onSelect(next);};
 const filter=()=>{setState('loading');setPage(1);setQuery(search);change([]);setRetry(v=>v+1);};
 return <div className="messaging-recipients"><form onSubmit={e=>{e.preventDefault();filter();}}><label className="messaging-field">신청자 검색<input value={search} maxLength={100} onChange={e=>setSearch(e.target.value)} placeholder="이름 또는 연락처"/></label><label className="messaging-field">신청 상태<select value={status} onChange={e=>{setState('loading');setStatus(e.target.value);setPage(1);change([]);}}><option value="">전체 상태</option>{Object.entries(applicationStatuses).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><button type="submit">검색</button></form>
 <p role="status">{state==='loading'?'신청자를 불러오는 중입니다.':state==='error'?'신청자를 불러오지 못했습니다.':`검색 결과 ${count}명 · 선택 ${selected.length}명 · 수신번호 ${new Set(selected.map(r=>messagePhone(r.contact))).size}개`}</p>
 {state==='error'&&<button type="button" onClick={()=>{setState('loading');setRetry(v=>v+1);}}>다시 시도</button>}
 {state==='ready'&&<><button type="button" onClick={()=>change([])} disabled={!selected.length}>선택 해제</button>{!rows.length&&<p>해당 조건의 신청자가 없습니다.</p>}<ul className="messaging-recipient-list">{rows.map(r=>{const eligible=r.contact_type==='phone'&&!!messagePhone(r.contact);return <li key={key(r)}><label><input type="checkbox" disabled={!eligible} checked={selected.some(s=>key(s)===key(r))} onChange={e=>change(e.target.checked?[...selected,r]:selected.filter(s=>key(s)!==key(r)))}/><span><strong>{r.name}</strong> · {applicationStatuses[r.status as keyof typeof applicationStatuses]??r.status}<br/>{r.contact}{!eligible&&<small> · 전화번호 형식 확인 필요 — 선택 불가</small>}</span></label></li>;})}</ul><div className="messaging-pagination"><button type="button" disabled={page===1} onClick={()=>{setState('loading');setPage(p=>p-1);}}>이전</button><span>{page} / {Math.max(1,Math.ceil(count/25))}페이지</span><button type="button" disabled={page*25>=count} onClick={()=>{setState('loading');setPage(p=>p+1);}}>다음</button></div></>}
 <p className="messaging-help">페이지를 이동해도 선택은 유지됩니다. 검색·상태 조건을 바꾸면 선택이 해제됩니다. 동일 번호는 수신번호 수에서 한 번만 계산합니다. 입금·환불 발송 조건은 아직 연결되지 않았으며 실제 발송하지 않습니다.</p></div>;
}
