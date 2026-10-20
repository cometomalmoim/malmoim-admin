import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
const require=createRequire(import.meta.url);
function actions({access='admin',master=false}={}){
  const calls=[];
  const mocks={
    'next/cache':{revalidatePath:path=>calls.push(['refresh',path])},
    '@/lib/auth':{getAdminAccess:async()=>({status:access})},
    '@/lib/supabase/server':{createClient:async()=>({rpc:async(name,input)=>{calls.push([name,input]);return name==='external_account_master'?{data:master}:{data:'11111111-1111-4111-8111-111111111111'};}})},
    '@/lib/external-account-crypto':{encryptAccountPassword:()=> 'encrypted-test-ciphertext'},
    '@/lib/external-account-types':{accountCategories:{design:'디자인'}},
    '@/lib/resource-validation':{},
  };
  const {outputText}=ts.transpileModule(readFileSync('src/app/actions/external-accounts.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}});
  const loaded={exports:{}};
  runInNewContext(outputText,{module:loaded,exports:loaded.exports,require:name=>Object.hasOwn(mocks,name)?mocks[name]:require(name),URL});
  return {...loaded.exports,calls};
}
function form(id=''){
  const data=new FormData();
  for(const [key,value] of Object.entries({id,service_name:'Canva',service_url:'https://canva.com',login_id:'synthetic@example.com',category:'design',password:'synthetic-only-password',amount:'0',created_by:'spoofed-user'}))data.set(key,value);
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
for(const remove of [false,true])test(`Staff action blocks ${remove?'delete':'edit'} before mutation`,async()=>{
  const a=actions();const result=await a.saveExternalAccount(form('11111111-1111-4111-8111-111111111111'),remove);
  assert.equal(result.success,false);assert.ok(!a.calls.some(([name])=>name==='manage_external_account'));
});
test('ordinary signed-in users cannot create through the action',async()=>{
  const a=actions({access:'denied'});assert.equal((await a.saveExternalAccount(form())).success,false);assert.equal(a.calls.length,0);
});
