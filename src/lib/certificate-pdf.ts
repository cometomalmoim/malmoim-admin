import { PDFDocument, rgb, degrees } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { zipSync } from 'fflate';
import { placement, type Placement } from './certificate-model.ts';
export type Background = { bytes: Uint8Array; mime: string };
export async function certificatePdf(name: string, settings: Placement, fontBytes: Uint8Array, background?: Background, demo = false): Promise<Uint8Array> {
 const p = placement(settings);
 if (background && (!['application/pdf', 'image/png', 'image/jpeg'].includes(background.mime) || background.bytes.length > 5242880)) throw new Error('템플릿은 5MB 이하 PDF, PNG, JPG여야 합니다.');
 if (!name.trim() || name.length > 100 || /[\u0000-\u001f\u007f]/u.test(name)) throw new Error('이름은 1~100자의 한 줄로 입력해주세요.');
 const doc = background?.mime === 'application/pdf' ? await PDFDocument.load(background.bytes, { ignoreEncryption: false }) : await PDFDocument.create();
 if (background?.mime === 'application/pdf') for (const [, object] of doc.context.enumerateIndirectObjects()) {
  if (/\/(JavaScript|JS|Launch|EmbeddedFile|RichMedia|OpenAction|AA|SubmitForm|ImportData|GoToR)\b/i.test(object.toString())) throw new Error('실행 콘텐츠가 포함된 템플릿은 사용할 수 없습니다.');
 }
 if (background?.mime === 'application/pdf' && doc.getPageCount() !== 1) throw new Error('수료증 템플릿 PDF는 한 페이지여야 합니다.');
 const page = doc.getPages()[0] ?? doc.addPage([595.28, 841.89]);
 if (page.getRotation().angle !== 0) throw new Error('회전된 PDF는 회전을 해제한 뒤 등록해주세요.');
 doc.registerFontkit(fontkit);
 // NanumGothic subsetting drops visible glyphs with this fontkit version.
 // Embed the complete font; verified with rendered PDF, not just text extraction.
 const font = await doc.embedFont(fontBytes, { subset: false });
 const supported = new Set(font.getCharacterSet());
 for (const char of name) if (!supported.has(char.codePointAt(0)!)) throw new Error('폰트에서 지원하지 않는 이름 문자가 있습니다.');
 if (background && background.mime !== 'application/pdf') {
  const image = background.mime === 'image/png' ? await doc.embedPng(background.bytes) : await doc.embedJpg(background.bytes);
  if (image.width > 10000 || image.height > 10000 || image.width * image.height > 40000000) throw new Error('이미지 해상도가 너무 큽니다.');
  page.setSize(595.28, 595.28 * image.height / image.width);
  page.drawImage(image, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() });
 }
 const w = page.getWidth(), h = page.getHeight();
 if (!background) {
  page.drawRectangle({ x: 22, y: 22, width: w - 44, height: h - 44, borderWidth: 2, borderColor: rgb(.25, .4, .5) });
  page.drawText('수 료 증', { x: 205, y: h - 150, size: 36, font });
  page.drawText('가상 말모임 과정 참여를 확인합니다.', { x: 118, y: h * .35, size: 20, font });
 }
 const width = font.widthOfTextAtSize(name, p.size), anchor = w * p.x / 100;
 const x = p.align === 'center' ? anchor - width / 2 : p.align === 'right' ? anchor - width : anchor;
 const y = h * (1 - p.y / 100);
 if (x < 0 || x + width > w || y - p.size * .3 < 0 || y + p.size > h) throw new Error('이름이 페이지 밖으로 나갑니다. 위치나 글씨 크기를 조정해주세요.');
 page.drawText(name, { x, y, size: p.size, font });
 if (demo) {
  page.drawText('가상 미리보기 / 발급 효력 없음', { x: 40, y: 35, size: 16, font, color: rgb(.7, .15, .15) });
  page.drawText('SAMPLE', { x: w * .2, y: h * .6, size: 60, rotate: degrees(-25), opacity: .18, font });
 }
 return doc.save();
}
export function certificateZip(files: { id: string; bytes: Uint8Array }[]) {
 if (!files.length || files.length > 100) throw new Error('ZIP은 1~100개 파일을 지원합니다.');
 const entries: Record<string, Uint8Array> = {};
 for (const [i, file] of files.entries()) entries[`${String(i + 1).padStart(3, '0')}-${file.id.replace(/[^a-zA-Z0-9-]/g, '_')}.pdf`] = file.bytes;
 return zipSync(entries, { level: 0 });
}
