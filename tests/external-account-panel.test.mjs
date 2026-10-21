import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import React from 'react';
import * as list from '../src/lib/external-account-list.ts';

const require=createRequire(import.meta.url);
const account={id:'11111111-1111-4111-8111-111111111111',service_name:'Canva',service_url:'https://canva.com',login_id:'synthetic@example.com',primary_manager:null,billing_cycle:'none',amount:0,currency:'KRW',next_billing_date:null,renewal_notice_days:7,notes:'Original memo',updated_at:'2026-10-21T00:00:00Z'};
// Drive the actual event handlers and hook state without a browser, auth session or live writes.
function harness(name,initialProps){
  const state=[];let index=0;let props=initialProps;
  const hooks={...React,useState:initial=>{const slot=index++;if(!(slot in state))state[slot]=typeof initial==='function'?initial():initial;return [state[slot],next=>{state[slot]=typeof next==='function'?next(state[slot]):next;}];},useRef:initial=>{const slot=index++;return state[slot]??(state[slot]={current:initial});},useMemo:fn=>fn(),useEffect:()=>{},useTransition:()=>[false,fn=>fn()]};
  const mocks={react:hooks,'next/navigation':{useRouter:()=>({refresh(){}})},'@/app/actions/external-accounts':{},'@/lib/external-account-list':list,'./account-service-icon':{AccountServiceIcon:()=>null},'./account-registration-button':{AccountRegistrationButton:()=>null},'./external-accounts.css':{}};
  const {outputText}=ts.transpileModule(readFileSync('src/components/admin/external-accounts-workspace.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true,jsx:ts.JsxEmit.ReactJSX}});
  const loaded={exports:{}};
  class SyntheticFormData extends FormData {constructor(){super();this.set('id',account.id);}}
  runInNewContext(outputText,{module:loaded,exports:loaded.exports,require:key=>Object.hasOwn(mocks,key)?mocks[key]:require(key),FormData:SyntheticFormData,console});
  return {render(){index=0;return loaded.exports[name](props);},props(next){props=next;}};
}
function nodes(tree,predicate){const result=[];function visit(node){if(!React.isValidElement(node))return;if(predicate(node))result.push(node);React.Children.forEach(node.props.children,visit);}visit(tree);return result;}
const button=(tree,label)=>nodes(tree,node=>node.type==='button'&&node.props.children===label)[0];
test('no initial selection; clicking a row opens detail and closing clears selection/focus',()=>{
  const h=harness('ExternalAccountsWorkspace',{accounts:[account],members:[],logs:[],master:false,today:'2026-10-21'});
  let tree=h.render();assert.equal(nodes(tree,node=>node.type?.name==='AccountDetail').length,0);
  let focused=0;
  nodes(tree,node=>node.type==='button'&&node.props.className==='ea-row')[0].props.onClick({currentTarget:{isConnected:true,focus(){focused++;}}});
  tree=h.render();const detail=nodes(tree,node=>node.type?.name==='AccountDetail')[0];assert.equal(detail.props.account.id,account.id);
  detail.props.onClose();tree=h.render();assert.equal(nodes(tree,node=>node.type?.name==='AccountDetail').length,0);assert.equal(focused,1);
});
test('edit enables fields; cancel resets form and uses latest server data without saving',()=>{
  let saves=0;
  const props={account,members:[],logs:[],master:false,pending:false,onSave:async()=>{saves++;return true;},onClose(){}};
  const h=harness('AccountDetail',props);let tree=h.render();
  assert.equal(nodes(tree,node=>node.type==='fieldset')[0].props.disabled,true);
  button(tree,'수정').props.onClick();tree=h.render();assert.equal(nodes(tree,node=>node.type==='fieldset')[0].props.disabled,false);
  assert.ok(button(tree,'저장'));assert.ok(button(tree,'취소'));
  h.props({...props,account:{...account,notes:'Updated remotely',updated_at:'2026-10-21T01:00:00Z'}});
  tree=h.render();assert.equal(nodes(tree,node=>node.type==='input'&&node.props.name==='updated_at')[0].props.value,account.updated_at,'edit retains original revision to detect conflicts');
  const before=nodes(tree,node=>node.type==='form')[0].key;
  button(tree,'취소').props.onClick();tree=h.render();
  assert.equal(nodes(tree,node=>node.type==='fieldset')[0].props.disabled,true);assert.ok(button(tree,'수정'));assert.equal(saves,0);
  assert.notEqual(nodes(tree,node=>node.type==='form')[0].key,before);
  assert.equal(nodes(tree,node=>node.type==='textarea')[0].props.defaultValue,'Updated remotely');
});
for(const success of [false,true])test(`save ${success?'success returns to view':'failure retains draft and form'}`,async()=>{
  const h=harness('AccountDetail',{account,members:[],logs:[],master:false,pending:false,onSave:async()=>success,onClose(){}});
  button(h.render(),'수정').props.onClick();let tree=h.render();const form=nodes(tree,node=>node.type==='form')[0];
  await form.props.onSubmit({preventDefault(){},currentTarget:{}});tree=h.render();
  assert.equal(nodes(tree,node=>node.type==='fieldset')[0].props.disabled,success);
  if(!success)assert.equal(nodes(tree,node=>node.type==='form')[0].key,form.key);
});
