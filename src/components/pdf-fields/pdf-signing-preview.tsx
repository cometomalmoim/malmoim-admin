'use client';

import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { fieldKind, toDisplay, type PdfFieldSettings, type PdfPageInfo } from '@/lib/pdf-fields';
import { consentItems, signingSnapshot, testParticipant, type ConsentAnswers, type Ink, type SigningSnapshot } from '@/lib/pdf-signing';
import { inkPath } from '@/lib/pdf-signing';
import { PdfCanvas } from './pdf-canvas';
import { SignaturePad } from './signature-pad';
import styles from './pdf-signing-preview.module.css';

type Source = { bytes: Uint8Array; pdf: PDFDocumentProxy; pages: PdfPageInfo[]; name: string };
function DocumentPages({ pdf, pages, snapshot }: { pdf: PDFDocumentProxy; pages: PdfPageInfo[]; snapshot?: SigningSnapshot }) {
  return <div className={styles.documentPages}>{pages.map(page => <section key={page.pageNumber} aria-label={`문서 ${page.pageNumber}페이지`}><h3>{page.pageNumber} / {pages.length}페이지</h3><div className={styles.paper} style={{ aspectRatio: `${page.width}/${page.height}` }}>
    <PdfCanvas pdf={pdf} page={page} scale={Math.min(1, 760 / page.width)} />
    {snapshot?.settings.fields.filter(f => f.pageNumber === page.pageNumber).map(field => { const rect = toDisplay(field.rect, page), kind = fieldKind(field); return <div key={field.id} className={styles.overlay} style={{ left: `${rect.x * 100}%`, top: `${rect.y * 100}%`, width: `${rect.width * 100}%`, height: `${rect.height * 100}%` }}>{kind === 'signature' ? <svg viewBox="0 0 900 300" aria-label="작성한 동일 서명"><path d={inkPath(snapshot.ink)} fill="none" stroke="#142b31" strokeWidth="5" strokeLinecap="round" /></svg> : <span>{kind === 'name' ? snapshot.participant.name : snapshot.date}</span>}</div>; })}
  </div></section>)}</div>;
}
function GeneratedDocument({ bytes, assetBase }: { bytes: Uint8Array; assetBase: string }) {
  const [rendered, setRendered] = useState<{ pdf: PDFDocumentProxy; pages: PdfPageInfo[]; url: string } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let disposed = false, url = '';
    let task: { destroy: () => Promise<void> } | undefined;
    void (async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        if (disposed) return;
        const base = new URL(assetBase.replace(/\/$/, '') + '/', location.origin);
        if (base.origin !== location.origin) throw new Error('로컬 렌더링 리소스를 확인해주세요.');
        pdfjs.GlobalWorkerOptions.workerSrc = new URL('build/pdf.worker.min.mjs', base).href;
        const loading = pdfjs.getDocument({ data: bytes.slice(), enableXfa: false, useWorkerFetch: false, stopAtErrors: true, canvasMaxAreaInBytes: 32000000,
          cMapUrl: new URL('cmaps/', base).href, cMapPacked: true, standardFontDataUrl: new URL('standard_fonts/', base).href, wasmUrl: new URL('wasm/', base).href });
        task = loading;
        const pdf = await loading.promise, pages: PdfPageInfo[] = [];
        for (let n = 1; n <= pdf.numPages; n++) { const source = await pdf.getPage(n), vp = source.getViewport({ scale: 1 }); pages.push({ pageNumber: n, viewBox: [...source.view], rotation: vp.rotation, userUnit: source.userUnit, width: vp.width, height: vp.height, transform: [...vp.transform] as PdfPageInfo['transform'] }); }
        if (disposed) return;
        url = URL.createObjectURL(new Blob([bytes.slice().buffer], { type: 'application/pdf' }));
        setRendered({ pdf, pages, url });
      } catch { if (!disposed) setError('생성된 PDF 미리보기를 열지 못했습니다. 수정 후 다시 생성해주세요.'); }
    })();
    return () => { disposed = true; if (url) URL.revokeObjectURL(url); void task?.destroy(); };
  }, [bytes, assetBase]);
  if (error) return <p role="alert">{error}</p>;
  if (!rendered) return <p role="status">완성 PDF를 여는 중입니다…</p>;
  return <><a className={styles.primaryLink} href={rendered.url} download="malmoim-consent-test.pdf">완성된 테스트 PDF 다운로드</a><DocumentPages pdf={rendered.pdf} pages={rendered.pages} /></>;
}

