import {renewalDays,type ExternalAccount,type AccountMember} from './external-account-types.ts';
export function filterExternalAccounts(accounts:ExternalAccount[],members:AccountMember[],query:string) {
  const keyword=query.trim().toLocaleLowerCase();
  const names=new Map(members.map(member=>[member.user_id,member.display_name]));
  return accounts.filter(account=>[account.service_name,account.login_id,names.get(account.primary_manager??'')??''].some(value=>value.toLocaleLowerCase().includes(keyword)));
}
export function paymentBadge(account:ExternalAccount,today:string) {
  if(!['monthly','yearly'].includes(account.billing_cycle)||!account.next_billing_date)return null;
  const days=renewalDays(account.next_billing_date,today);
  if(days===null||!Number.isFinite(days))return null;
  return {label:days<0?`결제 D+${-days}`:days===0?'오늘 결제':`결제 D-${days}`,warning:days<=account.renewal_notice_days};
}
