import 'server-only';
import { getAdminAccess } from './auth';
import { createClient } from './supabase/server';
import { attendedFirst, collectPages, type Candidate, type Template } from './certificate-model';
export function certificatesEnabled() { return process.env.CERTIFICATES_ENABLED === 'true'; }
export async function certificateData(eventId?: string) {
 if (!certificatesEnabled() || (await getAdminAccess()).status !== 'admin') throw new Error('관리자 접근 권한을 확인해주세요.');
 const db = await createClient();
 const events = await db.from('recruitment_events').select('id,slug,title,is_test').order('id');
 if (events.error) throw new Error('이벤트를 조회하지 못했습니다.');
 const templates = await db.from('certificate_templates').select('*').order('created_at', { ascending: false });
 if (templates.error) throw new Error('수료증 전용 마이그레이션 적용 여부를 확인해주세요.');
 let candidates: Candidate[] = [];
 if (eventId) {
  const apps = await collectPages(async (from, to) => {
   const r = await db.from('event_application_list').select('event_id,source,id,name').eq('event_id', eventId).order('source').order('id').range(from, to);
   if (r.error) throw new Error('신청자 조회 실패'); return r.data;
  });
  const participation = await collectPages(async (from, to) => {
   const r = await db.from('event_participation').select('source,application_id,attendance,confirmation').eq('event_id', eventId).order('source').order('application_id').range(from, to);
   if (r.error) throw new Error('참여 이력 조회 실패'); return r.data;
  });
  const states = new Map(participation.map(p => [`${p.source}:${p.application_id}`, p]));
  candidates = attendedFirst(apps.map(a => { const state = states.get(`${a.source}:${a.id}`); return { event_id: a.event_id, source: a.source, application_id: a.id, name: a.name, attendance: state?.attendance ?? 'unrecorded', confirmation: state?.confirmation ?? 'unconfirmed' }; }));
 }
 const history = await collectPages(async (from, to) => {
  let q = db.from('certificate_issues').select('*').order('created_at', { ascending: false }).order('id');
  if (eventId) q = q.eq('event_id', eventId);
  const r = await q.range(from, to); if (r.error) throw new Error('발급 기록 조회 실패'); return r.data;
 });
 const jobs = await db.from('certificate_jobs').select('id,status,mime,created_at,expires_at,error_code,spec').order('created_at', { ascending: false }).limit(50);
 if (jobs.error) throw new Error('다운로드 작업 마이그레이션을 확인해주세요.');
 return { events: events.data, templates: templates.data as Template[], candidates, history, jobs: jobs.data.map(({ spec, ...job }) => ({ ...job, preview: Boolean(spec && typeof spec === 'object' && !Array.isArray(spec) && spec.preview === true) })) };
}
export async function templateBackground(template: Template) {
 if (!certificatesEnabled() || (await getAdminAccess()).status !== 'admin') throw new Error('관리자 접근 권한을 확인해주세요.');
 const db = await createClient();
 const r = await db.storage.from('certificate-templates').download(template.path);
 if (r.error) throw new Error('템플릿 파일 조회 실패');
 return { bytes: new Uint8Array(await r.data.arrayBuffer()), mime: template.mime };
}
