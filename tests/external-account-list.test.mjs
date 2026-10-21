import {test} from 'node:test';
import assert from 'node:assert/strict';
import {filterExternalAccounts,paymentBadge} from '../src/lib/external-account-list.ts';
const account={id:'one',service_name:'Canva',login_id:'team@example.com',primary_manager:'manager',department:'archived-department',category:'archived-category',sub_manager:'backup',billing_cycle:'monthly',next_billing_date:'2026-11-21',renewal_notice_days:7};
const members=[{user_id:'manager',display_name:'김담당'},{user_id:'backup',display_name:'Old backup'}];
test('search matches service, ID and single manager name, excluding removed fields and backup',()=>{
  for(const query of ['canva',' TEAM@EXAMPLE.COM ','김담당'])assert.equal(filterExternalAccounts([account],members,query).length,1);
  for(const query of ['archived-department','archived-category','Old backup'])assert.equal(filterExternalAccounts([account],members,query).length,0);
});
test('payment badge appears for any active billing date, including dates beyond the warning window',()=>{
  assert.deepEqual(paymentBadge(account,'2026-10-21'),{label:'결제 D-31',warning:false});
  assert.deepEqual(paymentBadge(account,'2026-11-21'),{label:'오늘 결제',warning:true});
  assert.deepEqual(paymentBadge(account,'2026-11-22'),{label:'결제 D+1',warning:true});
  for(const patch of [{billing_cycle:'none'},{billing_cycle:''},{next_billing_date:null},{next_billing_date:''}])assert.equal(paymentBadge({...account,...patch},'2026-10-21'),null);
});
