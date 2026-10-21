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
function harness(name,initialProps,options={}){
  const transitions=[];let refreshes=0;
  const state=[];let index=0;let props=initialProps;
  const hooks={...React,useState:initial=>{const slot=index++;if(!(slot in state))state[slot]=typeof initial==='function'?initial():initial;return [state[slot],next=>{state[slot]=typeof next==='function'?next(state[slot]):next;}];},useRef:initial=>{const slot=index++;return state[slot]??(state[slot]={current:initial});},useMemo:fn=>fn(),useEffect:()=>{},useTransition:()=>[false,fn=>{transitions.push(fn());}]};
  const mocks={react:hooks,'next/navigation':{useRouter:()=>({refresh(){refreshes++;}})},'@/app/actions/external-accounts':options.actions??{},'@/lib/external-account-list':list,'./account-service-icon':{AccountServiceIcon:()=>null},'./account-registration-button':{AccountRegistrationButton:()=>null},'./external-accounts.css':{}};
  const {outputText}=ts.transpileModule(readFileSync('src/components/admin/external-accounts-workspace.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true,jsx:ts.JsxEmit.ReactJSX}});
  const loaded={exports:{}};
  class SyntheticFormData extends FormData {constructor(){super();this.set('id',account.id);}}
  runInNewContext(outputText,{module:loaded,exports:loaded.exports,require:key=>Object.hasOwn(mocks,key)?mocks[key]:require(key),FormData:SyntheticFormData,console,window:{confirm:options.confirm??(()=>false)}});
  return {async flush(){await Promise.all(transitions);},refreshes:()=>refreshes,render(){index=0;return loaded.exports[name](props);},props(next){props=next;}};
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

for(const confirmed of [false,true])test(`delete in edit mode requires confirmation (${confirmed})`,async()=>{
  const calls=[];let prompt='';
  const h=harness('AccountDetail',{account,members:[],logs:[],master:false,pending:false,onSave:async(form,remove)=>{calls.push({form,remove});return true;}},{confirm:message=>{prompt=message;return confirmed;}});
  assert.equal(button(h.render(),'계정 삭제'),undefined);
  button(h.render(),'수정').props.onClick();const tree=h.render();
  await button(tree,'계정 삭제').props.onClick({currentTarget:{form:{}}});
  assert.equal(prompt,'정말로 이 계정 정보를 삭제하시겠습니까?');assert.equal(calls.length,confirmed?1:0);
  if(confirmed)assert.equal(calls[0].remove,true);
});
test('password view/hide toggles immediately; hide makes no additional access request',async()=>{
  let reads=0;
  const h=harness('AccountDetail',{account,members:[],logs:[],master:false,pending:false,onSave:async()=>true},{actions:{revealExternalAccount:async()=>{reads++;return {password:'synthetic-secret',message:'Recorded'};}}});
  button(h.render(),'보기').props.onClick();await h.flush();let tree=h.render();
  assert.equal(nodes(tree,n=>n.type==='output')[0].props.children,'synthetic-secret');
  button(tree,'숨기기').props.onClick();tree=h.render();
  assert.equal(nodes(tree,n=>n.type==='output')[0].props.children,'••••••••');assert.ok(button(tree,'보기'));assert.equal(reads,1);
});
test('successful deletion closes detail, refreshes list and announces success toast',async()=>{
  const h=harness('ExternalAccountsWorkspace',{accounts:[account],members:[],logs:[],master:true,today:'2026-10-21'},{actions:{saveExternalAccount:async()=>({success:true,message:'삭제했습니다.'})}});
  nodes(h.render(),n=>n.type==='button'&&n.props.className==='ea-row')[0].props.onClick({currentTarget:{}});
  const detail=nodes(h.render(),n=>n.type?.name==='AccountDetail')[0];
  await detail.props.onSave(new FormData(),true);
  const tree=h.render();assert.equal(nodes(tree,n=>n.type?.name==='AccountDetail').length,0);
  assert.equal(h.refreshes(),1);assert.equal(nodes(tree,n=>n.props.className==='ea-toast')[0].props.children,'계정을 삭제했습니다.');
});
test('People profiles populate assignee options while legacy admins remain archival',()=>{
 const person='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
 const h=harness('AccountDetail',{members:[{user_id:person,display_name:'피플 프로필',active:true},{user_id:'archived',display_name:'비활동 운영진',active:false},{user_id:'old',display_name:'Legacy admin',legacy:true}],logs:[],master:false,pending:false,onSave:async()=>true});
 const select=nodes(h.render(),n=>n.type==='select'&&n.props.name==='manager_person_id')[0];
 assert.ok(select);const options=nodes(select,n=>n.type==='option');assert.equal(options.length,2);assert.equal(options[1].props.value,person);assert.equal(options[1].props.children,'피플 프로필');
});

test('edit form follows the six-row compact two-column field order',()=>{
 const h=harness('AccountDetail',{account,members:[],logs:[],master:false,pending:false,onSave:async()=>true});
 button(h.render(),'수정').props.onClick();const tree=h.render();
 const fields=nodes(tree,n=>n.type==='fieldset')[0];assert.match(fields.props.className,/grid-cols-2/);
 assert.deepEqual(nodes(fields,n=>['input','select','textarea'].includes(n.type)).map(n=>n.props.name),['service_name','service_url','login_id','password','manager_person_id','renewal_notice_days','billing_cycle','amount','currency','next_billing_date','notes']);
 assert.ok(button(tree,'계정 삭제'));assert.ok(button(tree,'저장'));assert.ok(button(tree,'취소'));
 const labels=nodes(fields,n=>n.type==='label');assert.equal(labels.filter(n=>n.props.className==='ea-full').length,1);
});
