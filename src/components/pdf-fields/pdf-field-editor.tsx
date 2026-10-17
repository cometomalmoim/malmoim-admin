'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { constrainRect, fieldLimits, fieldKind, fieldLabels, parseSettings, toDisplay, toPdf, type PdfField, type PdfFieldSettings, type PdfPageInfo, type PdfFieldKind, type Rect } from '@/lib/pdf-fields';
import styles from './pdf-field-editor.module.css';
import { PdfCanvas } from './pdf-canvas';
import { PdfSigningPreview } from './pdf-signing-preview';
import { activityFields, activityPdfSha256 } from '@/lib/pdf-signing';

type Loaded = { bytes: Uint8Array; pdf: PDFDocumentProxy; fingerprint: string; name: string; pages: PdfPageInfo[] };
type Gesture = { pointer: number; id: string; mode: 'draw' | 'move' | 'resize'; start: { x: number; y: number }; original: Rect; before: PdfField[] };
type Props = { initialSettings?: PdfFieldSettings; rendererAssetBase?: string };


export function PdfFieldEditor({ initialSettings, rendererAssetBase = '/preview/pdf-fields/assets' }: Props) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [fields, setFields] = useState<PdfField[]>([]);
  const [pageNumber, setPageNumber] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [selected, setSelected] = useState('');
  const [drawing, setDrawing] = useState(false);
  const [kind, setKind] = useState<PdfFieldKind>('signature');
  const [participantMode, setParticipantMode] = useState(false);
  const [result, setResult] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('PDF를 선택하면 브라우저 안에서만 처리합니다.');
  const [importText, setImportText] = useState('');
  const [ready, setReady] = useState('');
  const generation = useRef(0);
  const active = useRef<{ destroy: () => Promise<void> } | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const surface = useRef<HTMLDivElement>(null);
  useEffect(() => () => { generation.current++; void active.current?.destroy(); }, []);

  const page = loaded?.pages[pageNumber - 1];
  const token = `${loaded?.fingerprint}:${pageNumber}:${zoom}`;
  const onReady = useCallback((ok: boolean) => setReady(ok ? token : ''), [token]);
  const editable = !busy && !result && ready === token;
  const visible = fields.filter(f => f.pageNumber === pageNumber);
  const current = fields.find(f => f.id === selected);
  const settings = useMemo<PdfFieldSettings | null>(() => loaded ? ({ version: 1, fingerprint: loaded.fingerprint, pages: loaded.pages, fields }) : null, [loaded, fields]);

  async function openFile(file?: File) {
    if (!file) return;
    const request = ++generation.current;
    gesture.current = null;
    const previous = active.current; active.current = null;
    setParticipantMode(false); setLoaded(null); setFields([]); setSelected(''); setReady(''); setBusy(true); setResult(false); setDrawing(false); setImportText('');
    setMessage('파일 형식과 PDF 구조를 검사하는 중입니다…');
    let task: { destroy: () => Promise<void> } | undefined;
    try {
      await previous?.destroy();
      if (file.size < 1 || file.size > fieldLimits.bytes) throw new Error('PDF는 0바이트보다 크고 5MiB 이하여야 합니다.');
      const bytes = new Uint8Array(await file.arrayBuffer());
      const { validateFieldPdf } = await import('@/lib/pdf-fields-validation');
      await validateFieldPdf(file.name, file.type, bytes);
      const digest = await crypto.subtle.digest('SHA-256', bytes.slice().buffer);
      const fingerprint = Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, '0')).join('');
      if (request !== generation.current) return;
      const pdfjs = await import('pdfjs-dist');
      if (request !== generation.current) return;
      // Never use CDN resources or pass a document URL. Only in-memory bytes.
      const base = new URL(rendererAssetBase.replace(/\/$/, '') + '/', window.location.origin);
      if (base.origin !== window.location.origin) throw new Error('PDF 리소스는 같은 출처에서만 불러올 수 있습니다.');
      pdfjs.GlobalWorkerOptions.workerSrc = new URL('build/pdf.worker.min.mjs', base).href;
      const loading = pdfjs.getDocument({ data: bytes.slice(), enableXfa: false, stopAtErrors: true, useWorkerFetch: false, canvasMaxAreaInBytes: 32000000,
        cMapUrl: new URL('cmaps/', base).href, cMapPacked: true, standardFontDataUrl: new URL('standard_fonts/', base).href,
        wasmUrl: new URL('wasm/', base).href, useSystemFonts: true });
      task = loading; active.current = loading;
      const pdf = await loading.promise;
      if (pdf.numPages > fieldLimits.pages) throw new Error('최대 50페이지까지 지원합니다.');
      const pages: PdfPageInfo[] = [];
      for (let n = 1; n <= pdf.numPages; n++) {
        const source = await pdf.getPage(n), viewport = source.getViewport({ scale: 1 });
        if (![viewport.width, viewport.height, source.userUnit, ...viewport.transform, ...source.view].every(Number.isFinite) || viewport.width < 1 || viewport.height < 1 || viewport.width > 20000 || viewport.height > 20000) throw new Error('페이지 크기가 지원 범위를 벗어났습니다.');
        pages.push({ pageNumber: n, viewBox: [...source.view], rotation: viewport.rotation, userUnit: source.userUnit, width: viewport.width, height: viewport.height, transform: [...viewport.transform] as PdfPageInfo['transform'] });
      }
      if (request !== generation.current) { await task.destroy(); return; }
      const initial = initialSettings ? parseSettings(JSON.stringify(initialSettings), fingerprint, pages) : [];
      setLoaded({ bytes, pdf, fingerprint, name: file.name, pages }); setFields(initial); setPageNumber(1); setZoom(1);
      setMessage(`${pages.length}페이지를 불러왔습니다. ‘서명란 그리기’를 누른 뒤 PDF 위를 드래그하세요.`);
    } catch (error) {
      await task?.destroy();
      if (request === generation.current) { active.current = null; setMessage(error instanceof Error ? error.message : 'PDF를 읽지 못했습니다.'); }
    } finally { if (request === generation.current) setBusy(false); }
  }
  function changePage(n: number) { gesture.current = null; setPageNumber(n); setSelected(''); }
  function position(event: ReactPointerEvent): { x: number; y: number } {
    const box = surface.current!.getBoundingClientRect();
    return { x: Math.max(0, Math.min(1, (event.clientX - box.left) / box.width)), y: Math.max(0, Math.min(1, (event.clientY - box.top) / box.height)) };
  }
  function start(event: ReactPointerEvent<HTMLDivElement>) {
    if (!editable || !page || event.button !== 0 || !event.isPrimary || gesture.current) return;
    const element = (event.target as Element).closest<HTMLElement>('[data-field]');
    const field = element && fields.find(f => f.id === element.dataset.field);
    const point = position(event);
    if (field) {
      setSelected(field.id);
      gesture.current = { pointer: event.pointerId, id: field.id, mode: (event.target as Element).closest('[data-resize]') ? 'resize' : 'move', start: point, original: toDisplay(field.rect, page), before: fields };
    } else if (drawing) {
      if (fields.length >= fieldLimits.fields) { setMessage('서명란은 문서당 최대 200개입니다.'); return; }
      const id = crypto.randomUUID();
      const original = { x: point.x, y: point.y, width: 0, height: 0 };
      gesture.current = { pointer: event.pointerId, id, mode: 'draw', start: point, original, before: fields };
      setFields([...fields, { id, pageNumber, kind, rect: toPdf(original, page) }]); setSelected(id);
    } else { setSelected(''); return; }
    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
  }
  function move(event: ReactPointerEvent<HTMLDivElement>) {
    const g = gesture.current;
    if (!g || g.pointer !== event.pointerId || !page) return;
    const p = position(event), dx = p.x - g.start.x, dy = p.y - g.start.y;
    let next: Rect;
    if (g.mode === 'draw') next = { x: Math.min(p.x, g.start.x), y: Math.min(p.y, g.start.y), width: Math.abs(dx), height: Math.abs(dy) };
    else if (g.mode === 'move') next = constrainRect({ ...g.original, x: g.original.x + dx, y: g.original.y + dy });
    else next = { ...g.original, width: Math.max(.015, Math.min(1 - g.original.x, g.original.width + dx)), height: Math.max(.015, Math.min(1 - g.original.y, g.original.height + dy)) };
    setFields(rows => rows.map(f => f.id === g.id ? { ...f, rect: toPdf(next, page) } : f));
  }
  function finish(event: ReactPointerEvent<HTMLDivElement>, cancel = false) {
    const g = gesture.current;
    if (!g || g.pointer !== event.pointerId || !page) return;
    gesture.current = null;
    if (cancel) { setFields(g.before); setSelected(''); }
    else if (g.mode === 'draw') {
      setFields(rows => rows.filter(f => { if (f.id !== g.id) return true; const r = toDisplay(f.rect, page); return r.width >= .015 && r.height >= .015; }));
      setDrawing(false); setMessage('서명란을 추가했습니다. 너무 작은 드래그는 무시합니다.');
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function update(rect: Rect) { if (page && current) setFields(rows => rows.map(f => f.id === current.id ? { ...f, rect: toPdf(constrainRect(rect), page) } : f)); }
  function remove(id: string) { setFields(rows => rows.filter(f => f.id !== id)); setSelected(''); }
  const percent = (v: number) => `${v * 100}%`;
  if (participantMode && loaded && settings) return <PdfSigningPreview source={loaded} settings={settings} rendererAssetBase={rendererAssetBase} onBack={() => setParticipantMode(false)} />;
  return <main className={styles.editor}>
    <header className={styles.header}><div><p className={styles.eyebrow}>PDF DOCUMENT STUDIO · STEP 03</p><h1>PDF 필드·전자서명 테스트</h1><p>문서를 확인하고 필요한 위치에 서명란을 배치하세요.</p></div><span className={styles.badge}>브라우저 전용 미리보기</span></header>
    <aside className={styles.notice}>PDF와 설정은 이 탭의 메모리에서만 처리합니다. 서버·Storage 업로드와 영구 저장은 하지 않으며, 새 파일 선택·새로고침·탭 종료 시 사라집니다.</aside>
    <section className={styles.upload}><label>PDF 선택<input type="file" accept=".pdf,application/pdf" disabled={busy} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; void openFile(file); }} /></label><span>최대 5MiB · 50페이지 · 문서당 서명란 200개<br />암호화·손상·실행 콘텐츠가 있는 PDF는 사용할 수 없습니다.</span></section>
    <p className={styles.message} role="status" aria-live="polite">{message}</p>
    {!loaded || !page ? <section className={styles.empty}><span aria-hidden="true">▤</span><h2>{busy ? '문서를 검사하고 있습니다' : 'PDF를 선택해 시작하세요'}</h2><p>여러 페이지와 회전된 문서도 페이지별로 편집할 수 있습니다.</p></section> : <>
      <div className={styles.toolbar}><strong className={styles.filename}>{loaded.name}</strong><div><button disabled={pageNumber === 1} onClick={() => changePage(pageNumber - 1)}>이전</button><label>페이지 <select value={pageNumber} onChange={e => changePage(Number(e.target.value))}>{loaded.pages.map(p => <option key={p.pageNumber}>{p.pageNumber}</option>)}</select> / {loaded.pages.length}</label><button disabled={pageNumber === loaded.pages.length} onClick={() => changePage(pageNumber + 1)}>다음</button></div><div><button aria-label="축소" disabled={zoom <= .5} onClick={() => setZoom(z => Math.max(.5, z - .25))}>−</button><output>{Math.round(zoom * 100)}%</output><button aria-label="확대" disabled={zoom >= 2} onClick={() => setZoom(z => Math.min(2, z + .25))}>＋</button><button onClick={() => { const available = (surface.current?.parentElement?.clientWidth ?? 700) - 64; setZoom(Math.min(2, Math.max(.5, available / page.width))); }}>폭 맞춤</button></div></div>
      <div className={styles.workspace}>
        <nav className={styles.pages} aria-label="전체 PDF 페이지">{loaded.pages.map(p => <button key={`${loaded.fingerprint}:${p.pageNumber}`} aria-current={p.pageNumber === pageNumber ? 'page' : undefined} onClick={() => changePage(p.pageNumber)}><span className={styles.thumbnail} style={{ aspectRatio: `${p.width}/${p.height}` }}><PdfCanvas pdf={loaded.pdf} page={p} scale={110 / p.width} /></span><span>{p.pageNumber}페이지 · {fields.filter(f => f.pageNumber === p.pageNumber).length}개</span></button>)}</nav>
        <section className={styles.document}><div className={styles.mode}><label>필드 종류 <select aria-label="새 필드 종류" value={kind} onChange={e => setKind(e.target.value as PdfFieldKind)}><option value="signature">서명 Signature</option><option value="name">이름 Name</option><option value="date">날짜 Date</option></select></label><button disabled={!editable} aria-pressed={drawing} onClick={() => { setDrawing(v => !v); setMessage('PDF의 빈 영역에서 드래그해 서명란을 그리세요.'); }}>{drawing ? '그리기 취소' : `＋ ${fieldLabels[kind]} 필드 그리기`}</button><button aria-pressed={result} onClick={() => { gesture.current = null; setResult(v => !v); setDrawing(false); }}>{result ? '편집으로 돌아가기' : '배치 결과 확인'}</button><span>{page.rotation}° · {Math.round(page.width)} × {Math.round(page.height)} 표시 단위</span></div>
          <div className={styles.scroll}><div key={token} ref={surface} className={`${styles.surface} ${drawing && editable ? styles.draw : ''}`} style={{ width: page.width * zoom, height: page.height * zoom }} onPointerDown={start} onPointerMove={move} onPointerUp={e => finish(e)} onPointerCancel={e => finish(e, true)} onLostPointerCapture={e => finish(e, true)}>
            <PdfCanvas key={token} pdf={loaded.pdf} page={page} scale={zoom} onReady={onReady} />
            {ready === token && visible.map((field, i) => { const r = toDisplay(field.rect, page); return <div key={field.id} data-field={field.id} tabIndex={result ? -1 : 0} role="button" aria-label={`서명란 ${i + 1}, 방향키로 이동, Shift와 방향키로 크기 조절, Delete로 삭제`} aria-pressed={!result && selected === field.id} className={`${styles.field} ${!result && selected === field.id ? styles.selected : ''} ${result ? styles.result : ''}`} style={{ left: percent(r.x), top: percent(r.y), width: percent(r.width), height: percent(r.height) }} onFocus={() => { if (!result) setSelected(field.id); }} onKeyDown={e => {
              if (!editable) return;
              if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); remove(field.id); return; }
              const delta: Record<string, [number, number]> = { ArrowLeft: [-.005, 0], ArrowRight: [.005, 0], ArrowUp: [0, -.005], ArrowDown: [0, .005] };
              if (delta[e.key]) { e.preventDefault(); const [dx, dy] = delta[e.key]; const next = e.shiftKey ? constrainRect({ ...r, width: Math.min(1 - r.x, r.width + dx), height: Math.min(1 - r.y, r.height + dy) }) : constrainRect({ ...r, x: r.x + dx, y: r.y + dy }); setFields(rows => rows.map(f => f.id === field.id ? { ...f, rect: toPdf(next, page) } : f)); }
            }}><span>{fieldLabels[fieldKind(field)]} {i + 1}</span>{!result && <span data-resize className={styles.resize} aria-hidden="true">◢</span>}</div>; })}
          </div></div>
        </section>
        <aside className={styles.inspector}><h2>필드 설정</h2><p>전체 {fields.length}개 · 이 페이지 {visible.length}개</p><button disabled={!editable || fields.length >= fieldLimits.fields} onClick={() => { const id = crypto.randomUUID(); setFields(rows => [...rows, { id, pageNumber, kind, rect: toPdf({ x: .3, y: .4, width: .3, height: .08 }, page) }]); setSelected(id); }}>기본 필드 추가</button>
          <ul className={styles.fieldList}>{visible.map((field, i) => <li key={field.id}><button disabled={result} aria-pressed={selected === field.id} onClick={() => setSelected(field.id)}>{fieldLabels[fieldKind(field)]} 필드 {i + 1}</button><button disabled={!editable} aria-label={`서명란 ${i + 1} 삭제`} onClick={() => remove(field.id)}>삭제</button></li>)}</ul>
          {current && current.pageNumber === pageNumber && <fieldset disabled={!editable}><legend>선택한 필드</legend><label>종류<select aria-label="선택한 필드 종류" value={fieldKind(current)} onChange={e => setFields(rows => rows.map(f => f.id === current.id ? { ...f, kind: e.target.value as PdfFieldKind } : f))}><option value="signature">서명</option><option value="name">이름</option><option value="date">날짜</option></select></label>{(['x', 'y', 'width', 'height'] as const).map(key => { const r = toDisplay(current.rect, page); return <label key={key}>{{ x: '왼쪽', y: '위쪽', width: '너비', height: '높이' }[key]} (%)<input type="number" min={key === 'width' || key === 'height' ? 1.5 : 0} max={100} step={.5} value={Number((r[key] * 100).toFixed(2))} onChange={e => { if (e.target.value !== '' && Number.isFinite(e.target.valueAsNumber)) update({ ...r, [key]: e.target.valueAsNumber / 100 }); }} /></label>; })}<button onClick={() => remove(current.id)}>선택한 서명란 삭제</button></fieldset>}
          <p className={styles.hint}>서명란을 드래그해 이동하고 오른쪽 아래 모서리로 크기를 바꾸세요. 키보드 방향키는 이동, Shift+방향키는 크기 조절입니다.</p><p className={styles.hint}>배치 결과는 빈 서명란의 위치 확인용입니다. 아래 참가자 테스트에서 이름·날짜와 동일한 서명을 모든 지정 필드에 적용합니다.</p>
        </aside>
      </div>
      <section className={styles.settings}><h2>참가자 모바일 테스트</h2><p>가상 이름 ‘테스트 참가자’를 사용합니다. 촬영·홍보는 별도 선택하며 실제 제출·저장은 하지 않습니다.</p>{loaded.fingerprint === activityPdfSha256 && <button disabled={!editable} onClick={() => { setFields(activityFields(loaded.fingerprint)); setSelected(''); setMessage('첨부 활동 동의서의 이름·서명·날짜 기본 배치를 적용했습니다. 직접 수정할 수 있습니다.'); }}>활동 동의서 기본 배치 적용</button>} <button disabled={busy || !['name','date','signature'].every(k => fields.some(f => fieldKind(f) === k))} onClick={() => { gesture.current = null; setParticipantMode(true); }}>참가자 서명 화면 열기</button><p>이름·날짜·서명 필드를 각각 한 개 이상 지정하면 열 수 있습니다. 다른 PDF에도 동일한 방식으로 배치할 수 있습니다.</p></section>
      <section className={styles.settings}><h2>페이지별 배치 데이터</h2><p>PDF 원본 좌표 · 회전 · 보이는 페이지 영역 · 문서 SHA-256을 포함합니다. 화면 확대율은 저장 좌표에 영향을 주지 않습니다.</p><details><summary>현재 설정 JSON 확인</summary><pre>{JSON.stringify(settings, null, 2)}</pre></details><details><summary>기존 설정 불러오기·수정</summary><label>현재 PDF에서 만든 설정 JSON<textarea rows={8} maxLength={fieldLimits.json} value={importText} onChange={e => setImportText(e.target.value)} placeholder="위 설정 JSON을 복사해 붙여넣으세요. 영구 저장하지 않습니다." /></label><button disabled={!editable} onClick={() => { try { const next = parseSettings(importText, loaded.fingerprint, loaded.pages); setFields(next); setSelected(''); setMessage(`${next.length}개의 기존 서명란을 불러왔습니다.`); } catch (error) { setMessage(error instanceof Error ? error.message : '설정을 확인해주세요.'); } }}>설정 검증 후 적용</button></details></section>
    </>}
  </main>;
}
