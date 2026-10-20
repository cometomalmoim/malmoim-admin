'use client';

import { useCallback, useRef, useState, type PointerEvent } from 'react';
import { constrainRect, fieldKind, fieldLabels, fieldLimits, parseSettings, toDisplay, toPdf, type PdfField, type PdfFieldKind, type PdfFieldSettings, type Rect } from '@/lib/pdf-fields';
import { activityFields, activityPdfSha256 } from '@/lib/pdf-signing';
import type { DocumentTemplate } from '@/lib/document-admin-model';
import { PdfCanvas } from '@/components/pdf-fields/pdf-canvas';
import { PdfSigningPreview } from '@/components/pdf-fields/pdf-signing-preview';
import type { LocalPdf } from './local-pdf';
import styles from './document-admin.module.css';

type Gesture = { pointer: number; id: string; mode: 'draw' | 'move' | 'resize'; start: { x: number; y: number }; rect: Rect; before: PdfField[] };
export function TemplateWorkspace({ template, source, onSave, onClose, rendererAssetBase = '/preview/pdf-fields/assets' }: { rendererAssetBase?: string; template: DocumentTemplate; source?: LocalPdf; onSave: (name: string, settings: PdfFieldSettings | null) => void; onClose: () => void }) {
  const [name, setName] = useState(template.name);
  const [fields, setFields] = useState<PdfField[]>(template.settings?.fields ?? []);
  const [kind, setKind] = useState<PdfFieldKind>('signature');
  const [pageNumber, setPageNumber] = useState(1);
  const [zoom, setZoom] = useState(.75);
  const [draw, setDraw] = useState(false);
  const [selected, setSelected] = useState('');
  const [ready, setReady] = useState('');
  const [dragging, setDragging] = useState(false);
  const [participant, setParticipant] = useState(false);
  const [importText, setImportText] = useState('');
  const [message, setMessage] = useState('변경 후 ‘이름·설정 저장’을 눌러 이 탭의 메모리에 반영하세요.');
  const gesture = useRef<Gesture | null>(null), surface = useRef<HTMLDivElement>(null);
  const page = source?.pages[pageNumber - 1], token = `${pageNumber}:${zoom}`;
  const onReady = useCallback((ok: boolean) => setReady(ok ? token : ''), [token]);
  const settings: PdfFieldSettings | null = source ? { version: 1, fingerprint: source.fingerprint, pages: source.pages, fields } : null;
  const current = fields.find(field => field.id === selected), visible = fields.filter(field => field.pageNumber === pageNumber);
  const editable = source && page && ready === token;
  function point(e: PointerEvent) { const r = surface.current!.getBoundingClientRect(); return { x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)) }; }
  function start(e: PointerEvent<HTMLDivElement>) {
    if (!editable || !page || e.button !== 0 || !e.isPrimary || gesture.current) return;
    const element = (e.target as Element).closest<HTMLElement>('[data-field]'), field = element && fields.find(f => f.id === element.dataset.field), start = point(e);
    if (field) { setSelected(field.id); gesture.current = { pointer: e.pointerId, id: field.id, mode: (e.target as Element).closest('[data-resize]') ? 'resize' : 'move', start, rect: toDisplay(field.rect, page), before: fields }; }
    else if (draw) {
      if (fields.length >= fieldLimits.fields) { setMessage('필드는 문서당 최대 200개입니다.'); return; }
      const id = crypto.randomUUID(), rect = { x: start.x, y: start.y, width: 0, height: 0 };
      gesture.current = { pointer: e.pointerId, id, mode: 'draw', start, rect, before: fields }; setFields([...fields, { id, pageNumber, kind, rect: toPdf(rect, page) }]); setSelected(id);
    } else { setSelected(''); return; }
    e.preventDefault(); setDragging(true); e.currentTarget.setPointerCapture(e.pointerId);
  }
  function move(e: PointerEvent<HTMLDivElement>) {
    const g = gesture.current; if (!g || !page || g.pointer !== e.pointerId) return;
    const p = point(e), dx = p.x - g.start.x, dy = p.y - g.start.y;
    const rect = g.mode === 'draw' ? { x: Math.min(g.start.x, p.x), y: Math.min(g.start.y, p.y), width: Math.abs(dx), height: Math.abs(dy) } : g.mode === 'move' ? constrainRect({ ...g.rect, x: g.rect.x + dx, y: g.rect.y + dy }) : { ...g.rect, width: Math.max(.015, Math.min(1 - g.rect.x, g.rect.width + dx)), height: Math.max(.015, Math.min(1 - g.rect.y, g.rect.height + dy)) };
    setFields(rows => rows.map(f => f.id === g.id ? { ...f, rect: toPdf(rect, page) } : f));
  }
  function end(e: PointerEvent<HTMLDivElement>, cancel = false) {
    const g = gesture.current; if (!g || !page || g.pointer !== e.pointerId) return;
    gesture.current = null; setDragging(false);
    if (cancel) setFields(g.before);
    else if (g.mode === 'draw') { setDraw(false); setFields(rows => rows.filter(f => f.id !== g.id || (toDisplay(f.rect, page).width >= .015 && toDisplay(f.rect, page).height >= .015))); }
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  }
  function remove(id: string) { setFields(rows => rows.filter(f => f.id !== id)); setSelected(''); }
  if (participant && source && settings) return <div className={styles.participant}><p className={styles.alert}>별도 3단계 서명 연습입니다. 여기서 PDF를 만들어도 참가자 이력·상태·첨부파일은 변경되지 않습니다.</p><PdfSigningPreview source={source} settings={settings} rendererAssetBase={rendererAssetBase} onBack={() => setParticipant(false)} /></div>;
  return <section className={styles.workspace} aria-label="서류 템플릿 편집"><div className={styles.sectionHeading}><div><h2>서류 이름·PDF·필드 설정</h2><p>현재 저장 버전 v{template.revision} · 원본 파일과 설정은 브라우저 메모리에만 보관합니다.</p></div><button disabled={dragging} onClick={onClose}>편집 닫기</button></div>
    <div className={styles.editHeader}><label>서류 이름<input maxLength={100} value={name} onChange={e => setName(e.target.value)} /></label><button className={styles.primary} disabled={dragging} onClick={() => { try { onSave(name, settings); setMessage('이름·설정을 이 탭의 메모리에 저장했습니다.'); } catch (error) { setMessage(error instanceof Error ? error.message : '설정을 확인해주세요.'); } }}>이름·설정 저장</button></div>
    <p role="status">{message}</p>
    {!source || !page ? <div className={styles.empty}>이 가상 템플릿에는 원본 PDF가 없습니다. 목록의 ‘원본 PDF 선택’으로 파일을 연결한 뒤 위치를 편집하세요.</div> : <>
      <div className={styles.editorToolbar}><label>페이지<select value={pageNumber} disabled={dragging} onChange={e => { setPageNumber(Number(e.target.value)); setSelected(''); }}>{source.pages.map(p => <option key={p.pageNumber} value={p.pageNumber}>{p.pageNumber} / {source.pages.length}</option>)}</select></label><div className={styles.zoomControls}><button disabled={dragging || zoom <= .5} onClick={() => setZoom(v => Math.max(.5,v - .25))}>축소</button><output>{Math.round(zoom * 100)}%</output><button disabled={dragging || zoom >= 2} onClick={() => setZoom(v => Math.min(2,v + .25))}>확대</button></div><label>새 필드<select value={kind} disabled={dragging} onChange={e => setKind(e.target.value as PdfFieldKind)}>{Object.entries(fieldLabels).map(([id,label]) => <option key={id} value={id}>{label}</option>)}</select></label><div className={styles.fieldActions}><button aria-pressed={draw} disabled={!editable || dragging} onClick={() => setDraw(v => !v)}>{draw ? '그리기 취소' : '필드 그리기'}</button><button disabled={!editable || dragging || fields.length >= fieldLimits.fields} onClick={() => { const id = crypto.randomUUID(); setFields(rows => [...rows,{ id, pageNumber, kind, rect: toPdf({x:.3,y:.4,width:.3,height:.08},page) }]); setSelected(id); }}>기본 위치에 추가</button></div></div>
      <div className={styles.editorGrid}><div className={styles.pdfScroll}><div ref={surface} key={token} className={`${styles.pdfSurface} ${draw ? styles.crosshair : ''}`} style={{width:page.width*zoom,height:page.height*zoom}} onPointerDown={start} onPointerMove={move} onPointerUp={e=>end(e)} onPointerCancel={e=>end(e,true)} onLostPointerCapture={e=>end(e,true)}><PdfCanvas key={token} pdf={source.pdf} page={page} scale={zoom} onReady={onReady}/>{ready === token && visible.map((f,i)=>{const r=toDisplay(f.rect,page);return <div key={f.id} data-field={f.id} tabIndex={0} role="button" aria-label={`${fieldLabels[fieldKind(f)]} 필드 ${i+1}`} className={`${styles.pdfField} ${selected===f.id ? styles.selectedField:''}`} style={{left:`${r.x*100}%`,top:`${r.y*100}%`,width:`${r.width*100}%`,height:`${r.height*100}%`}} onFocus={()=>setSelected(f.id)} onKeyDown={e=>{
        if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();remove(f.id);return;}
        const d:Record<string,[number,number]>={ArrowLeft:[-.005,0],ArrowRight:[.005,0],ArrowUp:[0,-.005],ArrowDown:[0,.005]};if(!d[e.key])return;e.preventDefault();const [dx,dy]=d[e.key];const next=constrainRect(e.shiftKey?{...r,width:Math.min(1-r.x,r.width+dx),height:Math.min(1-r.y,r.height+dy)}:{...r,x:r.x+dx,y:r.y+dy});setFields(rows=>rows.map(field=>field.id===f.id?{...field,rect:toPdf(next,page)}:field));
      }}><span>{fieldLabels[fieldKind(f)]} {i+1}</span><span data-resize className={styles.resize}>◢</span></div>;})}</div></div>
      <aside className={styles.inspector}><h3>필드 {fields.length}개</h3><p>이 페이지 {visible.length}개 · {page.rotation}°</p><p className={styles.muted}>드래그로 이동, 오른쪽 아래로 크기 조절. 방향키로 이동, Shift+방향키로 크기 조절.</p>{visible.map((f,i)=><div className={styles.fieldRow} key={f.id}><button disabled={dragging} aria-pressed={selected===f.id} onClick={()=>setSelected(f.id)}>{fieldLabels[fieldKind(f)]} {i+1}</button><button disabled={dragging} aria-label={`필드 ${i+1} 삭제`} onClick={()=>remove(f.id)}>삭제</button></div>)}{current && <fieldset disabled={!editable || dragging}><legend>선택 필드 수정</legend><label>종류<select value={fieldKind(current)} onChange={e=>setFields(rows=>rows.map(f=>f.id===current.id?{...f,kind:e.target.value as PdfFieldKind}:f))}>{Object.entries(fieldLabels).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>{(['x','y','width','height'] as const).map(key=>{const r=toDisplay(current.rect,page);return <label key={key}>{{x:'왼쪽',y:'위쪽',width:'너비',height:'높이'}[key]} (%)<input type="number" min={key==='width'||key==='height'?1.5:0} max={100} step={.5} value={Number((r[key]*100).toFixed(2))} onChange={e=>{if(e.target.value===''||!Number.isFinite(e.target.valueAsNumber))return;const rect=toPdf(constrainRect({...r,[key]:e.target.valueAsNumber/100}),page);setFields(rows=>rows.map(f=>f.id===current.id?{...f,rect}:f));}}/></label>;})}</fieldset>}</aside></div>
      {source.fingerprint===activityPdfSha256 && <button disabled={dragging} onClick={()=>{setFields(activityFields(source.fingerprint));setSelected('');}}>활동 동의서 기본 배치 적용</button>}
      <details className={styles.settings}><summary>현재 설정 JSON 확인</summary><pre>{JSON.stringify(settings,null,2)}</pre></details><details className={styles.settings}><summary>기존 필드 설정 불러오기</summary><label>같은 PDF의 설정 JSON<textarea rows={5} maxLength={fieldLimits.json} value={importText} onChange={e=>setImportText(e.target.value)}/></label><button disabled={dragging} onClick={()=>{try{setFields(parseSettings(importText,source.fingerprint,source.pages));setSelected('');setMessage('기존 설정을 불러왔습니다. 저장 버튼으로 반영하세요.');}catch(error){setMessage(error instanceof Error?error.message:'설정을 확인해주세요.');}}}>검증 후 불러오기</button></details>
      <button disabled={dragging || !['name','date','signature'].every(k=>fields.some(f=>fieldKind(f)===k))} onClick={()=>setParticipant(true)}>별도 참가자 서명 연습 열기</button><p className={styles.muted}>연습 결과는 관리자 요청 이력에 연결하지 않습니다. 저장하려면 연습 전에 ‘이름·설정 저장’을 누르세요.</p>
    </>}
  </section>;
}
