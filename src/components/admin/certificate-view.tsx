'use client';
import { useEffect, useRef, useState } from 'react';
import { AdminShell } from './admin-shell';
import { attendedFirst, defaultPlacement, demoCandidates, identity, selectCandidates, requireAttended, eligibleSelection, searchCandidates, shortApplicationId, type Candidate, type Placement, type Template } from '@/lib/certificate-model';
import './certificates.css';
import { confirmations, attendances } from '@/lib/participation-validation';
type Issue = { id: string; name: string; event_title: string; event_id: string; source: string; application_id: string; created_at: string; template_id: string };
type Data = { events: { id: string; slug: string; title: string; is_test: boolean }[]; templates: Template[]; candidates: Candidate[]; history: Issue[] };
const empty: Data = { events: [], templates: [], candidates: [], history: [] };
export function CertificateView({ email, enabled = false, preview = false, slug }: { email?: string; enabled?: boolean; preview?: boolean; slug?: string }) {
 const [demo, setDemo] = useState(true), [data, setData] = useState<Data>(empty), [event, setEvent] = useState(''), [template, setTemplate] = useState('');
 const [settings, setSettings] = useState<Placement>(defaultPlacement), [keys, setKeys] = useState<string[]>([]), [name, setName] = useState('홍길동');
 const [title, setTitle] = useState('말모임 수료증'), [file, setFile] = useState<File>(), [url, setUrl] = useState(''), [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [confirmed, setConfirmed] = useState(false);
 const [demoHistory, setDemoHistory] = useState<Issue[]>([]);
 const [search, setSearch] = useState('');
 const urlRef = useRef('');
 useEffect(() => {
  if (preview || demo) return;
  const refresh = () => { if (document.visibilityState === 'visible' && !busy) void load().catch(() => { setKeys([]); setConfirmed(false); }); };
  const timer = setInterval(refresh, 15000);
  window.addEventListener('focus', refresh);
  return () => { clearInterval(timer); window.removeEventListener('focus', refresh); };
  // Refresh the current event when returning to the screen; server/DB remain authoritative.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [preview, demo, event, busy]);
 useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);
 const rows = demo ? attendedFirst(demoCandidates) : data.candidates;
 const visibleRows = searchCandidates(rows, search);
 const attendedCount = rows.filter(row => row.attendance === 'attended').length;
 function show(blob: Blob) { if (urlRef.current) URL.revokeObjectURL(urlRef.current); urlRef.current = URL.createObjectURL(blob); setUrl(urlRef.current); }
 function download(blob: Blob, filename: string) { const link = document.createElement('a'); const u = URL.createObjectURL(blob); link.href = u; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(u), 1000); }
 async function request(body: object | FormData) {
  if (preview) throw new Error('화면 확인 전용 미리보기입니다.');
  const r = await fetch('/api/admin/certificates', { method: 'POST', headers: body instanceof FormData ? undefined : { 'Content-Type': 'application/json' }, body: body instanceof FormData ? body : JSON.stringify(body) });
  if (!r.ok) { const e = await r.json(); throw new Error(e.message); } return r;
 }
 async function load(eventId = event) {
  if (preview) throw new Error('화면 확인 전용 미리보기입니다.');
  const r = await fetch(`/api/admin/certificates?event=${encodeURIComponent(eventId)}`); const d = await r.json(); if (!r.ok) throw new Error(d.message);
  setData(d); setKeys(old => eligibleSelection(d.candidates, old)); setConfirmed(false); return d as Data;
 }
 async function run(task: () => Promise<void>) { setBusy(true); setMessage(''); try { await task(); } catch (e) { setMessage(e instanceof Error ? e.message : '처리 실패'); } finally { setBusy(false); } }
 async function generate(action: 'preview' | 'issue', single = false, reissue?: Issue) {
  if (preview) throw new Error('화면 확인 전용 미리보기입니다.');
  if (demo) {
   const { certificatePdf, certificateZip } = await import('@/lib/certificate-pdf');
   const fontResponse = await fetch('/fonts/NanumGothic-Regular.ttf'); if (!fontResponse.ok) throw new Error('한글 폰트를 읽지 못했습니다.');
   const font = new Uint8Array(await fontResponse.arrayBuffer());
   const background = file ? { bytes: new Uint8Array(await file.arrayBuffer()), mime: file.type } : undefined;
   if (file && (!['application/pdf', 'image/png', 'image/jpeg'].includes(file.type) || file.size > 5242880)) throw new Error('5MB 이하 PDF, PNG, JPG를 선택해주세요.');
   const selected = action === 'preview' ? [{ ...demoCandidates[0], name }] : reissue ? [{ ...demoCandidates[0], ...reissue }] : requireAttended(selectCandidates(rows, keys));
   if (single && selected.length !== 1) throw new Error('개별 PDF는 한 명을 선택해주세요.');
   const files = [];
   for (const p of selected) files.push({ id: `${p.event_id}-${p.source}-${p.application_id}`, bytes: await certificatePdf(p.name, settings, font, background, true) });
   const zip = action !== 'preview' && !single;
   const blob = new Blob([new Uint8Array(zip ? certificateZip(files) : files[0].bytes)], { type: zip ? 'application/zip' : 'application/pdf' });
   if (action === 'preview') show(blob); else { download(blob, `SAMPLE-certificates.${zip ? 'zip' : 'pdf'}`); setDemoHistory(old => [...selected.map(p => ({ ...p, id: crypto.randomUUID(), event_title: '가상 말모임 이벤트', created_at: new Date().toISOString(), template_id: 'demo' })), ...old]); }
   setMessage('가상 처리 완료 · 실제 발급 및 DB 저장 없음'); return;
  }
  if (action === 'issue' && !confirmed) throw new Error('수료 대상자 확인에 체크해주세요.');
  if (single && !reissue && keys.length !== 1) throw new Error('개별 PDF는 한 명을 선택해주세요.');
  const r = await request({ action: reissue ? 'reissue' : action, event, template: reissue?.template_id ?? template, issue: reissue?.id, keys: action === 'preview' ? keys.slice(0, 1) : keys, confirm: confirmed, zip: action !== 'preview' && !single });
  const blob = await r.blob(); if (action === 'preview') show(blob); else { download(blob, `certificates.${single ? 'pdf' : 'zip'}`); await load(); setMessage('PDF 생성 및 발급 기록 저장 완료 · 다운로드 완료 여부는 브라우저에서 확인해주세요.'); }
 }
 return <AdminShell current="certificates" title="수료증 관리" email={email} preview={preview}><div><div className="ops-heading"><h1>수료증 관리</h1><p>원본 디자인을 배경으로 유지하고 이름만 추가합니다.</p></div>
 {preview && <section className="ops-panel cert-panel"><h2>수료증 디자인 예시</h2><p>화면 확인 전용 · 가상 데이터만 표시합니다. 업로드·설정 변경·발급·다운로드는 실행되지 않습니다.</p><div aria-label="가상 수료증 디자인" style={{ border: '3px solid #244b68', background: '#fff', color: '#17344b', padding: '48px 24px', textAlign: 'center' }}><h2 style={{ fontSize: 32 }}>수 료 증</h2><p style={{ margin: '36px 0', fontSize: 30 }}>김민수</p><p>가상 말모임 과정 참여를 확인합니다.</p><small>가상 디자인 · 발급 효력 없음</small></div></section>}
 <section className="ops-panel cert-panel"><div className="cert-actions"><button disabled={preview || busy} onClick={() => { setDemo(true); setKeys([]); setConfirmed(false); setUrl(''); }}>가상 테스트</button><button disabled={!enabled || preview || busy} onClick={() => run(async () => { const d = await load(''); const match = d.events.find(e => e.slug === slug); setDemo(false); setUrl(''); setKeys([]); setConfirmed(false); if (match) { setEvent(match.id); await load(match.id); } })}>실제 발급 모드</button></div><strong>{demo ? '가상 데이터 · 발급 효력 없음 · DB 연결 없음' : '실제 발급 · 관리자 확인 필요'}</strong>{!enabled && <p>실제 발급은 비활성 상태입니다. 전용 DB 설정과 활성화가 필요합니다.</p>}</section>
 <fieldset disabled={preview || busy} className="ops-panel cert-panel"><legend>1. 템플릿과 이름 설정</legend>
 {!demo && <label>저장된 템플릿<select value={template} onChange={e => { setTemplate(e.target.value); setConfirmed(false); const t = data.templates.find(t => t.id === e.target.value); if (t) setSettings(t.placement); }}><option value="">선택하세요</option>{data.templates.map(t => <option key={t.id} value={t.id}>{t.title} · {t.id.slice(0, 8)}</option>)}</select></label>}
 <label>템플릿 제목<input value={title} maxLength={150} onChange={e => setTitle(e.target.value)} /></label><label>PDF / PNG / JPG (5MB 이하)<input type="file" accept="application/pdf,image/png,image/jpeg" onChange={e => setFile(e.target.files?.[0])} /></label>{demo && !file && <p>파일 없이도 기본 가상 수료증을 생성합니다.</p>}
 <div className="cert-grid">{(['x', 'y', 'size'] as const).map(k => <label key={k}>{k === 'x' ? '가로 기준점 (%)' : k === 'y' ? '위에서 이름 기준선까지 (%)' : '글씨 크기 (pt)'}<input type="number" min={k === 'size' ? 8 : 0} max={k === 'size' ? 96 : 100} value={settings[k]} onChange={e => setSettings({ ...settings, [k]: Number(e.target.value) })} /></label>)}<label>정렬<select value={settings.align} onChange={e => setSettings({ ...settings, align: e.target.value as Placement['align'] })}><option value="left">왼쪽</option><option value="center">가운데</option><option value="right">오른쪽</option></select></label></div>
 {demo ? <><label>미리보기 이름<input value={name} maxLength={100} onChange={e => setName(e.target.value)} /></label><button onClick={() => run(async () => { const { placement } = await import('@/lib/certificate-model'); placement(settings); localStorage.setItem('malmoim-certificate-demo', JSON.stringify({ settings, title })); setMessage('가상 설정을 이 브라우저에 저장했습니다. 업로드 파일은 저장하지 않습니다.'); })}>가상 설정 저장</button><button onClick={() => run(async () => { const saved = localStorage.getItem('malmoim-certificate-demo'); if (!saved) throw new Error('저장된 가상 설정이 없습니다.'); const v = JSON.parse(saved); const { placement } = await import('@/lib/certificate-model'); setSettings(placement(v.settings)); setTitle(String(v.title).slice(0, 150)); })}>가상 설정 불러오기</button></> : <div className="cert-actions"><button onClick={() => run(async () => { if (!file) throw new Error('템플릿 파일을 선택해주세요.'); const form = new FormData(); form.set('file', file); form.set('title', title); form.set('placement', JSON.stringify(settings)); const r = await request(form); const result = await r.json(); await load(); setTemplate(result.id); setMessage('템플릿을 등록했습니다.'); })}>새 템플릿 등록</button><button disabled={!template} onClick={() => run(async () => { await request({ action: 'settings', template, placement: settings }); await load(); setMessage('새 버전으로 저장했습니다. 목록에서 새 버전을 선택해주세요.'); })}>설정 수정본 저장</button></div>}
 {!demo && <p>실제 미리보기와 발급은 저장된 템플릿 설정을 사용합니다. 수정 후 저장하고 새 버전을 선택해주세요.</p>}<button onClick={() => run(() => generate('preview'))}>이름 포함 PDF 미리보기{!demo && ' (선택한 첫 대상)'}</button>
 </fieldset>
 {url && <section className="ops-panel"><h2>{demo ? '가상 미리보기' : '발급 전 미리보기 · 발급 기록 없음'}</h2><iframe title="수료증 PDF 미리보기" src={url} className="cert-preview" /></section>}
 <fieldset disabled={busy} className="ops-panel cert-panel"><legend>2. 발급 대상 선택</legend>{!demo && <label>이벤트<select value={event} onChange={e => { const id = e.target.value; setEvent(id); setKeys([]); setConfirmed(false); run(async () => { await load(id); }); }}><option value="">선택하세요</option>{data.events.filter(e => !e.is_test).map(e => <option value={e.id} key={e.id}>{e.title}</option>)}</select></label>}
 <p>출석 완료된 신청자만 선택할 수 있습니다. 합격·입금만으로 수료 처리하지 않습니다. 한 번에 최대 100명</p><div className="cert-counts" role="status"><span>전체 신청자 <strong>{rows.length}명</strong></span><span>출석 완료 · 발급 가능 <strong>{attendedCount}명</strong></span><span>현재 선택 <strong>{keys.length}명</strong></span></div>
 <label>신청자 이름 검색<input type="search" value={search} placeholder="이름 일부를 입력하세요" onChange={e => setSearch(e.target.value)} /></label>{search.trim() && <p>검색 결과 {visibleRows.length}명 · 검색 밖의 선택도 유지됩니다.</p>}
 <div className="cert-actions"><button disabled={preview} onClick={() => { setConfirmed(false); setKeys(rows.filter(r => r.attendance === 'attended').slice(0, 100).map(identity)); }}>전체 출석자 선택 (최대 100명)</button><button disabled={preview} onClick={() => { setConfirmed(false); setKeys([]); }}>선택 해제</button></div>
 <div className="cert-list"><table><thead><tr><th>선택</th><th>이름</th><th>참여 상태</th><th>신청 식별자</th></tr></thead><tbody>{visibleRows.map(r => <tr key={identity(r)}><td><input type="checkbox" aria-label={`${r.name} ${r.source} ${r.application_id} 선택`} disabled={preview || r.attendance !== 'attended'} title={r.attendance !== 'attended' ? '출석 완료된 신청자만 발급 가능합니다.' : undefined} checked={r.attendance === 'attended' && keys.includes(identity(r))} onChange={e => { setConfirmed(false); setKeys(e.target.checked && r.attendance === 'attended' ? [...keys, identity(r)] : keys.filter(k => k !== identity(r))); }} /></td><td>{r.name}</td><td>{attendances[r.attendance as keyof typeof attendances] ?? '미기록'} / {confirmations[r.confirmation as keyof typeof confirmations] ?? '미확정'}</td><td><small>{r.source} / {shortApplicationId(r.application_id)}</small><details className="cert-identity"><summary>전체 식별자 보기</summary><small>이벤트: {r.event_id}<br />신청 경로: {r.source}<br />신청 ID: {r.application_id}</small></details></td></tr>)}</tbody></table>{!visibleRows.length && <p className="notice">검색 결과가 없습니다.</p>}</div>
 <label><input type="checkbox" disabled={preview} checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />선택한 참가자가 수료 대상임을 확인했습니다.</label><div className="cert-actions"><button disabled={preview || !keys.length || (!demo && !confirmed)} onClick={() => run(() => generate('issue', true))}>{demo ? '가상 ' : ''}개별 PDF 다운로드</button><button disabled={preview || !keys.length || (!demo && !confirmed)} onClick={() => run(() => generate('issue'))}>{demo ? '가상 ' : ''}일괄 ZIP 다운로드</button></div></fieldset>
 <section className="ops-panel cert-panel"><h2>{demo ? '가상 처리 기록 (새로고침하면 초기화)' : '발급 기록'}</h2><p>발급 당시 이름과 템플릿 버전을 보존합니다. 실제 재발급은 원래 이름과 원본 템플릿으로 생성합니다.</p>{(demo ? demoHistory : data.history).map(h => <div className="cert-history" key={h.id}><span>{h.name} · {h.event_title} · {new Date(h.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}<small>{h.source} / {h.application_id}</small></span><button disabled={preview || busy || (!demo && !confirmed)} onClick={() => run(() => generate('issue', true, h))}>{demo ? '가상 재생성 (현재 설정)' : '재발급 PDF'}</button></div>)}</section>
 <p role="status" aria-live="polite">{busy ? '처리 중…' : message}</p></div></AdminShell>;
}
