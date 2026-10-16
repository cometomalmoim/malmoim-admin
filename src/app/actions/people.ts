'use server';
import { revalidatePath } from 'next/cache';
import { getAdminAccess } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { validUuid } from '@/lib/resource-validation';
import { peopleInput } from '@/lib/people-validation';
export async function mutatePerson(kind: 'save' | 'active' | 'inactive' | 'delete', form: FormData): Promise<{success?: boolean; message: string; id?: string}> {
  if ((await getAdminAccess()).status !== 'admin') return { message: '관리자 권한을 확인해주세요.' };
  try {
    if (!['save', 'active', 'inactive', 'delete'].includes(kind)) throw new Error('작업을 확인해주세요.');
    const id = String(form.get('id') ?? '');
    const version = String(form.get('updated_at') ?? '');
    if ((id && !validUuid(id)) || (kind !== 'save' && !id) || (id && !Number.isFinite(Date.parse(version)))) throw new Error('프로필을 새로고침한 뒤 다시 시도해주세요.');
    const input = kind === 'save' ? peopleInput(form) : {};
    const client = await createClient();
    const result = await client.rpc('manage_person', { p_kind: kind, p_id: id || null, p_updated_at: id ? version : null, p_input: input });
    if (result.error) return { message: '처리하지 못했습니다. 다른 운영진이 변경했거나 DB 설정에 문제가 있을 수 있습니다. 새로고침 후 다시 시도해주세요.' };
    revalidatePath('/admin/people');
    return { success: true, message: kind === 'delete' ? '프로필을 삭제했습니다.' : '프로필을 저장했습니다.', id: result.data };
  } catch (error) { return { message: error instanceof Error ? error.message : '처리하지 못했습니다. 다시 시도해주세요.' }; }
}