export function PdfSigningPreview({ source, settings, rendererAssetBase, onBack }: { source: Source; settings: PdfFieldSettings; rendererAssetBase: string; onBack: () => void }) {
  const [answers, setAnswers] = useState<ConsentAnswers>({ media: null, rules: false, consequences: false, refund: false });
  const [read, setRead] = useState(false);
  const [ink, setInk] = useState<Ink>([]);
  const [review, setReview] = useState<SigningSnapshot | null>(null);
  const [output, setOutput] = useState<Uint8Array | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  function prepareReview() {
    try { setReview(signingSnapshot(settings, answers, ink, read, new Date().toISOString())); setConfirmed(false); setMessage('항목별 응답과 모든 서명 위치를 확인해주세요. 아직 PDF를 생성하지 않았습니다.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : '입력 내용을 확인해주세요.'); }
  }
  async function generate() {
    if (!review || !confirmed || busy) return;
    setBusy(true); setMessage('브라우저에서 PDF를 생성하는 중입니다…');
    try {
      const fontResponse = await fetch('/fonts/NanumGothic-Regular.ttf', { cache: 'force-cache' });
      if (!fontResponse.ok) throw new Error('한글 폰트를 불러오지 못했습니다. 다시 시도해주세요.');
      const font = new Uint8Array(await fontResponse.arrayBuffer());
      const { signedPreviewPdf } = await import('@/lib/pdf-signing-pdf');
      const bytes = await signedPreviewPdf(source.bytes, review, font);
      if (alive.current) { setOutput(bytes); setMessage('테스트 PDF를 생성했습니다. 원본 뒤에 항목별 응답 확인 페이지가 추가되었습니다. 실제 제출·저장은 하지 않았습니다.'); }
    } catch (error) { if (alive.current) setMessage(error instanceof Error ? error.message : 'PDF 생성에 실패했습니다.'); }
    finally { if (alive.current) setBusy(false); }
  }
  return <main className={styles.signer}>
    <header className={styles.header}><div><p>말모임 · 전자서명 3단계</p><h1>{output ? '테스트 PDF 완성' : review ? '제출 전 최종 확인' : '활동 동의서 확인 및 서명'}</h1></div><button disabled={busy} onClick={onBack}>관리자 필드 편집으로</button></header>
    <aside className={styles.notice}>가상 참가자 전용 테스트입니다. 실제 개인정보·서명을 입력하지 마세요. 서버 전송·실제 제출·영구 저장은 하지 않으며 탭을 닫으면 사라집니다.</aside>
    <p role="status" aria-live="polite" className={styles.message}>{message}</p>
    {output ? <><section className={styles.card}><h2>생성 완료</h2><p>원문과 입력한 이름·서명·날짜를 확인한 뒤 다운로드하세요. 촬영·홍보 동의 여부는 마지막 응답 확인 페이지에 별도로 표시됩니다.</p><button onClick={() => { setOutput(null); setReview(null); setConfirmed(false); setMessage('수정하면 최종 확인과 PDF 생성을 다시 진행해야 합니다.'); }}>응답·서명 수정하기</button></section><GeneratedDocument bytes={output} assetBase={rendererAssetBase} /></> : review ? <>
      <section className={styles.card}><h2>응답 요약</h2><p>이름: <strong>{review.participant.name}</strong></p><p>완료 날짜: {review.date} (한국 시간)</p><p className={styles.hint}>기기 시각 기준 · 최종 확인 시각으로 고정됩니다.</p><ul>{consentItems.map(item => <li key={item.id}>{item.title}: <strong>{item.id === 'media' ? (review.answers.media ? '동의' : '동의하지 않음') : '확인함'}</strong></li>)}</ul><p>아래 모든 서명란에 같은 서명이 적용됩니다. 촬영·홍보는 위 선택 응답으로 별도 관리합니다.</p><p className={styles.hint}>화면 배치는 확인용이며, 생성 후 실제 PDF 미리보기에서 최종 위치를 확인할 수 있습니다.</p></section>
      <DocumentPages pdf={source.pdf} pages={source.pages} snapshot={review} />
      <section className={styles.card}><label className={styles.check}><input type="checkbox" checked={confirmed} disabled={busy} onChange={e => setConfirmed(e.target.checked)} />이름·날짜·서명 위치와 네 항목의 응답을 최종 확인했습니다.</label><div className={styles.actions}><button disabled={busy} onClick={() => { setReview(null); setConfirmed(false); setMessage('입력 내용을 수정한 뒤 다시 최종 확인해주세요.'); }}>다시 작성</button><button className={styles.primary} disabled={!confirmed || busy} onClick={() => void generate()}>{busy ? '생성 중…' : '확인 후 테스트 PDF 생성'}</button></div></section>
    </> : <>
      <section className={styles.card}><h2>1. PDF 원문 확인</h2><p>{source.name} · {source.pages.length}페이지. 모든 페이지를 읽고 아래 항목에 각각 응답해주세요.</p></section>
      <DocumentPages pdf={source.pdf} pages={source.pages} />
      <section className={styles.card}><label className={styles.check}><input type="checkbox" checked={read} onChange={e => setRead(e.target.checked)} />모든 페이지의 PDF 원문을 확인했습니다.</label></section>
      <section className={styles.card}><h2>2. 항목별 응답</h2><p>촬영·홍보는 선택 사항입니다. 동의하지 않아도 나머지 항목 확인과 테스트 PDF 생성을 진행할 수 있습니다.</p>
        {consentItems.map(item => <fieldset key={item.id} className={item.optional ? styles.optional : styles.consent}><legend>{item.title} {item.optional ? '(선택)' : '(확인)'}</legend><p>{item.text}</p>{item.id === 'media' ? <><label className={styles.check}><input type="radio" name="media" checked={answers.media === true} onChange={() => setAnswers(a => ({ ...a, media: true }))} />동의합니다</label><label className={styles.check}><input type="radio" name="media" checked={answers.media === false} onChange={() => setAnswers(a => ({ ...a, media: false }))} />동의하지 않습니다</label></> : <label className={styles.check}><input type="checkbox" checked={answers[item.id]} onChange={e => setAnswers(a => ({ ...a, [item.id]: e.target.checked }))} />이 항목을 확인했습니다</label>}</fieldset>)}
      </section>
      <section className={styles.card}><h2>3. 이름 및 서명</h2><label>신청자 이름 (가상 데이터)<input className={styles.name} readOnly value={testParticipant.name} /></label><p>날짜는 최종 확인 단계에서 한국 시간으로 자동 입력됩니다.</p><SignaturePad value={ink} onChange={setInk} /><p className={styles.hint}>서명은 항목별 응답과 별개로 관리하며, 지정된 모든 서명란에 동일하게 적용합니다.</p><button className={styles.primary} onClick={prepareReview}>서명 제출 전 최종 확인</button></section>
    </>}
  </main>;
}
