import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import * as model from '../src/lib/external-account-types.ts';

const require=createRequire(import.meta.url);
function load(file,mocks={}) {
  const {outputText}=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true,jsx:ts.JsxEmit.ReactJSX}});
  const loaded={exports:{}};
  runInNewContext(outputText,{module:loaded,exports:loaded.exports,require:name=>Object.hasOwn(mocks,name)?mocks[name]:require(name),console});
  return loaded.exports;
}
const {AccountRegistrationButton}=load('src/components/admin/account-registration-button.tsx');
const {ExternalAccountsWorkspace}=load('src/components/admin/external-accounts-workspace.tsx',{
  'next/navigation':{useRouter:()=>({refresh(){}})},
  '@/app/actions/external-accounts':{},
  '@/lib/external-account-types':model,
  './account-registration-button':{AccountRegistrationButton},
  './account-service-icon':{AccountServiceIcon:()=>null},
  './external-accounts.css':{},
});
for(const master of [true,false])test(`empty account list keeps registration visible for ${master?'Master':'Staff'}`,()=>{
  const html=renderToStaticMarkup(React.createElement(ExternalAccountsWorkspace,{accounts:[],members:[],logs:[],master,today:'2026-10-20'}));
  const button=html.match(/<button[^>]*>\+ 새 계정 등록<\/button>/)?.[0];
  assert.ok(button,'Registration action must remain visible even with no accounts');
  assert.equal(button.includes('disabled=""'),!master);
  if(!master){assert.match(button,/aria-describedby="ea-registration-reason"/);assert.match(html,/Master Admin만 가능합니다/);}
});
test('database configuration failure retains registration action and shows setup instructions',async()=>{
  const {ExternalAccountsView}=load('src/components/admin/external-accounts-view.tsx',{
    '@/lib/supabase/server':{createClient:async()=>{throw new Error('Missing configuration');}},
    './admin-shell':{AdminShell:({children})=>React.createElement('main',null,children)},
    './external-accounts-workspace':{ExternalAccountsWorkspace},
    './account-registration-button':{AccountRegistrationButton},
    './external-accounts.css':{},
  });
  const html=renderToStaticMarkup(await ExternalAccountsView({email:'synthetic@example.com'}));
  assert.match(html,/<button[^>]*disabled=""[^>]*>\+ 새 계정 등록<\/button>/);
  assert.match(html,/022_external_accounts.sql/);
  assert.match(html,/external_account_members/);
});
