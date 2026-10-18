'use server';
import { getAdminAccess } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { eventInput } from '@/lib/event-validation';
import { revalidatePath } from 'next/cache';
export type EventState = {message:string;slug?:string};
export async function saveEvent(_previous:EventState,data:FormData):Promise<EventState> {
  if ((await getAdminAccess()).status !== 'admin') return {message:'관리자 권한을 확인해주세요.'};
  let input;
  try { input = eventInput(data); } catch (error) { return {message:error instanceof Error ? error.message : '입력을 확인해주세요.'}; }
  const id = String(data.get('id') ?? '');
  if (id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return {message:'이벤트를 확인해주세요.'};
  try {
    const client = await createClient();
    // Stable generated address; editing a title never breaks existing links.
    const result = id
      ? await client.from('recruitment_events').update(input).eq('id',id).select('slug').single()
      : await client.from('recruitment_events').insert({...input,slug:`event-${crypto.randomUUID()}`}).select('slug').single();
    if (result.error) return {message:'저장하지 못했습니다. 이벤트 설정 SQL 적용 여부와 권한을 확인한 뒤 다시 시도해주세요.'};
    revalidatePath('/admin', 'layout');
    return {message:'이벤트를 저장했습니다.',slug:result.data.slug};
  } catch { return {message:'연결하지 못했습니다. 입력을 유지한 채 다시 시도해주세요.'}; }
}
