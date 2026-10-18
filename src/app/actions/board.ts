'use server';
import { revalidatePath } from 'next/cache';
import { getAdminAccess } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { boardInput } from '@/lib/board-model';
import { validUuid } from '@/lib/resource-validation';
import { getBoard } from '@/lib/board';
import { retainedImages, BOARD_IMAGE_COUNT, BOARD_IMAGE_TOTAL } from '@/lib/board-images';
import { photoExtension } from '@/lib/people-photo';
export type BoardMutation = 'save' | 'delete' | 'pin' | 'comment' | 'comment_edit' | 'comment_delete';
export async function mutateBoard(kind: BoardMutation, form: FormData) {
  if ((await getAdminAccess()).status !== 'admin') return { message: '관리자 권한을 확인해주세요.' };
  const client = await createClient();
  const uploaded: string[] = [];
  let committed = false;
  try {
    if (!['save', 'delete', 'pin', 'comment', 'comment_edit', 'comment_delete'].includes(kind)) throw new Error('잘못된 작업입니다.');
    const id = String(form.get('id') ?? '');
    const version = String(form.get('updated_at') ?? '');
    if ((id && !validUuid(id)) || (kind !== 'save' && !id) || (id && kind !== 'comment' && !Number.isFinite(Date.parse(version)))) throw new Error('게시글을 새로고침해주세요.');
    const input: Record<string, unknown> = kind === 'save' ? boardInput(form) : kind === 'pin' ? { is_pinned: form.get('is_pinned') === 'on' } : ['comment','comment_edit'].includes(kind) ? { body: String(form.get('body') ?? '').trim() } : {};
    if (['comment','comment_edit'].includes(kind) && (typeof input.body !== 'string' || !input.body || input.body.length > 5000)) throw new Error('댓글은 1~5,000자로 입력해주세요.');
    let previous: string[] = [];
    if (['save','delete'].includes(kind) && id) {
      const { data: { user } } = await client.auth.getUser();
      const row = await client.from('internal_board_posts').select('author_id,images').eq('id', id).single();
      if (!user || row.error || row.data.author_id !== user.id) throw new Error('작성자만 변경할 수 있습니다.');
      previous = row.data.images;
    }
    if (kind === 'save') {
      const paths = retainedImages(form);
      if (paths.some(p => !previous.includes(p))) throw new Error('기존 첨부 이미지를 확인해주세요.');
      const files = form.getAll('images').filter((f): f is File => f instanceof File && f.size > 0);
      if (paths.length + files.length > BOARD_IMAGE_COUNT || files.reduce((n, f) => n + f.size, 0) > BOARD_IMAGE_TOTAL) throw new Error('이미지는 최대 4장, 새 파일 합계 4MB까지 첨부할 수 있습니다.');
      const { data: { user } } = await client.auth.getUser();
      if (!user) throw new Error('로그인해주세요.');
      // Validate every file before uploading any bytes.
      const prepared = await Promise.all(files.map(async file => { const bytes = new Uint8Array(await file.arrayBuffer()); return { file, bytes, extension: photoExtension(bytes, file.type) }; }));
      for (const { file, bytes, extension } of prepared) {
        const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
        const result = await client.storage.from('board-images').upload(path, bytes, { contentType: file.type, upsert: false });
        if (result.error) throw new Error('이미지를 업로드하지 못했습니다. 저장소 설정을 확인해주세요.');
        uploaded.push(path);
      }
      input.images = [...paths, ...uploaded];
    }
    const result = await client.rpc('manage_internal_board', { p_kind: kind, p_id: id || null, p_updated_at: id && kind !== 'comment' ? version : null, p_input: input });
    if (result.error) throw new Error('저장하지 못했습니다. 작성자 권한 또는 다른 변경 사항을 확인하고 새로고침해주세요.');
    committed = true;
    const kept = kind === 'save' ? input.images as string[] : [];
    if (['save','delete'].includes(kind)) {
      const removed = previous.filter(p => !kept.includes(p));
      if (removed.length) await client.storage.from('board-images').remove(removed);
    }
    revalidatePath('/admin/internal-board');
    const data = await getBoard();
    return { success: true, message: '처리했습니다.', id: result.data as string, data };
  } catch (error) { return { message: committed ? '저장했지만 화면 갱신에 실패했습니다. 새로고침해주세요.' : error instanceof Error ? error.message : '처리하지 못했습니다.' }; }
  finally { if (!committed && uploaded.length) await client.storage.from('board-images').remove(uploaded); }
}
