'use server';
import { revalidatePath } from 'next/cache';
import { getAdminAccess } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { encryptAccountPassword, decryptAccountPassword } from '@/lib/external-account-crypto';
import { accountCategories } from '@/lib/external-account-types';
import type { AccountLog } from '@/lib/external-account-types';
import { validUuid } from '@/lib/resource-validation';

export async function getExternalAccountLogs(id: string): Promise<{logs?:AccountLog[];message?:string}> {
  if (!validUuid(id) || (await getAdminAccess()).status !== 'admin') return {message:'열람 권한을 확인해주세요.'};
  const client=await createClient();
  const result=await client.from('account_access_logs').select('*').eq('account_id',id).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(100);
  return result.error ? {message:'기록을 불러오지 못했습니다.'} : {logs:result.data as AccountLog[]};
}

async function adminClient() {
  if ((await getAdminAccess()).status !== 'admin') throw new Error('관리자 권한이 필요합니다.');
  return createClient();
}
async function masterClient() {
  const client = await adminClient();
  const allowed = await client.rpc('external_account_master');
  if (allowed.error || allowed.data !== true) throw new Error('Master Admin 권한이 필요합니다.');
  return client;
}
export async function saveExternalAccount(form: FormData, remove = false) {
  try {
    // Initial operation: all admins may create/edit; deletion remains master-only.
    const client = remove ? await masterClient() : await adminClient();
    const input = Object.fromEntries(['service_name','service_url','login_id','category','department','primary_manager','sub_manager','billing_cycle','payment_method','amount','currency','next_billing_date','renewal_notice_days','notes'].map(k => [k, String(form.get(k) ?? '').trim()]));
    if (!remove) {
      const url = new URL(input.service_url);
      if (url.protocol !== 'https:' || url.username || url.password || !Object.hasOwn(accountCategories,input.category)) throw new Error('HTTPS 서비스 URL과 카테고리를 확인해주세요.');
      if (!input.service_name || !input.login_id || !Number.isFinite(Number(input.amount)) || Number(input.amount)<0) throw new Error('서비스명, ID, 결제 금액을 확인해주세요.');
    }
    const password = String(form.get('password') ?? '');
    if (password.length>4096) throw new Error('비밀번호는 4096자 이하로 입력해주세요.');
    const { data, error } = await client.rpc('manage_external_account', {p_id: form.get('id') || null, p_version: form.get('updated_at') || null, p_input: input, p_ciphertext: password ? encryptAccountPassword(password) : null, p_delete: remove});
    if (error) throw new Error('저장에 실패했습니다. 최신 데이터를 새로고침하고 입력값과 DB 설정을 확인해주세요.');
    revalidatePath('/admin/external-accounts');
    return { success: true, id: data as string, message: remove ? '삭제했습니다.' : '저장했습니다.' };
  } catch (e) { return {success: false, message: e instanceof Error ? e.message : '처리하지 못했습니다.'}; }
}
export async function revealExternalAccount(id: string, action: 'view' | 'copy') {
  try {
    if (!validUuid(id) || !['view','copy'].includes(action)) throw new Error('계정과 열람 작업을 확인해주세요.');
    const client = await adminClient();
    const result = await client.rpc('reveal_external_account', {p_id: id, p_action: action});
    if (result.error || typeof result.data !== 'string') throw new Error('비밀번호를 열람하지 못했습니다. 관리자 로그인과 DB 설정을 확인해주세요.');
    const password = decryptAccountPassword(result.data);
    revalidatePath('/admin/external-accounts');
    return {password, message: '열람 기록을 저장했습니다.'};
  } catch(e) { return { message: e instanceof Error ? e.message : '열람하지 못했습니다.' }; }
}
