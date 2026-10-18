import type { DocumentTemplate, SigningRequest, SignatureStatus } from './document-admin-model.ts';

export function documentAdminFixtures(): { templates: DocumentTemplate[]; requests: SigningRequest[] } {
  const templates: DocumentTemplate[] = ['활동 동의서', '이벤트 참가 확인서', '운영 안내 확인서'].map((name, i) => ({ id: `fixture-template-${i + 1}`, name: `[가상] ${name}`, revision: 1, createdAt: '2026-10-15T01:00:00Z', updatedAt: '2026-10-15T01:00:00Z', origin: 'fixture', original: null, settings: null }));
  const events = [{ id: 'fixture-event-1', name: '[가상] 언어교환 모임' }, { id: 'fixture-event-2', name: '[가상] 문화 체험 행사' }, { id: 'fixture-event-3', name: '[가상] 운영진 워크숍' }];
  const statuses: SignatureStatus[] = ['unsent','pending','completed','declined','expired','failed'];
  const requests = events.flatMap((event, eventIndex) => statuses.map((status, i): SigningRequest => {
    const template = templates[eventIndex], requestedAt = status === 'unsent' ? null : '2026-10-15T02:00:00Z';
    const completedAt = status === 'completed' ? '2026-10-16T03:20:00Z' : null;
    return { id: `fixture-request-${eventIndex}-${i}`, eventId: event.id, eventName: event.name, participantKey: { source: 'fixture', applicationId: `fixture-app-${eventIndex}-${i}` }, participantName: `가상 참가자 ${String(eventIndex * 6 + i + 1).padStart(2, '0')}`, templateId: template.id, templateName: template.name, templateRevision: template.revision, status, requestedAt, completedAt, artifactId: null, isFixture: true,
      answers: status === 'completed' ? { media: eventIndex === 1, rules: true, consequences: true, refund: true } : null,
      history: [{ at: '2026-10-15T01:00:00Z', label: '가상 요청 행 준비' }, ...(requestedAt ? [{ at: requestedAt, label: '가상 발송 이력 — 실제 발송 없음' }] : []), ...(completedAt ? [{ at: completedAt, label: '가상 완료 이력 — 실제 서명/PDF 없음' }] : []), ...(['declined','expired','failed'].includes(status) ? [{ at: '2026-10-16T04:00:00Z', label: `가상 ${status === 'declined' ? '거절' : status === 'expired' ? '만료' : '실패'} 이력` }] : [])] };
  }));
  return { templates, requests };
}
