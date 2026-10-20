import { createClient } from '@/lib/supabase/server';
import { AdminShell } from './admin-shell';
import { ExternalAccountsWorkspace } from './external-accounts-workspace';
import type { ExternalAccount, AccountMember, AccountLog } from '@/lib/external-account-types';

export async function ExternalAccountsView({email}: {email: string}) {
  const client = await createClient();
  async function all<T>(table: string, order: string): Promise<T[]> {
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
    const [accounts,members,profiles,master] = await Promise.all([all<ExternalAccount>('external_accounts','id'),all<AccountMember>('external_account_members','user_id'),all<{user_id:string;display_name:string}>('admin_profiles','user_id'),client.rpc('external_account_master')]);
    if(master.error) throw new Error('Role query failed');
    // Bounded recent feed, with explicit ordering; older records remain in the database.
    const logs=await client.from('account_access_logs').select('*').order('created_at',{ascending:false}).order('id',{ascending:false}).limit(500);
    if(logs.error) throw new Error('Audit query failed');
    data={accounts,members:members.map(m=>({...m,display_name:profiles.find(p=>p.user_id===m.user_id)?.display_name??m.user_id})),logs:logs.data as AccountLog[],master:master.data===true};
  } catch { /* Render the data failure outside the query boundary. */ }
  const content=data ? <ExternalAccountsWorkspace {...data} today={new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date())}/> : <section className="ops-panel" role="alert"><h2>계정 정보를 불러오지 못했습니다</h2><p>외부 계정 마이그레이션과 권한 설정을 확인해주세요.</p></section>;
  return <AdminShell current="external-accounts" title="외부 서비스 계정 관리" email={email}><div className="ops-heading"><h1>외부 서비스 계정 관리</h1><p>담당 계정과 구독을 관리하고, 민감한 정보는 인증 후 확인하세요.</p></div>{content}</AdminShell>;
}
