import type { SupabaseClient } from '@supabase/supabase-js';

export async function cleanCertificateFiles(db: SupabaseClient) {
 const expired = await db.rpc('expire_certificate_jobs'); if (expired.error) throw new Error('만료 상태 정리에 실패했습니다.');
 const jobs = await db.from('certificate_jobs').select('id,path').in('status', ['failed','expired']).is('cleaned_at', null).order('created_at').limit(25);
 if (jobs.error) throw new Error('정리 목록 조회 실패');
 let removed = 0;
 for (const job of jobs.data) {
  const result = await db.storage.from('certificate-downloads').remove([job.path]);
  if (result.error) throw new Error('만료 파일 삭제 실패');
  const marked = await db.rpc('mark_certificate_cleaned', { p_id: job.id, p_upload: false });
  if (marked.error) throw new Error('정리 상태 저장 실패'); removed++;
 }
 const uploads = await db.from('certificate_uploads').select('id').lt('expires_at', new Date(Date.now()-600000).toISOString()).is('cleaned_at', null).order('created_at').limit(25);
 if (uploads.error) throw new Error('임시 업로드 목록 조회 실패');
 for (const upload of uploads.data) {
  const refs = await db.from('certificate_templates').select('id').eq('path', `${upload.id}/original`).limit(1);
  if (refs.error) throw new Error('템플릿 참조 확인 실패');
  if (!refs.data.length) {
   const orphan = await db.storage.from('certificate-templates').remove([`${upload.id}/original`]);
   if (orphan.error) throw new Error('미등록 템플릿 정리 실패');
  }
  const result = await db.storage.from('certificate-staging').remove([`${upload.id}/original`]);
  if (result.error) throw new Error('임시 업로드 삭제 실패');
  const marked = await db.rpc('mark_certificate_cleaned', { p_id: upload.id, p_upload: true });
  if (marked.error) throw new Error('정리 상태 저장 실패'); removed++;
 }
 return { removed, message: '한 번에 종류별 최대 25건 정리했습니다. 남은 파일은 다시 실행해주세요.' };
}
