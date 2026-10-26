"use client";
import {useState,useSyncExternalStore,type ReactNode} from 'react';
import {MessagingComposer} from './messaging-composer';
import type {RegisteredMessageEvent} from './message-preview';
function subscribeHash(listener:()=>void){window.addEventListener('hashchange',listener);return()=>window.removeEventListener('hashchange',listener);}
const hashSnapshot=()=>window.location.hash;
const serverHash=()=>'';
export function MessageWorkspace({events,logs,templates,settings}:{events:RegisteredMessageEvent[];logs:ReactNode;templates:ReactNode;settings:ReactNode}){
 const [view,setView]=useState<string|null>(null),[locked,setLocked]=useState(false);
 const hash=useSyncExternalStore(subscribeHash,hashSnapshot,serverHash);
 const active=view??(hash==='#messaging-logs'?'logs':hash==='#messaging-templates'?'templates':'send');
 const tabs=[['send','문자 보내기'],['logs','발송 기록'],['templates','템플릿 관리']];
 return <div className="message-workspace" onClickCapture={event=>{const target=event.target;if(!(target instanceof Element))return;const href=target.closest('a')?.getAttribute('href');if(href?.includes('#messaging-logs')||href?.includes('#messaging-templates')){event.preventDefault();if(!locked)setView(href.includes('logs')?'logs':'templates');}}}><div className="ops-heading"><h1>메시징</h1><p>조건으로 대상을 모아 발송하고, 보낸 문자와 도달 결과를 확인하세요.</p></div><nav className="message-workspace-tabs" role="tablist" aria-label="메시징 작업">{tabs.map(([key,label])=><button key={key} type="button" role="tab" id={`sms-tab-${key}`} aria-controls={`sms-panel-${key}`} aria-selected={active===key} disabled={locked&&active!==key} onClick={()=>setView(key)}>{label}</button>)}</nav><section id="sms-panel-send" role="tabpanel" aria-labelledby="sms-tab-send" hidden={active!=='send'}><MessagingComposer events={events} onLock={setLocked}/></section><section id="sms-panel-logs" role="tabpanel" aria-labelledby="sms-tab-logs" hidden={active!=='logs'}>{logs}</section><section id="sms-panel-templates" role="tabpanel" aria-labelledby="sms-tab-templates" hidden={active!=='templates'}>{templates}<details className="ops-panel messaging-settings-section"><summary>문자 연결·자동 알림 설정</summary>{settings}</details></section></div>;
}
