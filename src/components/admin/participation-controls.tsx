'use client';
import {useActionState} from 'react';
import {saveDailySession,updateParticipation,toggleParticipation} from '@/app/actions/participation-requests';
import {requestStatuses,requestStatusNames} from '@/lib/participation-requests';
const messages:Record<string,string>={saved:'저장했습니다.',invalid:'입력 내용을 확인해주세요.',error:'저장하지 못했습니다. 다시 시도해주세요.',stale:'다른 운영진이 수정했습니다. 새로고침 후 다시 확인해주세요.',forbidden:'관리자 권한이 필요합니다.'};
export function ParticipationUpdate({id,status,message,revision}:{id:string;status:string;message:string;revision:number}){
 const [state,action,pending]=useActionState(updateParticipation,{code:''});
 return <form action={action} className="join-admin-update"><input type="hidden" name="id" value={id}/><input type="hidden" name="revision" value={revision}/><fieldset disabled={pending}><label>진행 상태<select name="status" defaultValue={status}>{requestStatuses.map(s=><option key={s} value={s}>{requestStatusNames[s][0]}</option>)}</select></label><label>신청자에게 표시할 안내<textarea name="message" defaultValue={message} maxLength={1000} rows={3} placeholder="확정 여부·준비물·납부 안내 등을 남겨주세요."/></label><p className="ops-muted">개인 확인 링크에 표시됩니다. 자동 문자 발송·결제·환불은 실행하지 않습니다. 언어교환 상대의 연락처는 양쪽 동의를 확인한 뒤 안내해주세요.</p><button className="evt-primary">{pending?'저장 중…':'상태·안내 저장'}</button></fieldset>{state.code&&<p role="status">{messages[state.code]??'처리하지 못했습니다.'}</p>}</form>;
}
export function ParticipationToggle({target,open}:{target:string;open:boolean}){
 const [state,action,pending]=useActionState(toggleParticipation,{code:''});
 return <form action={action}><input type="hidden" name="target" value={target}/><input type="hidden" name="open" value={String(!open)}/><button disabled={pending}>{pending?'변경 중…':open?'신청 마감하기':'신청 열기'}</button>{state.code&&<span role="status"> {messages[state.code]??'처리하지 못했습니다.'}</span>}</form>;
}
export function DailySessionCreate(){
 const [state,action,pending]=useActionState(saveDailySession,{code:''});
 return <details className="ops-panel"><summary>＋ 일일참여 날짜 추가</summary><form action={action} className="join-admin-update"><fieldset disabled={pending}><div className="join-admin-fields"><label>이름<input name="title" required maxLength={100} placeholder="말모임 9기 목요일 일일참여"/></label><label>장소<input name="location" required maxLength={200} defaultValue="서울청년센터 은평 · 서울 은평구 통일로67길 9"/></label><label>시작 (한국시간)<input type="datetime-local" name="starts_at" required/></label><label>종료 (한국시간)<input type="datetime-local" name="ends_at" required/></label><label>신청 마감 (한국시간)<input type="datetime-local" name="closes_at" required/></label><label>1회 참가비 (원)<input type="number" name="fee" required min={0} max={1000000} step={1} defaultValue={12000}/></label></div><button className="evt-primary">{pending?'저장 중…':'날짜 등록·신청 열기'}</button></fieldset>{state.code&&<p role="status">{messages[state.code]??'처리하지 못했습니다.'}</p>}</form></details>;
}
