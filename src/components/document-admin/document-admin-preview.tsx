'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { previewKstDate } from '@/lib/esign-preview-date';
import { documentAdminFixtures } from '@/lib/document-admin-fixtures';
import { canUseCompletedPdf, filterRequests, requestCounts, requestMessage, selectedRequests, signatureStatuses, templateName, templateReadiness, toggleVisibleSelection, updateTemplate, type DocumentTemplate, type RequestFilter, type SigningRequest } from '@/lib/document-admin-model';
import { consentItems } from '@/lib/pdf-signing';
import { type PdfFieldSettings } from '@/lib/pdf-fields';
import { SigningTargetPreview } from './signing-target-preview';
import { TemplateWorkspace } from './template-workspace';
import { openLocalPdf, type LocalPdf } from './local-pdf';
import styles from './document-admin.module.css';

const date = previewKstDate;
const noArtifacts: ReadonlySet<string> = new Set();
function Status({ row }: { row: SigningRequest }) { return <span className={`${styles.status} ${styles[row.status]}`}>{signatureStatuses[row.status]} <small>가상</small></span>; }

function RequestDetail({ row, onClose }: { row: SigningRequest; onClose: () => void }) {
  const panel = useRef<HTMLElement>(null);
  useEffect(() => { panel.current?.focus(); }, [row.id]);
  const available = canUseCompletedPdf(row, noArtifacts);
  return <section ref={panel} tabIndex={-1} className={styles.detail} aria-label="가상 서명 기록 상세"><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>SIMULATED RECORD</p><h2>{row.participantName} · 서명 기록</h2></div><button onClick={onClose}>상세 닫기</button></div>
    <p className={styles.alert}>아래 상태·시각·응답은 모두 화면 검증용 가상 이력입니다. 실제 서명 완료나 실제 파일 보관을 의미하지 않습니다.</p>
    <dl className={styles.metadata}><div><dt>이벤트</dt><dd>{row.eventName}</dd></div><div><dt>서류 (요청 당시)</dt><dd>{row.templateName} · v{row.templateRevision}</dd></div><div><dt>상태</dt><dd><Status row={row}/></dd></div><div><dt>가상 요청일</dt><dd>{date(row.requestedAt)}</dd></div><div><dt>가상 완료일</dt><dd>{date(row.completedAt)}</dd></div><div><dt>참가자 연결 키</dt><dd>{row.participantKey.source} / {row.participantKey.applicationId}</dd></div></dl>
    <h3>서명 완료 PDF</h3><p>저장된 실제 PDF가 없습니다. 미리보기와 다운로드를 사용할 수 없습니다.</p><div className={styles.actions}><button disabled={!available}>완료 PDF 미리보기</button><button disabled={!available}>개별 PDF 다운로드</button></div>
    <h3>동의 항목별 응답 · 가상</h3>{row.answers ? <ul className={styles.responses}>{consentItems.map(item=><li key={item.id}><span>{item.title}{item.optional?' (선택)':''}</span><strong>{row.answers![item.id]===null?'미응답':row.answers![item.id] ? (item.id==='media'?'동의':'확인함'):'동의하지 않음'}</strong></li>)}</ul> : <p className={styles.muted}>이 상태의 가상 응답 기록은 없습니다. 응답을 추정하지 않습니다.</p>}
    <h3>가상 처리 이력</h3><ol className={styles.timeline}>{row.history.map((item,i)=><li key={`${item.at}:${i}`}><time>{date(item.at)}</time><span>{item.label}</span></li>)}</ol>
  </section>;
}

