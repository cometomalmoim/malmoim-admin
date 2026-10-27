import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
const code=ts.transpileModule(readFileSync(new URL('../src/components/admin/applicant-more.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
test('global applicant table stays mounted as more rows append and fetch errors preserve existing rows',async()=>{
 let cursor=0,tree,fail=false;const values=[],deps=[],effects=[];
 const row=n=>({id:String(n),source:'season9'}),initial=Array.from({length:20},(_,i)=>row(i)),query={};
 const Table=()=>null,mod={exports:{}};const el=(type,props,key)=>({type,props,key});
 const react={useState:v=>{const i=cursor++;if(!(i in values))values[i]=v;return [values[i],n=>{values[i]=typeof n==='function'?n(values[i]):n;}];},useRef:v=>{const i=cursor++;if(!(i in values))values[i]={current:v};return values[i];},useEffect:(fn,next)=>{const i=cursor++;if(!deps[i]||next.some((v,j)=>v!==deps[i][j])){deps[i]=next;effects.push(fn);}}};
 runInNewContext(code,{module:mod,exports:mod.exports,require:key=>({'react':react,'react/jsx-runtime':{jsx:el,jsxs:el},'./applicant-table':{ApplicantTable:Table},'@/lib/applicant-selection':{applicantKey:r=>r.source+':'+r.id},'@/app/actions/applicant-more':{loadMoreApplicants:async()=>{if(fail)throw Error('offline');return {rows:Array.from({length:20},(_,i)=>row(i+20)),count:60};}}})[key]});
 function render(){cursor=0;tree=mod.exports.ApplicantMore({rows:initial,count:60,query,archived:false});}
 function all(node,out=[]){if(Array.isArray(node))node.forEach(n=>all(n,out));else if(node&&typeof node==='object'){out.push(node);all(node.props?.children,out);}return out;}
 function table(){return all(tree).find(n=>n.type===Table);}
 async function settle(){render();for(const fn of effects.splice(0))fn();await new Promise(r=>setImmediate(r));render();}
 await settle();const before=table();assert.equal(before.props.rows.length,20);
 await all(tree).find(n=>n.type==='button').props.onClick();await settle();assert.equal(table().props.rows.length,40);assert.equal(table().type,before.type);assert.equal(table().key,before.key);assert.equal(table().props.expanded,true);
 fail=true;await all(tree).find(n=>n.type==='button').props.onClick();await settle();assert.equal(table().props.rows.length,40);assert.ok(all(tree).some(n=>n.props?.role==='alert'));
});
