import { PDFDocument } from 'pdf-lib';
import { pdfStructure } from './pdf-validation.ts';
import { fieldLimits } from './pdf-fields.ts';

export async function validateFieldPdf(name: string, mime: string, bytes: Uint8Array): Promise<void> {
  if (!/\.pdf$/i.test(name) || (mime !== '' && mime !== 'application/pdf')) throw new Error('PDF 파일만 선택해주세요.');
  if (!bytes.length || bytes.length > fieldLimits.bytes) throw new Error('PDF는 0바이트보다 크고 5MiB 이하여야 합니다.');
  const head = new TextDecoder('latin1').decode(bytes.slice(0, 8));
  const tail = new TextDecoder('latin1').decode(bytes.slice(-2048));
  if (!/^%PDF-(1\.[0-9]|2\.0)/.test(head) || !tail.includes('%%EOF')) throw new Error('완전한 PDF 파일을 선택해주세요.');
  const problem = await pdfStructure(bytes);
  if (problem) throw new Error(problem);
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: false, updateMetadata: false });
  if (doc.isEncrypted) throw new Error('암호화된 PDF는 사용할 수 없습니다.');
  for (const [, object] of doc.context.enumerateIndirectObjects()) {
    const decoded = object.toString().replace(/#([0-9a-f]{2})/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
    if (/\/(JavaScript|JS|Launch|EmbeddedFile|RichMedia|OpenAction|AA|SubmitForm|ImportData|GoToR|XFA)\b/i.test(decoded)) throw new Error('실행 동작·첨부 콘텐츠·XFA가 있는 PDF는 사용할 수 없습니다.');
  }
  if (doc.getPageCount() > fieldLimits.pages) throw new Error('이 미리보기에서는 최대 50페이지까지 지원합니다.');
  for (const page of doc.getPages()) {
    const rotation = page.getRotation().angle;
    if (!Number.isFinite(rotation) || rotation % 90 !== 0) throw new Error('90도 단위 페이지 회전만 지원합니다.');
  }
}
