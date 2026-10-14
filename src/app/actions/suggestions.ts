'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getAdminAccess } from '@/lib/auth';
import { createSuggestion, updateSuggestionStatus, updateSuggestionText } from '@/lib/suggestions';

export type SuggestionActionState = { message: string; success?: boolean };
const failed: SuggestionActionState = { message: '저장하지 못했습니다. 권한과 데이터베이스 설정을 확인한 뒤 다시 시도해주세요.' };

export async function createSuggestionAction(_previous: SuggestionActionState, formData: FormData): Promise<SuggestionActionState> {
  if ((await getAdminAccess()).status !== 'admin') return { message: '관리자 권한을 확인해주세요.' };
  const mode = String(formData.get('mode') ?? '');
  const result = await createSuggestion({
    title: String(formData.get('title') ?? ''),
    content: String(formData.get('content') ?? ''),
    mode,
    publicName: String(formData.get('public_name') ?? ''),
  });
  if (!result.ok) return result.reason === 'invalid' ? { message: '제목, 내용, 공개 이름을 입력 항목에 맞게 확인해주세요.' } : result.reason === 'forbidden' ? { message: '관리자 권한을 확인해주세요.' } : failed;
  revalidatePath('/admin/suggestions');
  redirect(`/admin/suggestions/${result.id}`);
}

export async function saveSuggestionFeedbackAction(id: string, _previous: SuggestionActionState, formData: FormData): Promise<SuggestionActionState> {
  if ((await getAdminAccess()).status !== 'admin') return { message: '관리자 권한을 확인해주세요.' };
  const result = await updateSuggestionText(id, 'staff_feedback', String(formData.get('staff_feedback') ?? ''));
  if (!result.ok) return result.reason === 'invalid' ? { message: '피드백은 10,000자 이내로 입력해주세요.' } : result.reason === 'missing' ? { message: '건의를 찾을 수 없습니다.' } : failed;
  revalidatePath('/admin/suggestions');
  revalidatePath(`/admin/suggestions/${id}`);
  return { message: '운영진 피드백을 저장했습니다. 건의 상태는 변경되지 않았습니다.', success: true };
}

export async function saveSuggestionResolutionAction(id: string, _previous: SuggestionActionState, formData: FormData): Promise<SuggestionActionState> {
  if ((await getAdminAccess()).status !== 'admin') return { message: '관리자 권한을 확인해주세요.' };
  const result = await updateSuggestionText(id, 'resolution', String(formData.get('resolution') ?? ''));
  if (!result.ok) return result.reason === 'invalid' ? { message: '처리 결과는 10,000자 이내로 입력해주세요.' } : result.reason === 'missing' ? { message: '건의를 찾을 수 없습니다.' } : failed;
  revalidatePath('/admin/suggestions');
  revalidatePath(`/admin/suggestions/${id}`);
  return { message: '처리 결과를 저장했습니다. 건의 상태는 변경되지 않았습니다.', success: true };
}

export async function saveSuggestionStatusAction(id: string, _previous: SuggestionActionState, formData: FormData): Promise<SuggestionActionState> {
  if ((await getAdminAccess()).status !== 'admin') return { message: '관리자 권한을 확인해주세요.' };
  const result = await updateSuggestionStatus(id, String(formData.get('status') ?? ''));
  if (!result.ok) {
    if (result.reason === 'complete_requires_resolution') return { message: '처리 완료로 바꾸기 전에 실제 처리 결과를 저장해주세요.' };
    if (result.reason === 'invalid') return { message: '상태 값 또는 건의 번호를 확인해주세요.' };
    if (result.reason === 'missing') return { message: '건의를 찾을 수 없습니다.' };
    return failed;
  }
  revalidatePath('/admin/suggestions');
  revalidatePath(`/admin/suggestions/${id}`);
  return { message: '건의 상태를 변경했습니다.', success: true };
}
