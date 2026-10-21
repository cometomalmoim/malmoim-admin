import { createClient } from '@/lib/supabase/server';
import { AdminShell } from './admin-shell';
import { ExternalAccountsWorkspace } from './external-accounts-workspace';
import { AccountRegistrationButton } from './account-registration-button';
import './external-accounts.css';
import type { ExternalAccount, AccountMember, AccountLog } from '@/lib/external-account-types';

export async function ExternalAccountsView({email}: {email: string}) {
  async function all<T>(table: string, order: string): Promise<T[]> {
    const client = await createClient();
    const rows:T[]=[];
    for(let offset=0;;offset+=500) {
      const result=await client.from(table).select('*').order(order).range(offset,offset+499);
      if(result.error) throw new Error('External accounts query failed');
      rows.push(...result.data as T[]);
      if(result.data.length<500) return rows;
    }
  }
  let data: { accounts: ExternalAccount[]; members: AccountMember[]; logs: AccountLog[]; master: boolean } | null = null;
  try {
    const client = await createClient();
    const [accounts,members,profiles,master] = await Promise.all([all<ExternalAccount>('external_accounts','id'),all<AccountMember>('external_account_members','user_id'),all<{user_id:string;display_name:string}>('admin_profiles','user_id'),client.rpc('external_account_master')]);
    if(master.error) throw new Error('Role query failed');
    // Bounded recent feed, with explicit ordering; older records remain in the database.
    const logs=await client.from('account_access_logs').select('*').order('created_at',{ascending:false}).order('id',{ascending:false}).limit(500);
    if(logs.error) throw new Error('Audit query failed');
    data={accounts,members:members.map(m=>({...m,display_name:profiles.find(p=>p.user_id===m.user_id)?.display_name??m.user_id})),logs:logs.data as AccountLog[],master:master.data===true};
  } catch { /* Render the data failure outside the query boundary. */ }
  const content=data ? <ExternalAccountsWorkspace {...data} today={new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date())}/> : <><div className="ea-toolbar"><AccountRegistrationButton allowed={false} reason="DB 연결과 외부 계정 테이블을 확인한 뒤 등록할 수 있습니다."/></div><section className="ops-panel" role="alert"><h2>계정 정보를 불러오지 못했습니다</h2><p>Supabase 연결 설정 및 <code>supabase/022_external_accounts.sql</code> 및 <code>supabase/043_external_account_creation.sql</code>, <code>supabase/044_external_account_initial_access.sql</code> 적용 여부를 확인해주세요.</p><p>초기 운영 단계에서는 모든 관리자가 계정을 등록·조회·수정하고 MFA 없이 비밀번호를 볼 수 있습니다. 삭제만 Master 역할이 필요합니다.</p></section></>;
  return <AdminShell current="external-accounts" title="외부 서비스 계정 관리" email={email}><div className="ops-heading"><h1>외부 서비스 계정 관리</h1><p>계정과 구독을 함께 관리합니다. 초기 운영 단계에서는 추가 인증 없이 비밀번호를 확인할 수 있습니다.</p></div>{content}</AdminShell>;
}
