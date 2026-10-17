 'use client';
import {useActionState} from 'react';
import {saveEventSession} from '@/app/actions/event-sessions';
export type EventSession={id:string;session_date:string;title:string;revision:number};
export function EventSessionEditor({slug,current}:{slug:string;current?:EventSession}){
 const [state,action,pending]=useActionState(saveEventSession.bind(null,slug),{code:''});
 const messages:Record<string,string>={saved:'일정을 저장했습니다. 위에서 해당 날짜를 선택해주세요.',duplicate:'이미 등록된 날짜입니다. 해당 날짜의 회차를 선택해주세요.',locked:'출석 기록이 있는 날짜는 변경할 수 없습니다. 제목은 수정할 수 있습니다.',conflict:'다른 운영진이 수정했습니다. 새로고침 후 확인해주세요.',invalid:'날짜와 회차 이름을 확인해주세요.',forbidden:'관리자 권한이 필요합니다.',error:'저장하지 못했습니다. 다시 시도해주세요.'};
 return <details className="session-editor"><summary>{current?'선택한 회차 수정':'＋ 진행 날짜 추가'}</summary><form action={action}><input type="hidden" name="session_id" value={current?.id??''}/><input type="hidden" name="revision" value={current?.revision??0}/><fieldset disabled={pending}><label>진행 날짜 (한국 기준)<input required type="date" name="session_date" min="2000-01-01" max="2100-12-31" defaultValue={current?.session_date}/></label><label>회차 이름<input required name="title" maxLength={80} placeholder="예: 1회차 · 한국어 언어교환" defaultValue={current?.title}/></label><button type="submit" className="evt-primary">{pending?'저장 중…':current?'일정 수정':'날짜 추가'}</button></fieldset><p role="status">{messages[state.code]??''}</p></form></details>;
}
