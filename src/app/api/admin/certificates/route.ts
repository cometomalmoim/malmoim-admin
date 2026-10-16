import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { getAdminAccess } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { certificateData, certificatesEnabled, templateBackground } from '@/lib/certificates';
import { certificateSameOrigin, placement, selectCandidates, requireAttended, identity, type Template } from '@/lib/certificate-model';
import { certificatePdf, certificateZip } from '@/lib/certificate-pdf';
import { pdfStructure } from '@/lib/pdf-validation';
export const maxDuration = 60;
const headers = { 'Cache-Control': 'private, no-store' };
const reply = (message: string, status = 400) => Response.json({ message }, { status, headers });
export async function GET(request: Request) {
 if (!certificatesEnabled()) return reply('실제 수료증 기능은 비활성 상태입니다.', 503);
 if ((await getAdminAccess()).status !== 'admin') return reply('관리자 권한이 필요합니다.', 403);
 try { return Response.json(await certificateData(new URL(request.url).searchParams.get('event') || undefined), { headers }); }
 catch { return reply('조회 실패: 전용 DB 설정과 권한을 확인해주세요.', 503); }
}
export async function POST(request: Request) {
 if (!certificatesEnabled()) return reply('실제 수료증 기능은 비활성 상태입니다.', 503);
 if (!certificateSameOrigin(request.headers, request.url)) return reply('요청 출처를 확인해주세요.', 403);
 if ((await getAdminAccess()).status !== 'admin') return reply('관리자 권한이 필요합니다.', 403);
 try {
 const db = await createClient();
 const font = new Uint8Array(await readFile(path.join(process.cwd(), 'public/fonts/NanumGothic-Regular.ttf')));
 if (request.headers.get('content-type')?.includes('multipart/form-data')) {
  if (Number(request.headers.get('content-length') || 0) > 5500000) return reply('파일은 최대 5MB입니다.', 413);
  const data = await request.formData(); const file = data.get('file');
  if (!(file instanceof File) || file.size > 5 * 1024 * 1024 || !file.size) return reply('5MB 이하 템플릿을 선택해주세요.');
  const mime = file.type; const bytes = new Uint8Array(await file.arrayBuffer());
  const matches = mime === 'application/pdf' ? Buffer.from(bytes.slice(0, 5)).toString() === '%PDF-' : mime === 'image/png' ? bytes.slice(0, 8).join(',') === '137,80,78,71,13,10,26,10' : mime === 'image/jpeg' && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (!matches) return reply('PDF, PNG, JPG 형식을 확인해주세요.');
  if (mime === 'application/pdf') { const error = await pdfStructure(bytes); if (error) return reply(error); }
  const settings = placement(JSON.parse(String(data.get('placement'))));
  await certificatePdf('홍길동', settings, font, { bytes, mime }, true);
  const title = String(data.get('title') || '').trim(); if (!title || title.length > 150) return reply('템플릿 제목을 확인해주세요.');
  const id = crypto.randomUUID(), filePath = `${id}/original`;
  const upload = await db.storage.from('certificate-templates').upload(filePath, bytes, { contentType: mime, upsert: false });
  if (upload.error) return reply('템플릿 업로드 실패', 503);
  const saved = await db.from('certificate_templates').insert({ id, title, path: filePath, mime, placement: settings });
  if (saved.error) { await db.storage.from('certificate-templates').remove([filePath]); return reply('설정 저장 실패', 503); }
  return Response.json({ id }, { headers });
 }
 if (Number(request.headers.get('content-length') || 0) > 100000) return reply('요청이 너무 큽니다.', 413);
 const body = await request.json();
 if (!['preview', 'issue', 'reissue', 'settings'].includes(body.action)) return reply('지원하지 않는 요청입니다.');
 const templateResult = await db.from('certificate_templates').select('*').eq('id', body.template).single();
 if (templateResult.error) return reply('템플릿을 찾을 수 없습니다.');
 let template = templateResult.data as Template;
 if (body.action === 'settings') {
  const settings = placement(body.placement);
  await certificatePdf('홍길동', settings, font, await templateBackground(template), true);
  const result = await db.from('certificate_templates').insert({ title: template.title, path: template.path, mime: template.mime, placement: settings });
  if (result.error) return reply('설정 저장 실패', 503);
  return Response.json({ message: '새 템플릿 버전으로 저장했습니다.' }, { headers });
 }
 let previous: { id: string; name: string; event_id: string; source: string; application_id: string; template_id: string } | undefined;
 if (body.action === 'reissue') {
  const r = await db.from('certificate_issues').select('*').eq('id', body.issue).single();
  if (r.error) return reply('발급 기록을 찾을 수 없습니다.'); previous = r.data;
  const t = await db.from('certificate_templates').select('*').eq('id', previous!.template_id).single();
  if (t.error) return reply('발급 당시 템플릿을 찾을 수 없습니다.'); template = t.data;
 }
 const data = await certificateData(previous?.event_id ?? body.event);
 const current = selectCandidates(data.candidates, previous ? [identity(previous)] : body.keys);
 if (body.action !== 'preview') requireAttended(current);
 const selected = previous ? [previous] : current;
 const background = await templateBackground(template);
 const files = [];
 for (const row of selected) files.push({ id: `${row.event_id}-${row.source}-${row.application_id}`, bytes: await certificatePdf(row.name, template.placement, font, background, body.action === 'preview') });
 if (body.action !== 'preview') {
  if (body.confirm !== true) return reply('대상자를 확인한 뒤 발급해주세요.');
  const r = await db.rpc('record_certificate_batch', { p_template: template.id, p_rows: selected.map(r => ({ event_id: r.event_id, source: r.source, application_id: r.application_id, name: r.name })), p_previous: previous?.id ?? null });
  if (r.error) return reply(r.error.message.includes('attendance_required') ? '출석 상태가 변경되었습니다. 출석 완료된 신청자만 발급할 수 있습니다.' : '발급 기록 저장에 실패했습니다. 대상자 변경 또는 DB 설정을 확인해주세요.', 409);
 }
 const zip = body.zip === true || files.length > 1;
 const bytes = zip ? certificateZip(files) : files[0].bytes;
 return new Response(Buffer.from(bytes), { headers: { ...headers, 'Content-Type': zip ? 'application/zip' : 'application/pdf', 'Content-Disposition': `${body.action === 'preview' ? 'inline' : 'attachment'}; filename="certificates.${zip ? 'zip' : 'pdf'}"` } });
 } catch (e) { if (e instanceof Error && e.message.startsWith('출석 완료')) return reply(e.message, 409); return reply(e instanceof Error && /이름|위치|페이지|폰트|한 번에|신청자|템플릿|이미지/.test(e.message) ? e.message : '처리 실패: 파일 및 전용 DB 설정을 확인해주세요.'); }
}
