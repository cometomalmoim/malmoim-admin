 'use client';
import {startTransition,useActionState} from 'react';
import {saveParticipation} from '@/app/actions/participation';
import type {Participation,Person} from '@/lib/participation';
import {confirmations,attendances} from '@/lib/participation-validation';
export function ParticipationEditor({slug,source,id,current,people,profile}:{slug:string;source:string;id:string;current?:Participation|null;people:Person[];profile?:Person|null}){
 const [linkState,linkAction,linkPending]=useActionState(saveParticipation.bind(null,slug,source,id,'link'),{code:''});
 const [recordState,recordAction,recordPending]=useActionState(saveParticipation.bind(null,slug,source,id,'record'),{code:''});
 const message=(code:string)=>({saved:'저장했습니다.',identity:'같은 사람인지 확인한 뒤 체크해주세요.',invalid:'입력을 확인해주세요.',confirmation:'출석을 기록하려면 참가 확정이 필요합니다.',future:'행사 시작 전이거나 일정이 미정이면 실제 출석을 기록할 수 없습니다.',conflict:'다른 운영진이 먼저 수정했습니다. 최신 화면을 다시 불러와주세요.',locked:'기존 출석을 미기록으로 변경한 뒤 사람 연결을 수정해주세요.',duplicate:'선택한 사람은 이 이벤트의 다른 신청에 이미 연결되어 있습니다.',missing:'신청자 또는 연결 정보를 찾을 수 없습니다.',forbidden:'관리자 권한을 확인해주세요.',error:'저장하지 못했습니다. 입력을 유지한 채 다시 시도해주세요.'}[code]??'');
 const options=profile&&!people.some(p=>p.id===profile.id)?[profile,...people]:people;
 return <div>
 <details open={!current}><summary>{current?'사람 연결 변경':'신청 내역을 사람에게 연결'}</summary><p>이름·연락처가 같아도 자동으로 합치지 않습니다. 동일 인물인지 운영진이 확인해주세요. 잘못된 연결은 출석을 미기록으로 바꾼 뒤 수정할 수 있습니다.</p>
 <form className="evt-form" aria-label="사람 연결" onSubmit={event=>{event.preventDefault();const data=new FormData(event.currentTarget);startTransition(()=>linkAction(data));}}>
 <input type="hidden" name="revision" value={current?.revision??0}/><fieldset disabled={linkPending||recordPending}>
 <label>연결할 사람<select key={current?.person_id??'new'} name="person" defaultValue={current?.person_id??''}>{!current&&<option value="">이 신청자 정보로 새 사람 등록</option>}{options.map(p=><option key={p.id} value={p.id}>{p.name} · {p.contact}</option>)}</select></label>
 <label className="participation-check"><input type="checkbox" name="identity_confirmed" required/>신청자와 연결할 사람이 동일 인물임을 확인했습니다.</label>
 <button type="submit" className="evt-primary">{linkPending?'저장 중…':'사람 연결 저장'}</button></fieldset><p role="status">{message(linkState.code)}</p></form></details>
 {current&&<form className="evt-form" aria-label="참여 기록" onSubmit={event=>{event.preventDefault();const data=new FormData(event.currentTarget);startTransition(()=>recordAction(data));}}>
 <input type="hidden" name="revision" value={current.revision}/><fieldset disabled={recordPending||linkPending}><legend>이 이벤트의 참여 기록</legend><div className="evt-fields">
 <label>참가 상태<select name="confirmation" defaultValue={current.confirmation}>{Object.entries(confirmations).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
 <label>출석 상태<select name="attendance" defaultValue={current.attendance}>{Object.entries(attendances).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label></div>
 <label>참여 기록 메모<textarea name="note" maxLength={2000} defaultValue={current.note}/></label><button className="evt-primary" type="submit">{recordPending?'저장 중…':'참여 기록 저장'}</button></fieldset><p role="status">{message(recordState.code)}</p></form>}
 {(linkState.code==='conflict'||recordState.code==='conflict')&&<a href={`/admin/events/${encodeURIComponent(slug)}/participants/${source}/${id}`}>최신 화면 불러오기</a>}
 </div>;
}
