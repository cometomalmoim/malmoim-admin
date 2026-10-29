import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import * as campaigns from '../src/lib/message-campaigns.ts';
const code=ts.transpileModule(readFileSync(new URL('../src/components/admin/messaging-recipients.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
test('load more appends applicants and keeps selections through loading and filter changes',async()=>{
 const values=[],deps=[],effects=[];let cursor=0,tree,selected=[],fail=false;
 const row=n=>({id:String(n),source:'season9',name:'Person '+n,contact:'01012345678',contact_type:'phone',status:'received'});
 const mod={exports:{}};const element=(type,props)=>({type,props});
 const react={useState:initial=>{const i=cursor++;if(!(i in values))values[i]=initial;return [values[i],next=>{values[i]=typeof next==='function'?next(values[i]):next;}];},useEffect:(fn,next)=>{const i=cursor++;if(!deps[i]||next.some((v,j)=>v!==deps[i][j])){deps[i]=next;effects.push(fn);}}};
 runInNewContext(code,{module:mod,exports:mod.exports,require:key=>({'react':react,'@/lib/message-campaigns':campaigns,'react/jsx-runtime':{jsx:element,jsxs:element},'@/app/actions/message-applicants':{loadMessageApplicants:async(event,page)=>fail?{kind:'error'}:{kind:'ready',count:50,rows:page===1?Array.from({length:25},(_,i)=>row(i)):Array.from({length:25},(_,i)=>row(i+25))}},'@/lib/applicant-validation':{applicationStatuses:{received:'접수'},paymentStatuses:{unknown:'미확인'}},'@/lib/sms-contract':{domesticPhone:v=>v}})[key]});
 function render(){cursor=0;tree=mod.exports.MessagingRecipients({eventId:'event',onSelect:r=>{selected=r;}});}
 async function settle(){render();for(const fn of effects.splice(0))fn();await new Promise(r=>setImmediate(r));render();}
 function all(node,out=[]){if(Array.isArray(node)){node.forEach(n=>all(n,out));}else if(node&&typeof node==='object'){out.push(node);all(node.props?.children,out);}return out;}
 function button(text){return all(tree).find(n=>n.type==='button'&&n.props.children===text);}
 await settle();let checks=all(tree).filter(n=>n.type==='input'&&n.props.type==='checkbox');assert.equal(checks.length,25);
 checks[0].props.onChange({target:{checked:true}});render();button('신청자 더보기').props.onClick();render();assert.equal(all(tree).filter(n=>n.type==='input'&&n.props.type==='checkbox').length,25);
 await settle();checks=all(tree).filter(n=>n.type==='input'&&n.props.type==='checkbox');assert.equal(checks.length,50);assert.equal(checks[0].props.checked,true);assert.equal(selected.length,1);
 const status=all(tree).find(n=>n.type==='select');status.props.onChange({target:{value:'received'}});await settle();assert.equal(selected.length,1);assert.equal(all(tree).find(n=>n.type==='input'&&n.props.type==='checkbox').props.checked,true);
 fail=true;button('신청자 더보기').props.onClick();await settle();assert.equal(selected.length,1);assert.equal(all(tree).filter(n=>n.type==='input'&&n.props.type==='checkbox').length,25);assert.ok(button('다시 시도'));
});
