'use client';
import { useRef, useState } from 'react';
import { previewKstDate } from '@/lib/esign-preview-date';
import { applicationStatuses } from '@/lib/applicant-validation';
import { applicantKey, reconcileApplicantChange, changeRequest, duplicateRequest, prepareRequests, requestAccessReason, requestStates, targetEligibility, targetFixtures, type RequestDocument, type TargetApplicant, type TargetRequest } from '@/lib/signing-targets';
import type { DocumentTemplate } from '@/lib/document-admin-model';
import styles from './document-admin.module.css';
import {DemoRequestControls} from './demo-request-controls';
const events=[['preview-event-1','가상 기수 행사'],['preview-event-2','가상 단기 행사']];
const date=previewKstDate;
const label=(s:string)=>applicationStatuses[s as keyof typeof applicationStatuses]??'미확인';
export function SigningTargetPreview({templates}:{templates:DocumentTemplate[]}) {
 const [applicants,setApplicants]=useState(targetFixtures);
 const [event,setEvent]=useState(events[0][0]);
 const [templateId,setTemplateId]=useState('');
 const [selected,setSelected]=useState<string[]>([]);
 const [requests,setRequests]=useState<TargetRequest[]>([]);
 const [days,setDays]=useState(7);
 const [notice,setNotice]=useState('');
 const [testAuth,setTestAuth]=useState(false);
 const [busy,setBusy]=useState(false);
 const session=useRef('');
 const commandId=useRef('');
 async function api(body:Record<string,unknown>,authorized=testAuth){
  if(!authorized)throw new Error('UNAUTHENTICATED · 테스트 관리자 역할을 명시적으로 선택하세요.');
  if(!session.current){session.current=sessionStorage.getItem('esign-preview-session-v9')??crypto.randomUUID();sessionStorage.setItem('esign-preview-session-v9',session.current);}
  const response=await fetch('/preview/document-admin/api/validate',{method:'POST',headers:{'Content-Type':'application/json','x-esign-test-actor':'fixture-admin','x-esign-test-session':session.current},body:JSON.stringify(body)});
  const data=await response.json();if(!response.ok)throw new Error(`${data.code} ${data.results?.map((r:{key:{application_id:string};code:string})=>`${r.key.application_id}: ${r.code}`).join(', ')??''}`);return data;
 }

 async function demoPdf(requestId:string,eventId:string){
  if(!testAuth)throw new Error('UNAUTHENTICATED');
  const response=await fetch('/preview/document-admin/api/validate',{method:'POST',headers:{'Content-Type':'application/json','x-esign-test-actor':'fixture-admin','x-esign-test-session':session.current},body:JSON.stringify({operation:'demo-pdf',eventId,requestId})});
  if(!response.ok)throw new Error((await response.json()).code);return response.blob();
 }
 async function reloadServer(authorized=testAuth,selectedEvent=event){
  const data=await api({operation:'list',eventId:selectedEvent},authorized);
  setRequests(rows=>[...rows.filter(r=>!r.id.startsWith('server-preview-')||r.key.event_id!==selectedEvent),...data.requests]);
 }
 const [review,setReview]=useState<{keys:string[];document:RequestDocument}|null>(null);
 const [message,setMessage]=useState('');
 const template=templates.find(t=>t.id===templateId);
 const visible=applicants.filter(a=>a.event_id===event);
 const eligibility=(a:TargetApplicant)=>targetEligibility(a,event);
 const selectable=(a:TargetApplicant)=>eligibility(a).sendable&&!!template&&!duplicateRequest(requests,a,template.id);
 const ready=visible.filter(selectable);
 function invalidate(){setSelected([]);setReview(null);setNotice('');commandId.current='';}
 function update(a:TargetApplicant,patch:Partial<TargetApplicant>){
 const next={...a,...patch,revision:a.revision+1};
 setApplicants(rows=>rows.map(row=>applicantKey(row)===applicantKey(a)?next:row));
 setRequests(rows=>{const local=rows.filter(r=>!r.id.startsWith('server-preview-'));return [...rows.filter(r=>r.id.startsWith('server-preview-')),...reconcileApplicantChange(local,a,next,new Date().toISOString())];});
 invalidate();
}
 async function create(){if(!review||busy)return;setBusy(true);try{
 if(!template||template.id!==review.document.id||template.revision!==review.document.revision)throw new Error('템플릿 변경 · 다시 확인 필요');
 commandId.current ||= crypto.randomUUID();
 const keys=review.keys.map(key=>{const a=applicants.find(a=>applicantKey(a)===key);if(!a)throw new Error('신청자 미확인');return {event_id:a.event_id,source:a.source,application_id:a.application_id};});
 const data=await api({operation:'validate',eventId:event,documentId:template.id,version:template.revision,keys,days,idempotencyKey:commandId.current});
 const added=data.result.requests as TargetRequest[];
 await reloadServer();invalidate();setNotice(`${data.code} · ${added.length}명 서버 메모리 저장 후 재조회. 영구 저장·실제 문자 없음. 개발 링크·테스트 PDF는 별도 시연 기능입니다.`);
 }catch(e){setNotice((e as Error).message);}finally{setBusy(false);}}

 async function serverScenario(a:TargetApplicant,scenario:string){if(busy)return;setBusy(true);try{await api({operation:'scenario',eventId:a.event_id,keys:[{event_id:a.event_id,source:a.source,application_id:a.application_id}],scenario});await reloadServer();setNotice('테스트 서버 가상 상태 변경 완료 · 브라우저 상태와 별도로 관리됩니다.');}catch(e){setNotice((e as Error).message);}finally{setBusy(false);}}
 function act(r:TargetRequest,action:'cancel'|'expire'|'reissue'){if(r.id.startsWith('server-preview-')){if(action==='reissue'){void api({operation:'detail',eventId:r.key.event_id,requestId:r.id}).then(data=>setNotice(`${data.reissue.code} · 실제 재발급 미구현`)).catch(e=>setNotice(e.message));return;}void api({operation:action==='cancel'?'cancel':'expire',eventId:r.key.event_id,requestId:r.id}).then(()=>reloadServer()).catch(e=>setNotice(e.message));return;}try{const a=applicants.find(a=>applicantKey(a)===applicantKey(r.key));const next=changeRequest(r,action,a,new Date().toISOString(),days);setRequests(rows=>rows.map(row=>row.id===r.id?next:row));setNotice('가상 이력 갱신 · 실제 링크 발급/차단은 서버 연동 전입니다.');}catch(e){setNotice((e as Error).message);}}
 function seedComplete(a:TargetApplicant){if(!template||duplicateRequest(requests,a,template.id))return;const now=new Date().toISOString();try{const [r]=prepareRequests(applicants,[applicantKey(a)],event,template,requests,now,days);setRequests(rows=>[...rows,{...r,status:'completed',completedAt:now,history:[...r.history,'가상 완료 이력 주입 · 실제 서명/PDF 없음']}]);invalidate();}catch(e){setNotice((e as Error).message);}}
 return <section className={styles.panel} aria-label="합격자 요청 준비 미리보기">
 <h2>6단계 · 합격자·참가 확정자 요청 준비</h2>
 <p className={styles.alert}>모든 신청자·연락처·이력은 가상입니다. TEST-PHONE은 전화번호가 아닌 표식입니다. 운영 요청·문자·OTP는 생성하지 않습니다. 10단계 개발 링크와 테스트 PDF만 별도로 서버 메모리에 보관합니다.</p>
 <label className={styles.testAuthToggle}><input type="checkbox" checked={testAuth} onChange={e=>{setTestAuth(e.target.checked);if(e.target.checked)void reloadServer(true).catch(error=>setNotice(error.message));}}/><span>테스트 관리자 역할 사용 (실제 인증 아님 · 기본 거부)</span></label>
 <p>8단계 서버 임시 정책: accepted만 허용, received/reviewing + confirmed는 POLICY_HOLD. 브라우저 상태 시험은 서버 값을 바꾸지 않습니다. 아래 별도 서버 시험 버튼으로만 가상 서버 상태를 변경합니다. 9단계 요청은 서버 메모리에만 저장되며 서버 재시작 시 사라집니다. 새로고침 후 테스트 역할을 다시 선택하면 같은 탭의 요청을 재조회합니다. 영구 저장이 아닙니다.</p>
 <p>합격과 참가 확정은 별도 판단합니다. 대기·불합격·취소 및 서로 충돌하는 상태는 제외합니다. 아래 기준과 7일 기본 유효기간은 미리보기용 제안이며 운영 정책이 아닙니다.</p>
 <div className={styles.filters}>
 <label>1. 대상 이벤트<select value={event} onChange={e=>{const next=e.target.value;setEvent(next);invalidate();if(testAuth)void reloadServer(true,next).catch(error=>setNotice(error.message));}}>{events.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
 <label>2. 요청 서류<select value={templateId} onChange={e=>{setTemplateId(e.target.value);invalidate();}}><option value="">서류 선택</option>{templates.map(t=><option key={t.id} value={t.id}>{t.name} · v{t.revision}</option>)}</select></label>
 <label>유효기간 (미리보기 1~30일)<input type="number" min={1} max={30} value={days} onChange={e=>{setDays(Number(e.target.value));setReview(null);}}/></label></div>
 <p>총 {visible.length}명 · 자격 대상 {visible.filter(a=>eligibility(a).eligible).length}명 · 자격 제외 {visible.filter(a=>!eligibility(a).eligible).length}명 · 전화번호 없음 {visible.filter(a=>eligibility(a).eligible&&!a.phone).length}명 · 현재 선택 가능 {ready.length}명 · 선택 {selected.length}명</p>
 <p>서류 템플릿은 기존 관리 탭과 공유합니다. PDF가 없는 가상 템플릿도 요청 흐름만 시험할 수 있으며, 운영에서는 게시된 PDF·필드 검증이 필수입니다.</p>
 <div className={styles.tableScroll}><table><caption>3~4. 가상 신청자 대상 선정 · 실제 상태 변경 없음</caption><thead><tr><th><input type="checkbox" aria-label="요청 가능한 대상 모두 선택" checked={ready.length>0&&ready.every(a=>selected.includes(applicantKey(a)))} disabled={!ready.length} onChange={e=>{setSelected(e.target.checked?ready.map(applicantKey):[]);setReview(null);}}/></th>{['참가자 / 식별자','신청 상태','참가 확정','대상 판정 / 제외 사유','가상 상태 시험'].map(t=><th key={t}>{t}</th>)}</tr></thead><tbody>{visible.map(a=>{const key=applicantKey(a),dup=template&&duplicateRequest(requests,a,template.id);return <tr key={key}><td><input type="checkbox" aria-label={`${a.name} 요청 대상 선택`} checked={selected.includes(key)&&selectable(a)} disabled={!selectable(a)} onChange={e=>{setSelected(keys=>e.target.checked?[...keys,key]:keys.filter(k=>k!==key));setReview(null);}}/></td><td>{a.name}<small className={styles.rowMeta}>{a.event_id} / {a.source} / {a.application_id}</small><small>{a.phone??'전화번호 없음'}</small></td><td>{label(a.status)} ({a.status})</td><td>{a.confirmation??'참여 이력 없음'}</td><td>{eligibility(a).reason}{dup&&<p>동일 서류 이력 있음 · 중복 차단 ({requestStates[dup.status]})</p>}</td><td><label>가상 신청 상태<select value={a.status} onChange={e=>update(a,{status:e.target.value})}>{!Object.hasOwn(applicationStatuses,a.status)&&<option value={a.status}>미확인</option>}{Object.entries(applicationStatuses).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label><label>가상 참가 확정<select value={a.confirmation??''} onChange={e=>update(a,{confirmation:e.target.value||null})}><option value="">이력 없음</option><option value="unconfirmed">미확정</option><option value="confirmed">참가 확정</option><option value="cancelled">참가 취소</option></select></label><button onClick={()=>update(a,{selectionRevoked:!a.selectionRevoked})}>{a.selectionRevoked?'합격 취소 표식 해제':'합격 취소 시험'}</button><button onClick={()=>update(a,{status:'withdrawn'})}>신청 철회 시험</button><button onClick={()=>update(a,{phone:a.phone?.endsWith('-CHANGED')?null:'TEST-PHONE-CHANGED'})}>연락처 변경 시험</button><button disabled={!selectable(a)} onClick={()=>seedComplete(a)}>가상 완료 이력 주입</button><details><summary>서버 가상 상태 시험</summary>{[['withdraw','서버 철회'],['revoke','서버 합격 취소 전환'],['phone','서버 전화번호 제거'],['waitlist','서버 대기'],['confirmOnly','서버 참가 확정만'],['complete','서버 가상 완료']].map(([id,text])=><button key={id} disabled={busy||!testAuth} onClick={()=>void serverScenario(a,id)}>{text}</button>)}</details></td></tr>;})}</tbody></table></div>
 <button disabled={!template||!selected.length} onClick={()=>{if(template)setReview({keys:selected,document:{id:template.id,name:template.name,revision:template.revision}});}}>5. 선택 대상·요청 내용 확인</button>
 {review&&<div className={styles.detail}><h3>최종 확인 · 메모리 요청 준비</h3><p>{events.find(([id])=>id===event)?.[1]} / {review.document.name} v{review.document.revision} / {review.keys.length}명 / 유효기간 {days}일</p><ul>{review.keys.map(k=><li key={k}>{applicants.find(a=>applicantKey(a)===k)?.name} · {k}</li>)}</ul><p>생성 시 현재 상태를 다시 검증합니다. 향후에는 서버가 관리자 권한·이벤트 소속·신청 상태·버전·중복을 트랜잭션으로 재검증해야 합니다.</p><button disabled={busy} onClick={()=>void create()}>6. 서버 검증 후 메모리 목록 반영</button><button onClick={()=>setReview(null)}>확인 취소</button></div>}
 <p role="status">{notice}</p><button disabled={!testAuth||busy} onClick={()=>void reloadServer().catch(e=>setNotice(e.message))}>서버 메모리 요청 재조회</button><p>서버 저장 건은 server-preview 식별자로 표시됩니다. 브라우저 전용 상태 시험은 서버 요청을 수정하지 않습니다.</p>
 <h3>가상 요청 목록 · {requests.length}건 (모든 이벤트)</h3><p>완료·취소·만료 이력도 중복 생성이 차단됩니다. 미완료 요청의 재발급 예정 처리는 아래에서 명시적으로 수행하세요. 완료 이력은 삭제·덮어쓰기하지 않습니다.</p>
 <div className={styles.tableScroll}><table><caption>요청·상태 변경 이력 · 개발 링크는 테스트 전용</caption><thead><tr>{['이벤트 / 참가자','신청 상태 (당시 → 현재)','서류 / 버전','요청 상태','생성 / 만료 / 완료','접근·연락처 판정','관리 / 이력'].map(v=><th key={v}>{v}</th>)}</tr></thead><tbody>{requests.map(r=>{const a=applicants.find(a=>applicantKey(a)===applicantKey(r.key));return <tr key={r.id}><td>{events.find(([id])=>id===r.key.event_id)?.[1]}<br/>{r.name}</td><td>{label(r.applicantStatus)} → {a?label(a.status):'미확인'}</td><td>{r.document.name} v{r.document.revision}</td><td>{requestStates[r.status]}<br/>운영 링크 미발급 · 개발 링크는 아래 별도 제공 · 세대 {r.generation}</td><td>{date(r.createdAt)}<br/>{date(r.expiresAt)}<br/>{date(r.completedAt)}</td><td>{r.id.startsWith('server-preview-')?`${requestStates[r.status]} · 서버 개발 시연 기록 / 운영 접근 없음`:requestAccessReason(r,a,new Date().toISOString())}</td><td>{r.id.startsWith('server-preview-')&&<DemoRequestControls row={r} call={body=>api(body)} getPdf={()=>demoPdf(r.id,r.key.event_id)} refresh={()=>reloadServer()}/>}<button disabled={r.status==='completed'} onClick={()=>act(r,'cancel')}>요청 취소 시험</button><button disabled={r.status==='completed'} onClick={()=>act(r,'expire')}>만료 시험</button><button disabled={r.status==='completed'||!a||!targetEligibility(a,r.key.event_id).sendable} onClick={()=>act(r,'reissue')}>현재 연락처 확인·재발급 예정</button><button onClick={()=>setMessage(r.id)}>문자 미리보기</button><details><summary>가상 이력</summary><ol>{r.history.map((h,i)=><li key={i}>{h}</li>)}</ol></details></td></tr>;})}</tbody></table></div>
 {requests.find(r=>r.id===message)&&<pre className={styles.messagePreview}>{(()=>{const r=requests.find(r=>r.id===message)!;const a=applicants.find(a=>applicantKey(a)===applicantKey(r.key));return `[테스트 전용 · 실제 발송 불가]\n${r.name}님, ${r.document.name} v${r.document.revision} 서명 안내\n링크: {미발급_접근불가_자리표시자}\n만료 예정: ${date(r.expiresAt)}\n${r.id.startsWith('server-preview-')?`${requestStates[r.status]} · 서버 개발 시연 기록 / 운영 접근 없음`:requestAccessReason(r,a,new Date().toISOString())}`;})()}</pre>}
 <button disabled>실제 문자 발송 · 미구현</button><button disabled>실제 링크·OTP 발급 · 미구현</button>
 </section>;
}