export function DocumentAdminPreview() {
  const [fixtures] = useState(documentAdminFixtures);
  const [templates, setTemplates] = useState(fixtures.templates);
  const requests = fixtures.requests;
  const [tab, setTab] = useState<'requests'|'templates'|'targets'>('requests');
  const [filter, setFilter] = useState<RequestFilter>({ eventId:'',status:'',name:'',templateId:'' });
  const [selection, setSelection] = useState<string[]>([]);
  const [messageId, setMessageId] = useState('');
  const [detail, setDetail] = useState<SigningRequest | null>(null);
  const [editing, setEditing] = useState('');
  const [deleting, setDeleting] = useState('');
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const sources = useRef(new Map<string, LocalPdf>());
  const [availableSources, setAvailableSources] = useState<Map<string, LocalPdf>>(()=>new Map());
  const alive = useRef(true);
  useEffect(() => { alive.current=true; const pool=sources.current; return()=>{alive.current=false; for(const source of pool.values())void source.destroy(); pool.clear();}; },[]);
  const visible = useMemo(()=>filterRequests(requests,filter),[requests,filter]);
  const selected = selectedRequests(visible,selection);
  const selectedMessage = selected.find(row=>row.id===messageId) ?? selected[0];
  const counts = requestCounts(requests);
  const eventOptions = [...new Map(requests.map(row=>[row.eventId,row.eventName])).entries()];
  const templateOptions = [...new Map([...requests.map(row=>[row.templateId,row.templateName] as const),...templates.map(t=>[t.id,t.name] as const)]).entries()];
  const currentTemplate = templates.find(t=>t.id===editing);
  function changeFilter(next: Partial<RequestFilter>) { setFilter(previous=>({...previous,...next})); setSelection([]); setMessageId(''); setDetail(null); }
  async function upload(file: File | undefined, existing?: DocumentTemplate) {
    if (!file || busy) return;
    setBusy(true); setEditing(''); setNotice('PDF를 브라우저 안에서 검증하는 중입니다. 파일은 서버로 전송하지 않습니다.');
    let loaded: LocalPdf | undefined;
    try {
      if (sources.current.size>=10 && (!existing || !sources.current.has(existing.id))) throw new Error('이 탭에서는 PDF 원본을 최대 10개까지 관리합니다. 사용하지 않는 템플릿을 삭제해주세요.');
      const name=existing ? existing.name : templateName(newName || file.name.replace(/\.pdf$/i,''));
      loaded=await openLocalPdf(file);
      if (!alive.current) {await loaded.destroy();return;}
      const now=new Date().toISOString(),id=existing?.id ?? crypto.randomUUID();
      const template:DocumentTemplate={id,name,revision:existing?existing.revision+1:1,createdAt:existing?.createdAt??now,updatedAt:now,origin:'local',original:{filename:file.name,bytes:file.size,fingerprint:loaded.fingerprint},settings:{version:1,fingerprint:loaded.fingerprint,pages:loaded.pages,fields:[]}};
      const old=sources.current.get(id);sources.current.set(id,loaded);setAvailableSources(new Map(sources.current));
      setTemplates(rows=>existing?rows.map(t=>t.id===id?template:t):[template,...rows]);setEditing(id);setTab('templates');setDeleting('');setNewName('');setNotice('PDF를 이 탭에 등록했습니다. 이름·날짜·서명 필드를 지정하고 설정을 저장하세요.');
      if(old)void old.destroy();
    }catch(error){if(alive.current)setNotice(error instanceof Error?error.message:'PDF 등록에 실패했습니다.');}
    finally{if(alive.current)setBusy(false);}
  }
  function save(name:string,settings:PdfFieldSettings|null) {
    if(!currentTemplate)throw new Error('템플릿을 찾을 수 없습니다.');
    const next=updateTemplate(currentTemplate,name,settings,new Date().toISOString());setTemplates(rows=>rows.map(t=>t.id===next.id?next:t));setNotice('템플릿 이름·설정을 메모리에 저장했습니다. 과거 요청의 서류명·버전은 유지합니다.');
  }
  function removeTemplate(id:string) {
    if(editing===id)setEditing('');
    const source=sources.current.get(id);sources.current.delete(id);setAvailableSources(new Map(sources.current));if(source)void source.destroy();
    setTemplates(rows=>rows.filter(t=>t.id!==id));setDeleting('');setNotice('템플릿을 이 탭의 목록에서 삭제했습니다. 기존 가상 요청 이력은 보존했습니다.');
  }
  return <main className={styles.admin}>
    <header className={styles.header}><div><p className={styles.eyebrow}>MALMOIM · DOCUMENTS / STEP 04</p><h1>서류·전자서명 관리</h1><p>템플릿부터 참가자별 서명 현황까지 한곳에서 확인하세요.</p></div><span className={styles.demoBadge}>가상 데이터 · 브라우저 메모리</span></header>
    <aside className={styles.banner}><strong>개발 전용 관리자 UI 미리보기</strong><span>실제 참가자·발송·서명·보관 데이터가 아닙니다. 업로드한 원본과 설정도 이 탭에서만 유지되며 새로고침하면 사라집니다.</span><Link href="/preview/pdf-fields" target="_blank" rel="noopener noreferrer">기존 3단계 테스트 별도 열기 ↗</Link></aside>
    <section className={styles.stats} aria-label="전체 가상 요청 현황">{[{label:'전체 서명 요청',value:counts.total,hint:'미발송 준비 건 포함'},{label:'서명 대기',value:counts.pending,hint:'가상 발송 이력 기준'},{label:'서명 완료',value:counts.completed,hint:'가상 상태 · 실제 PDF 없음'},{label:'미발송',value:counts.unsent,hint:'링크·문자 발급 전'}].map(item=><article key={item.label}><span>{item.label}</span><strong>{item.value}<small>건</small></strong><p>{item.hint}</p></article>)}</section>
    <p className={styles.muted}>대시보드는 필터와 관계없이 전체 가상 이력 {counts.total}건 기준입니다.</p>
    <nav className={styles.tabs} aria-label="관리 화면 선택"><button aria-pressed={tab==='targets'} onClick={()=>setTab('targets')}>합격자 요청 준비 · 6단계</button><button aria-pressed={tab==='requests'} onClick={()=>setTab('requests')}>참가자별 서명 현황</button><button aria-pressed={tab==='templates'} onClick={()=>setTab('templates')}>서류 템플릿 {templates.length}개</button></nav>
    <p role="status" aria-live="polite" className={styles.notice}>{notice}</p>
    <div hidden={tab!=='targets'}><SigningTargetPreview templates={templates}/></div>
    {tab==='targets' ? null : tab==='templates' ? <>
      <section className={styles.panel}><div className={styles.sectionHeading}><div><h2>서류 템플릿</h2><p>가상 템플릿은 원본 없이 제공됩니다. 직접 선택한 PDF만 미리볼 수 있습니다.</p></div><span>{templates.length}개 등록</span></div>
        <div className={styles.upload}><label>새 서류 이름<input maxLength={100} placeholder="예: 활동 동의서 (테스트용)" value={newName} disabled={busy} onChange={e=>setNewName(e.target.value)}/></label><label className={styles.fileLabel}>PDF 선택하여 등록<input type="file" accept=".pdf,application/pdf" disabled={busy} onChange={e=>{const file=e.target.files?.[0];e.target.value='';void upload(file);}}/></label><p>5MiB 이하 · 50페이지 · 서버 업로드 없음</p></div>
        {!templates.length && <p className={styles.empty}>등록된 템플릿이 없습니다. PDF를 선택해 새로 등록하세요.</p>}
        <div className={styles.templateGrid}>{templates.map(template=><article key={template.id} className={styles.templateCard}><div className={styles.cardTop}><span>{template.origin==='fixture'?'가상 메타데이터':'이 탭의 PDF'}</span><small>v{template.revision}</small></div><h3>{template.name}</h3><p>{templateReadiness(template)}</p><p className={styles.muted}>{template.original?`${template.original.filename} · ${(template.original.bytes/1024/1024).toFixed(2)}MiB`:'원본 파일 없음 · PDF 자동 생성 안 함'}</p><p className={styles.muted}>수정 {date(template.updatedAt)}</p><div className={styles.actions}><button disabled={busy} onClick={()=>{setEditing(template.id);setDeleting('');}}>이름·설정 편집</button><button disabled={busy || !availableSources.has(template.id)} onClick={()=>setEditing(template.id)}>원본 PDF 미리보기</button><button disabled={busy} onClick={()=>{setTab('requests');changeFilter({templateId:template.id,eventId:'',status:'',name:''});}}>서명 이력 {requests.filter(r=>r.templateId===template.id).length}건</button></div><label className={styles.replaceLabel}>{template.original?'원본 PDF 교체 (필드 초기화)':'원본 PDF 선택'}<input type="file" accept=".pdf,application/pdf" disabled={busy} onChange={e=>{const file=e.target.files?.[0];e.target.value='';void upload(file,template);}}/></label>{deleting===template.id?<div className={styles.deleteConfirm}><p>이 탭에서 템플릿을 삭제할까요? 요청 당시 이력은 보존됩니다. 로컬 원본·설정은 다시 등록해야 합니다.</p><button disabled={busy} onClick={()=>removeTemplate(template.id)}>이 탭에서 삭제 확인</button><button onClick={()=>setDeleting('')}>취소</button></div>:<button className={styles.danger} disabled={busy} onClick={()=>setDeleting(template.id)}>템플릿 삭제</button>}</article>)}</div>
      </section>
      {currentTemplate && <TemplateWorkspace key={`${currentTemplate.id}:${availableSources.get(currentTemplate.id)?.sessionKey ?? 'no-pdf'}`} template={currentTemplate} source={availableSources.get(currentTemplate.id)} onSave={save} onClose={()=>setEditing('')}/>}
    </> : <>
      <section className={styles.panel}><div className={styles.sectionHeading}><div><h2>참가자별 서명 현황</h2><p>서류명과 버전은 요청 당시의 가상 스냅샷입니다. 표의 완료 상태는 실제 완료 증명이 아닙니다.</p></div><strong>{visible.length} / {requests.length}건</strong></div>
        <div className={styles.filters}><label>이벤트<select value={filter.eventId} onChange={e=>changeFilter({eventId:e.target.value})}><option value="">전체 이벤트</option>{eventOptions.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label><label>서명 상태<select value={filter.status} onChange={e=>changeFilter({status:e.target.value})}><option value="">전체 상태</option>{Object.entries(signatureStatuses).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label><label>서류<select value={filter.templateId} onChange={e=>changeFilter({templateId:e.target.value})}><option value="">전체 서류</option>{templateOptions.map(([id,name])=><option key={id} value={id}>{name}{templates.some(t=>t.id===id)?'':' (목록에서 삭제됨)'}</option>)}</select></label><label>참가자 이름 검색<input placeholder="가상 참가자 이름" maxLength={100} value={filter.name} onChange={e=>changeFilter({name:e.target.value})}/></label><button onClick={()=>{setFilter({eventId:'',status:'',name:'',templateId:''});setSelection([]);setDetail(null);}}>필터 초기화</button></div>
        <div className={styles.tableScroll}><table><caption>가상 참가자 서명 요청 목록</caption><thead><tr><th><input type="checkbox" aria-label="현재 조회 결과 전체 선택" disabled={!visible.length} checked={visible.length>0&&visible.every(r=>selection.includes(r.id))} onChange={e=>setSelection(ids=>toggleVisibleSelection(ids,visible,e.target.checked))}/></th>{['이벤트명','참가자 이름','서류명 · 요청 당시','가상 요청일','가상 완료일','서명 상태','관리'].map(label=><th key={label}>{label}</th>)}</tr></thead><tbody>{visible.map(row=><tr key={row.id}><td><input type="checkbox" aria-label={`${row.participantName} 선택`} checked={selection.includes(row.id)} onChange={e=>setSelection(ids=>e.target.checked?[...new Set([...ids,row.id])]:ids.filter(id=>id!==row.id))}/></td><td>{row.eventName}</td><td><strong>{row.participantName}</strong><small className={styles.rowMeta}>가상 참가자 · 개인정보 없음</small></td><td>{row.templateName}<small className={styles.rowMeta}>v{row.templateRevision}</small></td><td>{date(row.requestedAt)}</td><td>{date(row.completedAt)}</td><td><Status row={row}/></td><td><button aria-label={`${row.participantName} 상세보기`} onClick={()=>setDetail(row)}>상세보기</button><button disabled title="저장된 실제 PDF가 없습니다.">PDF 다운로드</button></td></tr>)}</tbody></table>{!visible.length&&<p className={styles.empty}>조건에 맞는 가상 이력이 없습니다.</p>}</div>
      </section>
      {detail && <RequestDetail row={detail} onClose={()=>setDetail(null)}/>}
      <section className={styles.panel} aria-label="문자 발송 준비"><div className={styles.sectionHeading}><div><h2>서명 요청 문자 준비</h2><p>조회 결과의 참가자를 선택해 개인별 문구를 확인하세요. 필터 변경 시 선택이 해제됩니다.</p></div><strong>{selected.length}명 선택</strong></div>
        {!selected.length?<p className={styles.empty}>표에서 참가자를 개별 또는 일괄 선택하세요.</p>:<div className={styles.messageGrid}><div><h3>선택 참가자</h3><ul className={styles.recipientList}>{selected.map(row=><li key={row.id}><button aria-pressed={selectedMessage?.id===row.id} onClick={()=>setMessageId(row.id)}>{row.participantName}</button><span>{signatureStatuses[row.status]} · 가상</span></li>)}</ul><p className={styles.muted}>완료·거절 등 재안내 여부는 실제 연동 시 서버에서 검증해야 합니다.</p></div><div><h3>개인별 문자 미리보기</h3><pre className={styles.messagePreview}>{selectedMessage?requestMessage(selectedMessage):''}</pre><label>개인별 서명 링크<input readOnly value="미발급 — 실제 링크 발급 기능 연동 전"/></label><p className={styles.muted}>표시된 토큰은 자리 표시자이며 클릭할 수 있는 링크가 아닙니다.</p></div></div>}
        <div className={styles.actions}><button disabled>선택 대상 문자 발송 · 미연동</button><button disabled>재발송 · 미연동</button><button disabled>개인별 링크 발급 · 미연동</button><button disabled>본인 인증 · 미연동</button><button disabled={!selection.length} onClick={()=>setSelection([])}>선택 해제</button></div>
      </section>
    </>}
  </main>;
}
