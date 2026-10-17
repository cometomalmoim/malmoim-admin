'use client';
import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { PdfPageInfo } from '@/lib/pdf-fields';
import styles from './pdf-field-editor.module.css';

export function PdfCanvas({ pdf, page, scale, onReady }: { pdf: PDFDocumentProxy; page: PdfPageInfo; scale: number; onReady?: (ok: boolean) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState('페이지 렌더링 중…');
  useEffect(() => {
    let disposed = false;
    let render: ReturnType<Awaited<ReturnType<PDFDocumentProxy['getPage']>>['render']> | undefined;
    void (async () => {
      try {
        const source = await pdf.getPage(page.pageNumber);
        if (disposed || !canvas.current) return;
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        const density = Math.min(scale * ratio, Math.sqrt(8000000 / (page.width * page.height)));
        const viewport = source.getViewport({ scale: density });
        const element = canvas.current;
        element.width = Math.ceil(viewport.width); element.height = Math.ceil(viewport.height);
        render = source.render({ canvas: element, viewport, background: '#ffffff' });
        await render.promise;
        if (!disposed) { setStatus(''); onReady?.(true); }
      } catch {
        if (!disposed) { setStatus('이 페이지를 표시하지 못했습니다. 다른 PDF로 다시 시도해주세요.'); onReady?.(false); }
      }
    })();
    return () => { disposed = true; render?.cancel(); };
  }, [pdf, page, scale, onReady]);
  return <><canvas ref={canvas} aria-label={`${page.pageNumber}페이지 PDF 미리보기`} style={{ width: '100%', height: '100%', visibility: status ? 'hidden' : 'visible' }} />{status && <span className={styles.canvasStatus} role="status">{status}</span>}</>;
}

