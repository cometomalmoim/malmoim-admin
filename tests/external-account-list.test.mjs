import {test} from 'node:test';
import assert from 'node:assert/strict';
import {filterExternalAccounts,paymentBadge,nextPaymentDate} from '../src/lib/external-account-list.ts';
const account={id:'one',service_name:'Canva',login_id:'team@example.com',manager_person_id:'manager',primary_manager:'legacy',department:'archived-department',category:'archived-category',sub_manager:'backup',billing_cycle:'monthly',next_billing_date:'2026-11-21',renewal_notice_days:7};
const members=[{user_id:'manager',display_name:'김담당'},{user_id:'backup',display_name:'Old backup'}];
test('search matches service, ID and single manager name, excluding removed fields and backup',()=>{
  for(const query of ['canva',' TEAM@EXAMPLE.COM ','김담당'])assert.equal(filterExternalAccounts([account],members,query).length,1);
  for(const query of ['archived-department','archived-category','Old backup'])assert.equal(filterExternalAccounts([account],members,query).length,0);
});
test('payment badge appears for any active billing date, including dates beyond the warning window',()=>{
  assert.deepEqual(paymentBadge(account,'2026-10-21'),{label:'결제 D-31',warning:false});
  assert.deepEqual(paymentBadge(account,'2026-11-21'),{label:'결제 D-0',warning:true});
  assert.deepEqual(paymentBadge(account,'2026-11-22'),{label:'결제 D-29',warning:false});
  for(const patch of [{billing_cycle:'none'},{billing_cycle:''},{next_billing_date:null},{next_billing_date:''}])assert.equal(paymentBadge({...account,...patch},'2026-10-21'),null);
});

test('recurrence advances to next month/year preserving month-end and leap anchors',()=>{
  for(const [anchor,cycle,today,expected] of [
    ['2026-10-01','monthly','2026-10-21','2026-11-01'],
    ['2026-01-31','monthly','2026-02-01','2026-02-28'],
    ['2026-01-31','monthly','2026-03-01','2026-03-31'],
    ['2024-02-29','yearly','2027-03-01','2028-02-29'],
    ['2024-02-29','yearly','2027-02-01','2027-02-28'],
    ['2020-12-31','monthly','2026-12-31','2026-12-31'],
    ['2020-12-31','yearly','2027-01-01','2027-12-31'],
    ['2026-02-30','monthly','2026-10-21',null],
    ['2026-01-01','monthly','invalid',null]
  ])assert.equal(nextPaymentDate(anchor,cycle,today),expected);
  assert.deepEqual(paymentBadge({...account,next_billing_date:'2026-10-01'},'2026-10-21'),{label:'결제 D-11',warning:false});
});
