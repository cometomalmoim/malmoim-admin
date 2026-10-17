import { fieldKind, parseSettings, type PdfFieldSettings } from './pdf-fields.ts';
import type { ConsentAnswers } from './pdf-signing.ts';

// No UI, browser, Supabase or transport dependency. IDs can map to real DB IDs later.
export const signatureStatuses = { unsent: '미발송', pending: '서명 대기', completed: '서명 완료', declined: '서명 거절', expired: '링크 만료', failed: '처리 실패' } as const;
export type SignatureStatus = keyof typeof signatureStatuses;
export type DocumentTemplate = { id: string; name: string; revision: number; createdAt: string; updatedAt: string; origin: 'fixture' | 'local'; original: { filename: string; bytes: number; fingerprint: string } | null; settings: PdfFieldSettings | null };
export type SigningRequest = { id: string; eventId: string; eventName: string; participantKey: { source: string; applicationId: string }; participantName: string; templateId: string; templateName: string; templateRevision: number; status: SignatureStatus; requestedAt: string | null; completedAt: string | null; answers: ConsentAnswers | null; history: { at: string; label: string }[]; artifactId: string | null; isFixture: true };
export type RequestFilter = { eventId: string; status: string; name: string; templateId?: string };
export function filterRequests(rows: SigningRequest[], filter: RequestFilter): SigningRequest[] {
  const query = filter.name.trim().normalize('NFKC').toLocaleLowerCase();
  return rows.filter(row => (!filter.eventId || row.eventId === filter.eventId) && (!filter.status || row.status === filter.status) && (!filter.templateId || row.templateId === filter.templateId) && (!query || row.participantName.normalize('NFKC').toLocaleLowerCase().includes(query)));
}
export function requestCounts(rows: SigningRequest[]) {
  return { total: rows.length, pending: rows.filter(r => r.status === 'pending').length, completed: rows.filter(r => r.status === 'completed').length, unsent: rows.filter(r => r.status === 'unsent').length };
}
export function templateName(value: string): string {
  const name = value.trim();
  if (!name || name.length > 100 || /[\u0000-\u001f\u007f]/u.test(name)) throw new Error('서류 이름은 1~100자의 한 줄로 입력해주세요.');
  return name;
}
export function updateTemplate(template: DocumentTemplate, name: string, settings: PdfFieldSettings | null, now: string): DocumentTemplate {
  if (settings) {
    if (!template.original || settings.fingerprint !== template.original.fingerprint) throw new Error('같은 원본 PDF에 대한 설정만 저장할 수 있습니다.');
    const fields = parseSettings(JSON.stringify(settings), template.original.fingerprint, settings.pages);
    settings = { ...settings, fields };
  }
  return { ...template, name: templateName(name), settings: settings ? structuredClone(settings) : null, revision: template.revision + 1, updatedAt: now };
}
export function templateReadiness(template: DocumentTemplate): string {
  if (!template.original) return '원본 PDF 미등록';
  if (!template.settings?.fields.length) return '필드 설정 필요';
  return ['name','date','signature'].every(kind => template.settings!.fields.some(field => fieldKind(field) === kind)) ? '세 종류 필드 설정됨' : '이름·날짜·서명 필드 확인 필요';
}
export function selectedRequests(rows: SigningRequest[], ids: string[]): SigningRequest[] { const selected = new Set(ids); return rows.filter(row => selected.has(row.id)); }
export function toggleVisibleSelection(selected: string[], visible: SigningRequest[], checked: boolean): string[] {
  const ids = new Set(selected); for (const row of visible) { if (checked) ids.add(row.id); else ids.delete(row.id); } return [...ids];
}
export function requestMessage(row: SigningRequest): string {
  return `[가상 문자 미리보기 · 전송 안 됨]\n${row.participantName}님, ${row.eventName}의 ‘${row.templateName}’ 내용을 확인해주세요.\n서명 링크: {개인별_서명_링크}\n※ 링크는 발급되지 않았습니다. 실제 문자 내용·연락처·인증은 연동 전입니다.`;
}
export function canUseCompletedPdf(row: SigningRequest, availableArtifactIds: ReadonlySet<string>): boolean { return row.status === 'completed' && row.artifactId !== null && availableArtifactIds.has(row.artifactId); }
