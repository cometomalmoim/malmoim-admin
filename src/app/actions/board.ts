'use server';
import { revalidatePath } from 'next/cache';
import { getAdminAccess } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { boardInput } from '@/lib/board-model';
import { validUuid } from '@/lib/resource-validation';
import { getBoard } from '@/lib/board';
export async function mutateBoard(kind: 'save' | 'delete' | 'pin' | 'comment', form: FormData) {
  if ((await getAdminAccess()).status !== 'admin') return { message: '관리자 권한을 확인해주세요.' };
  try {
    if (!['save', 'delete', 'pin', 'comment'].includes(kind)) throw new Error('잘못된 작업입니다.');
    const id = String(form.get('id') ?? '');
    const version = String(form.get('updated_at') ?? '');
    if ((id && !validUuid(id)) || (kind !== 'save' && !id) || (id && kind !== 'comment' && !Number.isFinite(Date.parse(version)))) throw new Error('게시글을 새로고침해주세요.');
    const input = kind === 'save' ? boardInput(form) : kind === 'pin' ? { is_pinned: form.get('is_pinned') === 'on' } : kind === 'comment' ? { body: String(form.get('body') ?? '').trim() } : {};
    if (kind === 'comment' && (!('body' in input) || !input.body || input.body.length > 5000)) throw new Error('댓글은 1~5,000자로 입력해주세요.');
    const client = await createClient();
    const result = await client.rpc('manage_internal_board', { p_kind: kind, p_id: id || null, p_updated_at: id && kind !== 'comment' ? version : null, p_input: input });
    if (result.error) return { message: '저장하지 못했습니다. 작성자 권한 또는 다른 변경 사항을 확인하고 새로고침해주세요.' };
    revalidatePath('/admin/internal-board');
    const data = await getBoard();
    return { success: true, message: '처리했습니다.', id: result.data as string, data };
  } catch (error) { return { message: error instanceof Error ? error.message : '처리하지 못했습니다.' }; }
}
