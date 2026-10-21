import {test} from 'node:test';
import assert from 'node:assert/strict';
import {externalAccountInput} from '../src/lib/external-account-input.ts';
import {logExternalAccountError,externalAccountErrorMessage} from '../src/lib/external-account-errors.ts';
function form(){const f=new FormData();f.set('service_name','Canva');f.set('service_url','https://canva.com');f.set('login_id','synthetic@example.com');return f;}
test('optional billing fields receive valid SQL defaults instead of empty strings',()=>{
  const input=externalAccountInput(form());assert.equal(input.billing_cycle,'monthly');assert.equal(input.amount,'0');assert.equal(input.currency,'KRW');assert.equal(input.renewal_notice_days,'7');assert.equal(input.category,'other');
});
test('reject invalid dates, UUIDs, numeric precision and enum values before RPC',()=>{
  for(const [key,value] of [['next_billing_date','2026-02-30'],['primary_manager','invalid'],['amount','-1'],['amount','1.234'],['amount','1000000000000'],['renewal_notice_days','91'],['currency','INVALID'],['billing_cycle','INVALID']]){const f=form();f.set(key,value);assert.throws(()=>externalAccountInput(f),key);}
});
test('server DB logs preserve diagnostics but remove failing row values and explicit secrets',t=>{
  const logs=[];t.mock.method(console,'error',(...args)=>logs.push(args));
  const reference=logExternalAccountError('create',{code:'23502',message:'null value in column "service_name" violates not-null constraint',details:'Failing row contains (private-login, private-ciphertext).',hint:'private-password'},['private-password','private-ciphertext']);
  assert.equal(logs[0][1].code,'23502');assert.match(logs[0][1].message,/not-null/);assert.equal(logs[0][1].reference,reference);
  assert.ok(!JSON.stringify(logs).includes('private-login'));assert.ok(!JSON.stringify(logs).includes('private-password'));assert.ok(!JSON.stringify(logs).includes('private-ciphertext'));
  assert.ok(!externalAccountErrorMessage({code:'23502'},reference).includes('private-'));
});
