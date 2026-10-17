import { PDFDocument, PDFName, PDFNumber, degrees, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { displayPointToPdf, fieldKind, parseSettings, toDisplay, type PdfPageInfo } from './pdf-fields.ts';
import { consentItems, inkPath, koreaDate, requireSigningReady, testParticipant, type SigningSnapshot } from './pdf-signing.ts';
import { validateFieldPdf } from './pdf-fields-validation.ts';

function expectedViewport(page: ReturnType<PDFDocument['getPages']>[number], n: number): PdfPageInfo {
  const media = page.getMediaBox(), crop = page.getCropBox();
  const x = Math.max(media.x, crop.x), y = Math.max(media.y, crop.y);
  const right = Math.min(media.x + media.width, crop.x + crop.width), top = Math.min(media.y + media.height, crop.y + crop.height);
  const viewBox = right > x && top > y ? [x, y, right, top] : [media.x, media.y, media.x + media.width, media.y + media.height];
  const rotation = ((page.getRotation().angle % 360) + 360) % 360;
  // UserUnit is not exposed by PDFPage's high-level API.
  const raw = page.node.lookupMaybe(PDFName.of('UserUnit'), PDFNumber);
  const userUnit = raw instanceof PDFNumber && raw.asNumber() > 0 ? raw.asNumber() : 1;
  const [left, bottom, r, t] = viewBox, width = r - left, height = t - bottom, u = userUnit;
  const transforms: Record<number, PdfPageInfo['transform']> = { 0: [u,0,0,-u,-left*u,t*u], 90: [0,u,u,0,-bottom*u,-left*u], 180: [-u,0,0,u,r*u,-bottom*u], 270: [0,-u,-u,0,t*u,r*u] };
  return { pageNumber: n, viewBox, rotation, userUnit, width: (rotation % 180 ? height : width) * u, height: (rotation % 180 ? width : height) * u, transform: transforms[rotation] };
}

export async function signedPreviewPdf(original: Uint8Array, snapshot: SigningSnapshot, fontBytes: Uint8Array): Promise<Uint8Array> {
  await validateFieldPdf('preview.pdf', 'application/pdf', original);
  requireSigningReady(snapshot.answers, snapshot.ink, snapshot.settings.fields, true);
  if (snapshot.participant.name !== testParticipant.name || snapshot.participant.id !== testParticipant.id || snapshot.consentVersion !== 'malmoim-activity-preview-v1' || snapshot.date !== koreaDate(snapshot.completedAt)) throw new Error('가상 참가자와 완료 정보를 확인해주세요.');
  const digest = await crypto.subtle.digest('SHA-256', original.slice().buffer);
  const fingerprint = Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, '0')).join('');
  if (snapshot.originalSha256 !== fingerprint) throw new Error('원본 PDF가 변경되었습니다.');
  const doc = await PDFDocument.load(original, { updateMetadata: false });
  const pages = doc.getPages().map((p, i) => expectedViewport(p, i + 1));
  const fields = parseSettings(JSON.stringify(snapshot.settings), fingerprint, pages);
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(fontBytes, { subset: false });
  const path = inkPath(snapshot.ink);
  for (const field of fields) {
    const page = doc.getPage(field.pageNumber - 1), info = pages[field.pageNumber - 1], rect = toDisplay(field.rect, info);
    const width = rect.width * info.width, height = rect.height * info.height;
    const kind = fieldKind(field), padding = Math.min(3, width * .05, height * .1);
    if (kind === 'signature') {
      const scale = Math.min((width - 2 * padding) / 900, (height - 2 * padding) / 300);
      const dx = (width - 900 * scale) / 2, dy = (height - 300 * scale) / 2;
      const [x, y] = displayPointToPdf(rect.x + dx / info.width, rect.y + dy / info.height, info);
      page.drawSvgPath(path, { x, y, scale: scale / info.userUnit, rotate: degrees(info.rotation), borderColor: rgb(.06,.12,.18), borderWidth: 5, borderLineCap: 1 });
    } else {
      const text = kind === 'name' ? snapshot.participant.name : snapshot.date;
      const size = Math.min(14 / info.userUnit, (height - 2 * padding) / info.userUnit, (width - 2 * padding) / font.widthOfTextAtSize(text, 1));
      if (size * info.userUnit < 6) throw new Error('이름 또는 날짜 필드가 너무 작습니다. 관리자 화면에서 크기를 늘려주세요.');
      const inkHeight = font.heightAtSize(size, { descender: false }) * info.userUnit;
      const [x, y] = displayPointToPdf(rect.x + padding / info.width, rect.y + (height + inkHeight) / 2 / info.height, info);
      page.drawText(text, { x, y, size, font, rotate: degrees(info.rotation), color: rgb(.06,.12,.18) });
    }
  }
  const record = doc.addPage([595.28, 841.89]);
  const text = (value: string, y: number, size = 11) => record.drawText(value, { x: 40, y, size, font, color: rgb(.08,.16,.14) });
  text('말모임 전자서명 - 테스트 응답 확인', 786, 20);
  text('가상 참가자 · 브라우저 테스트 · 실제 제출/서버 보관 기록 없음', 755, 11);
  text('앞 페이지의 원본 디자인과 문구는 유지했습니다.', 718);
  text('촬영·홍보 응답은 서명과 별개입니다. 서명 자체가 촬영 동의는 아닙니다.', 698);
  text(`이름: ${snapshot.participant.name} / 테스트 ID: ${snapshot.participant.id}`, 656, 10);
  text(`완료 날짜: ${snapshot.date} (Asia/Seoul)`, 634);
  text(`브라우저 기록 시각: ${snapshot.completedAt}`, 612, 10);
  for (const [i, item] of consentItems.entries()) {
    const answer = snapshot.answers[item.id];
    text(`${i + 1}. ${item.title}${item.optional ? ' (선택)' : ''}`, 563 - i * 64, 13);
    text(item.id === 'media' ? (answer ? '별도 응답: 동의' : '별도 응답: 동의하지 않음') : '별도 응답: 확인함', 541 - i * 64, 11);
  }
  text(`문서/동의 버전: ${snapshot.consentVersion}`, 272, 10);
  text('원본 PDF SHA-256:', 248, 10); text(fingerprint, 230, 9);
  text(`필드: ${fields.length}개 / 서명: ${fields.filter(f => fieldKind(f) === 'signature').length}곳에 동일 적용`, 200);
  text('원문 1번의 동의 문구와 관계없이 촬영·홍보 선택 응답은 위와 같습니다.', 164, 10);
  text('완료 시각은 브라우저 기기 기준이며 인증·타임스탬프 증명이 아닙니다.', 144, 10);
  text('이 테스트 결과는 DB·Storage·문자·신청자 관리와 연결되지 않습니다.', 124, 10);
  doc.setTitle('말모임 전자서명 테스트 PDF'); doc.setSubject('가상 참가자 브라우저 테스트 - 실제 제출 아님');
  return doc.save();
}
