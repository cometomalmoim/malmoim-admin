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
    // Creation is available to every registered admin; existing records remain master-only.
    const client = form.get('id') || remove ? await masterClient() : await adminClient();
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
export async function revealExternalAccount(id: string, action: 'view' | 'copy', code: string) {
  try {
    if (!['view','copy'].includes(action) || !/^\d{6}$/.test(code)) throw new Error('인증기의 6자리 코드를 입력해주세요.');
    const client = await masterClient();
    const factors = await client.auth.mfa.listFactors();
    const factor = factors.data?.totp.find(f => f.status === 'verified');
    if (!factor) throw new Error('Supabase MFA 인증기를 먼저 등록해주세요. 설정 안내를 확인해주세요.');
    const verified = await client.auth.mfa.challengeAndVerify({factorId: factor.id, code});
    if (verified.error) throw new Error('인증 코드가 만료되었거나 올바르지 않습니다.');
    const result = await client.rpc('reveal_external_account', {p_id: id, p_action: action});
    if (result.error || typeof result.data !== 'string') throw new Error('열람 권한 또는 인증을 확인해주세요. 코드는 한 번만 사용할 수 있습니다.');
    const password = decryptAccountPassword(result.data);
    revalidatePath('/admin/external-accounts');
    return {password, message: '인증과 열람 기록 저장을 완료했습니다.'};
  } catch(e) { return { message: e instanceof Error ? e.message : '열람하지 못했습니다.' }; }
}
export async function enrollAccountAuthenticator() {
  try {
    const client = await masterClient();
    const factors = await client.auth.mfa.listFactors();
    if (factors.error) throw new Error('인증기 목록을 확인하지 못했습니다.');
    if (factors.data.totp.some(f=>f.status==='verified')) throw new Error('이미 등록된 인증기를 사용해주세요.');
    for (const factor of factors.data.all.filter(f=>f.factor_type==='totp'&&f.status==='unverified')) await client.auth.mfa.unenroll({factorId:factor.id});
    const result = await client.auth.mfa.enroll({factorType:'totp',friendlyName:'외부 서비스 계정'});
    if(result.error) throw new Error('인증기를 등록하지 못했습니다.');
    return {factorId:result.data.id,qr:result.data.totp.qr_code,message:'인증기로 QR을 스캔하고 6자리 코드를 입력하세요.'};
  } catch(e) {return {message:e instanceof Error?e.message:'등록하지 못했습니다.'};}
}
export async function verifyAccountAuthenticator(factorId:string,code:string) {
  try {
    const client=await masterClient();
    if(!/^\d{6}$/.test(code)) throw new Error('6자리 인증 코드를 입력하세요.');
    const result=await client.auth.mfa.challengeAndVerify({factorId,code});
    if(result.error) throw new Error('인증 코드를 확인해주세요.');
    return {success:true,message:'인증기를 등록했습니다. 다음 코드로 열람해주세요.'};
  } catch(e) {return {success:false,message:e instanceof Error?e.message:'인증하지 못했습니다.'};}
}
