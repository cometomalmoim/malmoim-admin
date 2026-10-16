import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { getAdminAccess } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { certificateData, certificatesEnabled, templateBackground } from '@/lib/certificates';
import { certificateSameOrigin, placement, selectCandidates, requireAttended, identity, type Template } from '@/lib/certificate-model';
import { certificateLimits, generationBudget, jobId, templateMime } from '@/lib/certificate-delivery';
import { certificatePdf, certificateZip } from '@/lib/certificate-pdf';
import { cleanCertificateFiles } from '@/lib/certificate-cleanup';
import { pdfStructure } from '@/lib/pdf-validation';
export const maxDuration = 60;
const headers = { 'Cache-Control': 'private, no-store' };
const reply = (message: string, status = 400) => Response.json({ message }, { status, headers });
type Db = Awaited<ReturnType<typeof createClient>>;
async function download(db: Db, id: string, inline = false) {
 const { data: job, error } = await db.from('certificate_jobs').select('id,status,path,mime,expires_at').eq('id', jobId(id)).single();
 if (error || !job) return reply('발급 작업을 찾을 수 없습니다.', 404);
 if (job.status !== 'ready' || Date.parse(job.expires_at) <= Date.now()) return reply(job.status === 'processing' ? '파일을 준비 중입니다. 같은 작업에서 다시 확인해주세요.' : '파일이 실패했거나 만료되었습니다. 새 발급 작업이 필요합니다.', 409);
 const filename = `certificates-${job.id}.${job.mime === 'application/zip' ? 'zip' : 'pdf'}`;
 const urlSeconds = Math.min(certificateLimits.urlSeconds, Math.floor((Date.parse(job.expires_at)-Date.now())/1000));
 if (urlSeconds < 1) return reply('파일이 만료되었습니다.', 409);
 const signed = await db.storage.from('certificate-downloads').createSignedUrl(job.path, urlSeconds, inline ? undefined : { download: filename });
 if (signed.error) return reply('다운로드 주소 생성에 실패했습니다. 같은 작업에서 다시 시도해주세요.', 503);
 return Response.json({ job: job.id, status: job.status, url: signed.data.signedUrl, filename, expiresAt: job.expires_at, urlSeconds }, { headers });
}
async function smallJson(request: Request) {
 if (!request.headers.get('content-type')?.includes('application/json')) throw new Error('파일은 직접 업로드 경로를 사용해주세요.');
 const reader = request.body?.getReader(); if (!reader) throw new Error('요청이 비어 있습니다.');
 const chunks: Uint8Array[] = []; let size = 0;
 try { while (true) { const next = await reader.read(); if (next.done) break; size += next.value.length; if (size > 100000) throw new Error('요청이 너무 큽니다.'); chunks.push(next.value); } }
 finally { await reader.cancel(); }
 return JSON.parse(Buffer.concat(chunks).toString());
}

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
 let activeJob: string | undefined;
 let finalizing = false;
 let db: Db | undefined;
 try {
 const body = await smallJson(request); db = await createClient();
 if (body.action === 'download') return await download(db, jobId(body.job));
 if (body.action === 'cleanup') return Response.json(await cleanCertificateFiles(db), { headers });
 if (body.action === 'upload-init') {
  if (!['application/pdf','image/png','image/jpeg'].includes(body.mime) || !Number.isInteger(body.size) || body.size < 1 || body.size > 5242880) return reply('5MiB 이하 PDF, PNG, JPG를 선택해주세요.');
  const id = crypto.randomUUID();
  const saved = await db.from('certificate_uploads').insert({ id, mime: body.mime });
  if (saved.error) return reply('업로드 준비 실패', 503);
  const signed = await db.storage.from('certificate-staging').createSignedUploadUrl(`${id}/original`, { upsert: false });
  if (signed.error) return reply('업로드 주소 생성 실패', 503);
  return Response.json({ id, url: signed.data.signedUrl }, { headers });
 }
 const font = new Uint8Array(await readFile(path.join(process.cwd(), 'public/fonts/NanumGothic-Regular.ttf')));
 if (body.action === 'upload-complete') {
  const id = jobId(body.upload);
  const existing = await db.from('certificate_templates').select('id').eq('id', id).maybeSingle();
  if (existing.data) return Response.json({ id }, { headers });
  const upload = await db.from('certificate_uploads').select('id,mime,expires_at').eq('id', id).single();
  if (upload.error || Date.parse(upload.data.expires_at) <= Date.now()) return reply('업로드가 없거나 만료되었습니다.');
  const original = await db.storage.from('certificate-staging').download(`${id}/original`);
  if (original.error) return reply('업로드 파일을 찾을 수 없습니다.');
  if (original.data.size > 5242880) return reply('템플릿은 5MiB 이하여야 합니다.');
  const bytes = new Uint8Array(await original.data.arrayBuffer()), mime = templateMime(bytes);
  if (mime !== upload.data.mime) return reply('파일의 실제 형식이 선택한 형식과 다릅니다.');
  if (mime === 'application/pdf') { const error = await pdfStructure(bytes); if (error) return reply(error); }
  const settings = placement(body.placement);
  await certificatePdf('홍길동', settings, font, { bytes, mime }, true);
  const title = String(body.title || '').trim(); if (!title || title.length > 150) return reply('템플릿 제목을 확인해주세요.');
  const filePath = `${id}/original`;
  const stored = await db.storage.from('certificate-templates').upload(filePath, bytes, { contentType: mime, upsert: false });
  if (stored.error) return reply('원본 등록 실패. 등록 목록을 확인한 뒤 다시 시도해주세요.', 409);
  const saved = await db.from('certificate_templates').insert({ id, title, path: filePath, mime, placement: settings });
  if (saved.error) { await db.storage.from('certificate-templates').remove([filePath]); return reply('설정 저장 실패', 503); }
  return Response.json({ id }, { headers });
 }
 if (!['preview','issue','reissue','settings'].includes(body.action)) return reply('지원하지 않는 요청입니다.');
 const requestKey = { action: body.action, event: body.event ?? null, template: body.template ?? null, issue: body.issue ?? null, keys: body.keys ?? null, zip: body.zip === true };
 if (body.action !== 'settings') {
  const id = jobId(body.job);
  const existing = await db.from('certificate_jobs').select('id,request,status,expires_at').eq('id', id).maybeSingle();
  if (existing.error) return reply('발급 작업 조회 실패', 503);
  if (existing.data) {
   const previousRequest = existing.data.request;
   // JSON object order must not affect an otherwise identical retry.
   if (JSON.stringify(Object.keys(requestKey).map(k => [k, requestKey[k as keyof typeof requestKey]])) !== JSON.stringify(Object.keys(requestKey).map(k => [k, previousRequest[k]]))) return reply('같은 작업 ID에 다른 요청을 사용할 수 없습니다.', 409);
   return await download(db, id, body.action === 'preview');
  }
 }
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
 if (body.action !== 'preview') { if (body.confirm !== true) return reply('대상자를 확인한 뒤 발급해주세요.'); requireAttended(current); }
 const selected = previous ? [previous] : current;
 generationBudget(selected.length, 0, 0);
 const zip = body.zip === true || selected.length > 1;
 const spec = { template: template.id, rows: selected.map(r => ({ event_id: r.event_id, source: r.source, application_id: r.application_id, name: r.name })), previous: previous?.id ?? null, preview: body.action === 'preview', zip };
 const id = jobId(body.job);
 const claim = await db.rpc('begin_certificate_job', { p_id: id, p_request: requestKey, p_spec: spec });
 if (claim.error) return reply('발급 작업 시작 실패', 409);
 if (claim.data !== 'claimed') return await download(db, id, body.action === 'preview');
 activeJob = id;
 const start = Date.now(), background = await templateBackground(template);
 const files = []; let total = 0;
 for (const row of selected) {
  generationBudget(selected.length, total, Date.now()-start);
  const bytes = await certificatePdf(row.name, template.placement, font, background, body.action === 'preview');
  total += bytes.length; generationBudget(selected.length, total, Date.now()-start);
  files.push({ id: `${row.event_id}-${row.source}-${row.application_id}`, bytes });
 }
 const bytes = zip ? certificateZip(files) : files[0].bytes;
 generationBudget(selected.length, bytes.length, Date.now()-start);
 const filePath = `${id}/result.${zip ? 'zip' : 'pdf'}`;
 const stored = await db.storage.from('certificate-downloads').upload(filePath, bytes, { contentType: zip ? 'application/zip' : 'application/pdf', upsert: false });
 if (stored.error) throw new Error('파일 저장에 실패했습니다. 발급은 완료되지 않았습니다.');
 generationBudget(selected.length, bytes.length, Date.now()-start);
 finalizing = true;
 const finish = await db.rpc('finish_certificate_job', { p_id: id, p_size: bytes.length });
 if (finish.error) { finalizing = false; throw new Error(finish.error.message.includes('attendance_required') ? '출석 상태가 변경되었습니다. 전체 발급을 취소했습니다.' : '발급 기록 확정에 실패했습니다. 작업 상태를 확인해주세요.'); }
 // Once finalization starts, transport errors are ambiguous. Never delete a
 // possibly committed file; retry/status lookup resolves the same job safely.
 activeJob = undefined;
 return await download(db, id, body.action === 'preview');
 } catch (e) {
  if (activeJob && db && !finalizing) {
   const failed = await db.rpc('fail_certificate_job', { p_id: activeJob });
   if (!failed.error) {
    const job = await db.from('certificate_jobs').select('path,status').eq('id', activeJob).single();
    if (job.data?.status === 'failed') await db.storage.from('certificate-downloads').remove([job.data.path]);
   }
  }
  return reply(e instanceof Error && /출석|작업|발급|파일|템플릿|형식|최대|생성|시간|요청|이름|위치|페이지|폰트|선택/.test(e.message) ? e.message : '처리 실패: 작업 상태와 전용 DB 설정을 확인해주세요.', 409);
 }
}
