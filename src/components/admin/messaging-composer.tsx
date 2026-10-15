'use client';
import {MessagingRecipients} from './messaging-recipients';
import type {MessagingApplicant} from '@/app/actions/message-applicants';
import {useState} from 'react';
import Link from 'next/link';
import type {RegisteredMessageEvent} from './message-preview';
import {messagingTemplates,composeMessaging} from '@/lib/messaging-templates';
import {messagePhone} from '@/lib/message-preview';
import './messaging.css';

export function MessagingComposer({events}:{events:RegisteredMessageEvent[]}){
 const [recipients,setRecipients]=useState<MessagingApplicant[]>([]);
 const [mode,setMode]=useState<'event'|'direct'>('event');
 const [eventId,setEventId]=useState('');
 const [templateId,setTemplateId]=useState<string>('event');
 const [body,setBody]=useState<string>(messagingTemplates.find(t=>t.id==='event')!.body);
 const [numbers,setNumbers]=useState('');
 const [name,setName]=useState('홍길동');
 const [due,setDue]=useState('');
 const [contact,setContact]=useState('');
 const event=events.find(e=>e.id===eventId);
 const entries=numbers.split(/[\n,;]+/).map(v=>v.trim()).filter(Boolean);
 const normalized=entries.map(messagePhone);
 const valid=[...new Set(normalized.filter((v):v is string=>v!==null))];
 const invalid=normalized.filter(v=>v===null).length;
 const duplicates=normalized.length-invalid-valid.length;
 const preview=composeMessaging(body,{'이름':mode==='event'?(recipients[0]?.name??''):name,'이벤트명':event?.title??'','일정':event?.starts_at?new Intl.DateTimeFormat('ko-KR',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Seoul'}).format(new Date(event.starts_at))+' (한국 시간)':'','장소':event?.location??'','참가비안내':event?.fee_notice??'','납부기한':due,'문의처':contact});
 return <div className="messaging">
  <section className="messaging-hero"><div className="messaging-title"><span aria-hidden="true">✉</span><div><h1>메시징</h1><p>이벤트에 맞는 안내를 고르고, 내용을 준비하세요.</p></div><span className="messaging-badge">발송 연결 준비 중</span></div>
   <nav className="messaging-tabs" aria-label="메시징 작성 방식"><button type="button" aria-pressed={mode==='event'} onClick={()=>setMode('event')}>이벤트 대상</button><button type="button" aria-pressed={mode==='direct'} onClick={()=>setMode('direct')}>번호 직접 입력</button><span>자동화 · 발송 로그 · 설정은 준비 중</span></nav>
  </section>
  <section className="messaging-event"><label>연결 이벤트<select value={eventId} onChange={e=>{setEventId(e.target.value);setRecipients([]);}}><option value="">이벤트를 선택해주세요</option>{events.map(e=><option key={e.id} value={e.id}>{e.title}</option>)}</select></label>{event?<div className="messaging-links"><Link href={`/admin/events/${encodeURIComponent(event.slug)}/information`}>이벤트 정보 ↗</Link><Link href={`/admin/events/${encodeURIComponent(event.slug)}/applicants`}>신청자 관리 ↗</Link></div>:<p>{events.length?'이벤트를 선택하면 제목·일정·장소·참가비 안내가 미리보기에 반영됩니다.':'등록된 이벤트가 없습니다.'}</p>}</section>
  <div className="messaging-columns">
   <section className="messaging-card"><div className="messaging-card-heading"><h2>{mode==='event'?'받는 대상':'받는 번호'}</h2><span>{mode==='direct'?`${valid.length}개`:`${recipients.length}명 선택`}</span></div>
    {mode==='event'?(event?<MessagingRecipients key={event.id} eventId={event.id} onSelect={setRecipients}/>:<p>이벤트를 먼저 선택해주세요.</p>):<><p className="messaging-help">번호마다 줄바꿈 또는 쉼표로 구분해주세요. 형식 확인용이며 실제 발송하지 않습니다.</p><label className="messaging-field">수신번호 입력<textarea rows={9} value={numbers} onChange={e=>setNumbers(e.target.value)} placeholder={'010-0000-0001\n010-0000-0002, 010-0000-0003'}/></label><p className="messaging-counts">형식 유효 {valid.length} · 중복 제외 {duplicates} · 형식 오류 {invalid}</p><p className="messaging-help">형식 검사는 실제 사용·수신 가능한 번호임을 보장하지 않습니다.</p></>}
    <div className="messaging-notice">작성 내용과 번호는 저장되지 않으며 새로고침하면 초기화됩니다. 실제 문자 발송은 비활성입니다.</div>
   </section>
   <section className="messaging-card"><div className="messaging-card-heading"><h2>문자 내용</h2><span>{Array.from(preview.text).length}자</span></div><p className="messaging-help">템플릿을 누르면 아래 내용이 해당 기본 문구로 바뀝니다.</p>
    <div className="messaging-templates" aria-label="안내 템플릿">{messagingTemplates.map(t=><button key={t.id} type="button" title={t.description} aria-pressed={templateId===t.id} onClick={()=>{setTemplateId(t.id);setBody(t.body);}}><span aria-hidden="true">{t.icon}</span>{t.label}</button>)}</div>
    <label className="messaging-field">문자 내용 편집<textarea rows={8} maxLength={2000} value={body} onChange={e=>{setBody(e.target.value);setTemplateId('custom');}}/></label><p className="messaging-help">{'변수: {이름} {이벤트명} {일정} {장소} {참가비안내} {납부기한} {문의처}'}</p>
    <div className="messaging-fields">{mode==='direct'&&<label className="messaging-field">미리보기용 이름<input value={name} maxLength={100} onChange={e=>setName(e.target.value)}/></label>}<label className="messaging-field">문의처<input value={contact} maxLength={200} placeholder="운영진 연락처 입력" onChange={e=>setContact(e.target.value)}/></label><label className="messaging-field">납부 기한<input value={due} maxLength={100} placeholder="입금 안내에 사용할 기한" onChange={e=>setDue(e.target.value)}/></label></div>
    <div className="messaging-preview"><h3>내용 미리보기 <small>{mode==='event'?(recipients.length?`선택 ${recipients.length}명 중 첫 신청자 · 발송 전 미리보기`:'신청자를 선택해주세요'):'예시 이름 적용 · 발송 대상 아님'}</small></h3><pre>{preview.text||'내용을 입력해주세요.'}</pre></div>
    {(preview.empty||preview.missing.length>0)&&<p className="messaging-warning" role="status">{preview.empty?'문자 내용을 입력해주세요.':`입력이 필요한 변수: ${preview.missing.join(', ')}`}</p>}
    <p className="messaging-help">환불 안내는 요청 접수 문구입니다. 실제 접수·선발 결과를 확인한 뒤 사용해주세요. 문자 종류·요금은 발송 업체 연결 후 확인할 수 있습니다.</p><button className="messaging-send" type="button" disabled>실제 발송 준비 중 · 내용 미리보기만 가능</button>
   </section>
  </div>
 </div>;
}
