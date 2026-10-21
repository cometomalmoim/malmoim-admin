import {renewalDays,type ExternalAccount,type AccountMember} from './external-account-types.ts';
export function filterExternalAccounts(accounts:ExternalAccount[],members:AccountMember[],query:string) {
  const keyword=query.trim().toLocaleLowerCase();
  const names=new Map(members.map(member=>[member.user_id,member.display_name]));
  return accounts.filter(account=>[account.service_name,account.login_id,names.get(account.manager_person_id||account.primary_manager||'')??''].some(value=>value.toLocaleLowerCase().includes(keyword)));
}
// Keep the original day as an anchor (Jan 31 -> Feb 28 -> Mar 31).
export function nextPaymentDate(anchor:string,cycle:string,today:string):string|null {
  const parse=(value:string)=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;const d=new Date(value+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value?d:null;};
  const start=parse(anchor),now=parse(today);
  if(!start||!now||!['monthly','yearly'].includes(cycle))return null;
  if(anchor>=today)return anchor;
  const year=start.getUTCFullYear(),month=start.getUTCMonth(),day=start.getUTCDate();
  const occurrence=(offset:number)=>{
    const d=new Date(start);
    d.setUTCDate(1);
    if(cycle==='monthly')d.setUTCFullYear(year,month+offset,1);
    else d.setUTCFullYear(year+offset,month,1);
    const last=new Date(d);last.setUTCMonth(last.getUTCMonth()+1,0);
    d.setUTCDate(Math.min(day,last.getUTCDate()));
    return d.toISOString().slice(0,10);
  };
  let offset=cycle==='monthly'?(now.getUTCFullYear()-year)*12+now.getUTCMonth()-month:now.getUTCFullYear()-year;
  let next=occurrence(offset);
  if(next<today)next=occurrence(++offset);
  return next;
}
export function paymentBadge(account:ExternalAccount,today:string) {
  if(!account.next_billing_date)return null;
  const next=nextPaymentDate(account.next_billing_date,account.billing_cycle,today);
  const days=renewalDays(next,today);
  if(days===null||!Number.isFinite(days)||days<0)return null;
  return {label:`결제 D-${days}`,warning:days<=account.renewal_notice_days};
}
