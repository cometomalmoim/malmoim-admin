import type { PDFDocumentProxy } from 'pdfjs-dist';
import { fieldLimits, type PdfPageInfo } from '@/lib/pdf-fields';
import { validateFieldPdf } from '@/lib/pdf-fields-validation';

export type LocalPdf = { sessionKey: string; bytes: Uint8Array; pdf: PDFDocumentProxy; pages: PdfPageInfo[]; fingerprint: string; name: string; destroy: () => Promise<void> };
export async function openLocalPdf(file: File, assetBase = '/preview/pdf-fields/assets'): Promise<LocalPdf> {
  if (file.size < 1 || file.size > fieldLimits.bytes) throw new Error('PDF는 0바이트보다 크고 5MiB 이하여야 합니다.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  await validateFieldPdf(file.name, file.type, bytes);
  const digest = await crypto.subtle.digest('SHA-256', bytes.slice().buffer);
  const fingerprint = Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, '0')).join('');
  const pdfjs = await import('pdfjs-dist');
  const base = new URL(assetBase.replace(/\/$/, '') + '/', location.origin);
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('build/pdf.worker.min.mjs', base).href;
  const task = pdfjs.getDocument({ data: bytes.slice(), enableXfa: false, useWorkerFetch: false, stopAtErrors: true, canvasMaxAreaInBytes: 32000000,
    cMapUrl: new URL('cmaps/', base).href, cMapPacked: true, standardFontDataUrl: new URL('standard_fonts/', base).href, wasmUrl: new URL('wasm/', base).href, useSystemFonts: true });
  try {
    const pdf = await task.promise, pages: PdfPageInfo[] = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const source = await pdf.getPage(n), viewport = source.getViewport({ scale: 1 });
      if (![viewport.width, viewport.height, source.userUnit, ...viewport.transform, ...source.view].every(Number.isFinite) || viewport.width < 1 || viewport.height < 1 || viewport.width > 20000 || viewport.height > 20000) throw new Error('페이지 크기가 지원 범위를 벗어났습니다.');
      pages.push({ pageNumber: n, viewBox: [...source.view], rotation: viewport.rotation, userUnit: source.userUnit, width: viewport.width, height: viewport.height, transform: [...viewport.transform] as PdfPageInfo['transform'] });
    }
    return { sessionKey: crypto.randomUUID(), bytes, pdf, pages, fingerprint, name: file.name, destroy: () => task.destroy() };
  } catch (error) { await task.destroy(); throw error; }
}
