import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import * as model from '../src/lib/external-account-types.ts';
import * as list from '../src/lib/external-account-list.ts';

const require=createRequire(import.meta.url);
function load(file,mocks={}) {
  const {outputText}=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true,jsx:ts.JsxEmit.ReactJSX}});
  const loaded={exports:{}};
  runInNewContext(outputText,{module:loaded,exports:loaded.exports,require:name=>Object.hasOwn(mocks,name)?mocks[name]:require(name),console});
  return loaded.exports;
}
const {AccountRegistrationButton}=load('src/components/admin/account-registration-button.tsx');
const {ExternalAccountsWorkspace,AccountDetail}=load('src/components/admin/external-accounts-workspace.tsx',{
  'next/navigation':{useRouter:()=>({refresh(){}})},
  '@/app/actions/external-accounts':{},
  '@/lib/external-account-types':model,
  '@/lib/external-account-list':list,
  './account-registration-button':{AccountRegistrationButton},
  './account-service-icon':{AccountServiceIcon:()=>null},
  './external-accounts.css':{},
});
for(const master of [true,false])test(`empty account list keeps registration visible for ${master?'Master':'Staff'}`,()=>{
  const html=renderToStaticMarkup(React.createElement(ExternalAccountsWorkspace,{accounts:[],members:[],logs:[],master,today:'2026-10-20'}));
  const button=html.match(/<button[^>]*>\+ 새 계정 등록<\/button>/)?.[0];
  assert.ok(button,'Registration action must remain visible even with no accounts');
  assert.equal(button.includes('disabled=""'),false);
  assert.match(html,/모든 관리자가 새 계정을 등록할 수 있습니다/);
  assert.doesNotMatch(html,/계정 등록은 Master Admin만 가능합니다/);
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
  assert.match(html,/044_external_account_initial_access.sql/);
});
test('Staff detail opens read-only with edit and password actions, no removed fields or MFA',()=>{
  const account={id:'11111111-1111-4111-8111-111111111111',created_by:null,service_name:'Canva',service_url:'https://canva.com',login_id:'synthetic@example.com',category:'design',department:'다른 부서',primary_manager:null,sub_manager:null,billing_cycle:'none',payment_method:'',amount:0,currency:'KRW',next_billing_date:null,renewal_notice_days:7,notes:'',updated_at:'2026-10-21T00:00:00Z'};
  const html=renderToStaticMarkup(React.createElement(AccountDetail,{account,members:[],logs:[],master:false,pending:false,onSave:async()=>true,onClose:()=>{}}));
  assert.match(html,/<button[^>]*>보기<\/button>/);assert.match(html,/<button[^>]*>복사하기<\/button>/);
  assert.match(html,/>수정<\/button>/);assert.match(html,/••••••••/);assert.match(html,/계정 상세 닫기/);
  assert.match(html,/<fieldset[^>]*disabled/);
  assert.doesNotMatch(html,/인증기|일회용 코드|Master Admin만|계정 삭제|카테고리|공유 부서|백업 담당자|카드 별칭/);
});
test('initial list shows only service, single manager and valid payment badge, with no selected detail',()=>{
  const account={id:'one',service_name:'Canva',service_url:'https://canva.com',login_id:'hidden-login@example.com',category:'design',department:'hidden department',primary_manager:'manager',sub_manager:'backup',billing_cycle:'monthly',next_billing_date:'2026-11-21',renewal_notice_days:7};
  const html=renderToStaticMarkup(React.createElement(ExternalAccountsWorkspace,{accounts:[account],members:[{user_id:'manager',display_name:'김담당'}],logs:[],master:false,today:'2026-10-21'}));
  assert.match(html,/Canva/);assert.match(html,/김담당/);assert.match(html,/결제 D-31/);
  assert.match(html,/목록에서 계정을 선택하면 상세 정보가 표시됩니다/);
  assert.doesNotMatch(html,/hidden-login@example.com|hidden department|카테고리|공유 부서|백업 담당자|카드 별칭|aria-label="계정 상세 닫기"/);
});
