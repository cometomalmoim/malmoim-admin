import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import * as accountInput from '../src/lib/external-account-input.ts';
import * as accountErrors from '../src/lib/external-account-errors.ts';
const require=createRequire(import.meta.url);
function actions({access='admin',master=false,rpcError=null}={}){
  const calls=[];
  const mocks={
    'next/cache':{revalidatePath:path=>calls.push(['refresh',path])},
    '@/lib/auth':{getAdminAccess:async()=>({status:access})},
    '@/lib/supabase/server':{createClient:async()=>({rpc:async(name,input)=>{calls.push([name,input]);return name==='external_account_master'?{data:master}:rpcError?{error:rpcError}:{data:'11111111-1111-4111-8111-111111111111'};}})},
    '@/lib/external-account-crypto':{encryptAccountPassword:()=> 'encrypted-test-ciphertext',decryptAccountPassword:()=> 'synthetic-revealed-password'},
    '@/lib/external-account-types':{accountCategories:{design:'디자인'}},
    '@/lib/external-account-input':accountInput,
    '@/lib/external-account-errors':accountErrors,
    '@/lib/resource-validation':{validUuid:value=>/^[a-f\d-]{36}$/.test(value)},
  };
  const {outputText}=ts.transpileModule(readFileSync('src/app/actions/external-accounts.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}});
  const loaded={exports:{}};
  runInNewContext(outputText,{module:loaded,exports:loaded.exports,require:name=>Object.hasOwn(mocks,name)?mocks[name]:require(name),URL});
  return {...loaded.exports,calls};
}
function form(id=''){
  const data=new FormData();
  for(const [key,value] of Object.entries({id,updated_at:id?'2026-10-21T00:00:00Z':'',service_name:'Canva',service_url:'https://canva.com',login_id:'synthetic@example.com',category:'design',password:'synthetic-only-password',amount:'0',created_by:'spoofed-user'}))data.set(key,value);
  return data;
}
test('Staff action allows new account creation and refresh without a Master check',async()=>{
  const a=actions();const result=await a.saveExternalAccount(form());
  assert.equal(result.success,true);
  assert.ok(!a.calls.some(([name])=>name==='external_account_master'));
  const input=a.calls.find(([name])=>name==='manage_external_account')[1];
  assert.equal(input.p_id,null);assert.equal(input.p_delete,false);
  assert.equal(input.p_ciphertext,'encrypted-test-ciphertext');
  assert.ok(!Object.hasOwn(input.p_input,'created_by'));
  assert.ok(a.calls.some(([name])=>name==='refresh'));
});
test('Staff action edits an existing account without a Master check',async()=>{
  const a=actions();assert.equal((await a.saveExternalAccount(form('11111111-1111-4111-8111-111111111111'))).success,true);
  assert.ok(a.calls.some(([name])=>name==='manage_external_account'));assert.ok(!a.calls.some(([name])=>name==='external_account_master'));
});
test('Staff action still blocks deletion',async()=>{
  const a=actions();const result=await a.saveExternalAccount(form('11111111-1111-4111-8111-111111111111'),true);
  assert.equal(result.success,false);assert.ok(!a.calls.some(([name])=>name==='manage_external_account'));
});
for(const kind of ['view','copy'])test(`Staff action reveals for ${kind} without MFA APIs or a code`,async()=>{
  const a=actions();const result=await a.revealExternalAccount('11111111-1111-4111-8111-111111111111',kind);
  assert.equal(result.password,'synthetic-revealed-password');
  assert.ok(a.calls.some(([name,input])=>name==='reveal_external_account'&&input.p_action===kind));
  assert.ok(!a.calls.some(([name])=>name==='external_account_master'));
});
test('non-admin cannot request password decryption',async()=>{
  const a=actions({access:'denied'});assert.equal((await a.revealExternalAccount('11111111-1111-4111-8111-111111111111','view')).password,undefined);assert.equal(a.calls.length,0);
});
test('ordinary signed-in users cannot create through the action',async()=>{
  const a=actions({access:'denied'});assert.equal((await a.saveExternalAccount(form())).success,false);assert.equal(a.calls.length,0);
});
test('missing DB column logs the original error code on the server and returns an actionable migration message',async t=>{
  const logs=[];t.mock.method(console,'error',(...args)=>logs.push(args));
  const a=actions({rpcError:{code:'42703',message:'column created_by does not exist',details:null,hint:'check schema'}});
  const result=await a.saveExternalAccount(form());
  assert.equal(result.success,false);assert.match(result.message,/repair_external_accounts.sql/);
  assert.equal(logs[0][1].code,'42703');assert.equal(logs[0][1].message,'column created_by does not exist');assert.equal(logs[0][1].details,null);
  assert.ok(!JSON.stringify(logs).includes('synthetic-only-password'));assert.ok(!JSON.stringify(logs).includes('encrypted-test-ciphertext'));
});
