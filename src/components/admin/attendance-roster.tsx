'use client';
import Link from 'next/link';
import {useState,useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {saveSessionAttendance} from '@/app/actions/event-sessions';
import {attendances,confirmations} from '@/lib/participation-validation';

export type AttendanceRow={id:string;source:string;name:string;contact:string;record:null|{confirmation:string;attendance:string;note:string;revision:number;session_revision:number;legacy_attendance:string}};
export function AttendanceRoster({slug,rows,sessionId}:{slug:string;rows:AttendanceRow[];sessionId:string}){
 const [filter,setFilter]=useState('all');
 const visible=rows.filter(row=>filter==='all'||(filter==='unlinked'?!row.record:filter==='unrecorded'?row.record?.attendance==='unrecorded':row.record?.attendance===filter));
 const groups=[['all','전체'],['unrecorded','출석 미기록'],['attended','참석'],['absent','미참석'],['no_show','노쇼'],['unlinked','사람 연결 필요']];
 const count=(value:string)=>rows.filter(row=>value==='all'||(value==='unlinked'?!row.record:value==='unrecorded'?row.record?.attendance==='unrecorded':row.record?.attendance===value)).length;
 return <div className="attendance-workspace"><p className="attendance-hint">아래 분류와 인원은 현재 페이지 기준입니다. 이름·연락처 검색은 이벤트 전체에서 조회합니다.</p><div className="attendance-filters" aria-label="현재 페이지 출석 분류">{groups.map(([value,label])=><button type="button" key={value} aria-pressed={filter===value} onClick={()=>setFilter(value)}>{label}<strong>{count(value)}</strong></button>)}</div>
 <p>참가 확정된 사람만 출석을 기록할 수 있습니다. 사람 연결과 참가 상태 변경은 ‘상세 관리’에서 진행합니다.</p>
 {!visible.length?<p role="status">현재 페이지에 해당하는 신청자가 없습니다.</p>:<div className="ops-table-scroll"><table className="ops-applications attendance-table"><thead><tr>{['신청자','참가 상태','출석 빠른 기록','관리'].map(label=><th key={label}>{label}</th>)}</tr></thead><tbody>{visible.map(row=><AttendanceItem key={`${row.source}:${row.id}:${row.record?.revision??0}:${row.record?.session_revision??0}`} slug={slug} row={row} sessionId={sessionId}/>)}</tbody></table></div>}</div>;
}
function AttendanceItem({slug,row,sessionId}:{slug:string;row:AttendanceRow;sessionId:string}){
 const [pending,startTransition]=useTransition();const [message,setMessage]=useState('');const [blocked,setBlocked]=useState(false);const router=useRouter();
 const record=row.record;
 function save(attendance:string){
  if(!record||pending||blocked||attendance===record.attendance)return;
  const data=new FormData();data.set('revision',String(record.session_revision));data.set('session_id',sessionId);data.set('participation_revision',String(record.revision));data.set('attendance',attendance);
  startTransition(async()=>{try{const result=await saveSessionAttendance(slug,row.source,row.id,data);setMessage(({saved:'저장했습니다.',conflict:'다른 운영진이 수정했습니다. 새로고침 후 다시 확인해주세요.',future:'미래 날짜의 회차에는 실제 출석을 기록할 수 없습니다.',confirmation:'참가 확정 후 출석을 기록해주세요.',forbidden:'관리자 권한을 확인해주세요.',missing:'연결 정보를 찾지 못했습니다.'} as Record<string,string>)[result.code]??'저장하지 못했습니다. 다시 시도해주세요.');if(result.code==='conflict')setBlocked(true);if(result.code==='saved'){setBlocked(true);router.refresh();}}catch{setMessage('연결 오류입니다. 새로고침 후 저장 여부를 확인해주세요.');setBlocked(true);}});
 }
 return <tr><td><strong>{row.name}</strong><small className="attendance-contact">{row.contact}</small>{record&&record.legacy_attendance!=='unrecorded'&&<small>날짜 미지정 기존 기록: {attendances[record.legacy_attendance as keyof typeof attendances]}</small>}</td><td>{record?confirmations[record.confirmation as keyof typeof confirmations]??'확인 필요':'사람 연결 전'}</td><td><div className="attendance-actions" aria-label={`${row.name} 출석 기록`}>{Object.entries(attendances).map(([value,label])=><button type="button" key={value} aria-pressed={record?.attendance===value} disabled={pending||blocked||!record||(record.confirmation!=='confirmed'&&value!=='unrecorded')||record.attendance===value} onClick={()=>save(value)}>{label}</button>)}</div>{!record&&<small>동일 인물 확인·연결이 먼저 필요합니다.</small>}<span role="status" className="attendance-feedback">{pending?'저장 중…':message}</span>{blocked&&<button type="button" onClick={()=>router.refresh()}>최신 기록 불러오기</button>}</td><td><Link href={`/admin/events/${encodeURIComponent(slug)}/participants/${row.source}/${row.id}`}>상세 관리 →</Link></td></tr>;
}
