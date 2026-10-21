'use server';
import { revalidatePath } from 'next/cache';
import { getAdminAccess } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { encryptAccountPassword, decryptAccountPassword } from '@/lib/external-account-crypto';
import { externalAccountInput } from '@/lib/external-account-input';
import { logExternalAccountError, externalAccountErrorMessage } from '@/lib/external-account-errors';
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
    const id=String(form.get('id')??'');
    const version=String(form.get('updated_at')??'');
    if((id&&!validUuid(id))||(remove&&!id)||(id&&!Number.isFinite(Date.parse(version))))throw new Error('계정 정보를 새로고침한 뒤 다시 시도해주세요.');
    const input = remove?{}:externalAccountInput(form);
    const password = String(form.get('password') ?? '');
    if (password.length>4096) throw new Error('비밀번호는 4096자 이하로 입력해주세요.');
    if(!remove&&!id&&!password)throw new Error('신규 계정의 비밀번호를 입력해주세요.');
    const ciphertext=!remove&&password?encryptAccountPassword(password):null;
    const { data, error } = await client.rpc('manage_external_account', {p_id:id||null,p_version:id?version:null,p_input:input,p_ciphertext:ciphertext,p_delete:remove});
    if(error){const reference=logExternalAccountError(remove?'delete':id?'update':'create',error,[password,ciphertext??'']);return {success:false,message:externalAccountErrorMessage(error,reference)};}
    revalidatePath('/admin/external-accounts');
    return { success: true, id: data as string, message: remove ? '삭제했습니다.' : '저장했습니다.' };
  } catch (e) { return {success: false, message: e instanceof Error ? e.message : '처리하지 못했습니다.'}; }
}
export async function revealExternalAccount(id: string, action: 'view' | 'copy') {
  try {
    if (!validUuid(id) || !['view','copy'].includes(action)) throw new Error('계정과 열람 작업을 확인해주세요.');
    const client = await adminClient();
    const result = await client.rpc('reveal_external_account', {p_id: id, p_action: action});
    if(result.error){const reference=logExternalAccountError(action,result.error);return {message:externalAccountErrorMessage(result.error,reference)};}
    if(typeof result.data !== 'string') throw new Error('비밀번호를 열람하지 못했습니다. 관리자 로그인과 DB 설정을 확인해주세요.');
    const password = decryptAccountPassword(result.data);
    revalidatePath('/admin/external-accounts');
    return {password, message: '열람 기록을 저장했습니다.'};
  } catch(e) { return { message: e instanceof Error ? e.message : '열람하지 못했습니다.' }; }
}
