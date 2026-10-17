import { fieldKind, type PdfField, type PdfFieldSettings } from './pdf-fields.ts';

export const testParticipant = { id: 'preview-participant-001', name: '테스트 참가자' } as const;
export const consentItems = [
  { id: 'media', title: '촬영 및 홍보 활용 동의', text: '말모임 활동 중 촬영된 사진과 영상은 인스타그램 등 홍보용으로 사용될 수 있습니다. 참가자는 본인의 얼굴, 목소리, 모습이 사용되는 것에 동의합니다.', optional: true },
  { id: 'rules', title: '활동 규칙 숙지', text: '말모임의 운영 규칙을 충분히 이해하였으며, 이를 준수하겠습니다.', optional: false },
  { id: 'consequences', title: '위반 시 불이익 확인', text: '규칙을 지키지 않을 경우, 참여 제한 등의 조치를 받을 수 있음에 동의합니다.', optional: false },
  { id: 'refund', title: '모임비 환불 규정 확인', text: '활동 시작일 이후에는 모임비 환불이 불가능함을 확인합니다.', optional: false },
] as const;
export type ConsentAnswers = { media: boolean | null; rules: boolean; consequences: boolean; refund: boolean };
export type InkPoint = { x: number; y: number };
export type Ink = InkPoint[][];
export type SigningSnapshot = { participant: typeof testParticipant; consentVersion: 'malmoim-activity-preview-v1'; answers: ConsentAnswers; completedAt: string; date: string; originalSha256: string; settings: PdfFieldSettings; ink: Ink };
export function koreaDate(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) throw new Error('완료 시각이 올바르지 않습니다.');
  return new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
export function validInk(ink: Ink): boolean {
  if (!Array.isArray(ink) || ink.length > 80 || ink.flat().length > 4000) return false;
  let length = 0;
  for (const stroke of ink) {
    if (!Array.isArray(stroke)) return false;
    for (let i = 0; i < stroke.length; i++) {
      const p = stroke[i];
      if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1) return false;
      if (i) length += Math.hypot(p.x - stroke[i - 1].x, p.y - stroke[i - 1].y);
    }
  }
  return length >= .04;
}
export function requireSigningReady(answers: ConsentAnswers, ink: Ink, fields: PdfField[], read: boolean): void {
  if (!read) throw new Error('PDF 원문을 먼저 확인해주세요.');
  if (answers.media !== true && answers.media !== false) throw new Error('촬영·홍보 동의 여부를 별도로 선택해주세요.');
  if (answers.rules !== true || answers.consequences !== true || answers.refund !== true) throw new Error('나머지 세 항목을 각각 확인해주세요.');
  if (!validInk(ink)) throw new Error('서명을 작성해주세요. 점 하나만 찍은 서명은 사용할 수 없습니다.');
  for (const kind of ['name', 'date', 'signature']) if (!fields.some(f => fieldKind(f) === kind)) throw new Error('관리자 화면에서 이름·날짜·서명 필드를 각각 한 개 이상 지정해주세요.');
}
export function signingSnapshot(settings: PdfFieldSettings, answers: ConsentAnswers, ink: Ink, read: boolean, completedAt: string): SigningSnapshot {
  requireSigningReady(answers, ink, settings.fields, read);
  return structuredClone({ participant: testParticipant, consentVersion: 'malmoim-activity-preview-v1', answers, completedAt, date: koreaDate(completedAt), originalSha256: settings.fingerprint, settings, ink });
}
// Only this exact supplied blank document gets a convenient initial placement.
export const activityPdfSha256 = '2a65cccc751049df70015b13dff6685d5560043483fab5ee3c6a7b11b2b474b2';
export function activityFields(fingerprint: string): PdfField[] {
  if (fingerprint !== activityPdfSha256) throw new Error('첨부한 활동 동의서 원본에만 기본 배치를 적용할 수 있습니다.');
  return [
    { id: 'activity-name', pageNumber: 1, kind: 'name', rect: { x: 124, y: 141, width: 182, height: 18 } },
    { id: 'activity-signature', pageNumber: 1, kind: 'signature', rect: { x: 144, y: 109, width: 159, height: 22 } },
    { id: 'activity-date', pageNumber: 1, kind: 'date', rect: { x: 122, y: 75, width: 200, height: 18 } },
  ];
}

export function inkPath(ink: Ink): string {
  return ink.filter(stroke => stroke.length > 1).map(stroke => stroke.map((p, i) => `${i ? 'L' : 'M'}${(p.x * 900).toFixed(2)} ${(p.y * 300).toFixed(2)}`).join(' ')).join(' ');
}
