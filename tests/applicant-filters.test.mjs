import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
const code=ts.transpileModule(readFileSync(new URL('../src/components/admin/applicant-filters.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
function setup(){
 const mod={exports:{}};let state;
 const el=(type,props,key)=>({type,props,key});
 runInNewContext(code,{module:mod,exports:mod.exports,require:name=>({
  react:{useState:initial=>{state??=initial;return [state,next=>{state=typeof next==='function'?next(state):next;}];}},
  'react/jsx-runtime':{jsx:el,jsxs:el},'next/link':{default:'a'},
  '@/lib/applicant-languages':{applicantLanguageLevels:{basic:'기초'}},'@/lib/attribution':{trafficSources:{naver:'네이버'}},
  '@/lib/applicant-validation':{applicationStatuses:{received:'접수'},paymentStatuses:{unknown:'미확인'}}
 })[name]});
 const all=(n,out=[])=>{if(Array.isArray(n))n.forEach(v=>all(v,out));else if(n&&typeof n==='object'){out.push(n);all(n.props?.children,out);}return out;};
 function render(query,slug){const tree=mod.exports.ApplicantFilters({query,slug,events:[{id:'party',title:'할로윈'}],cohort:true,hasFilters:!!Object.keys(query).length,resetHref:'/admin/recruitment'});return {tree,nodes:all(tree),field:name=>all(tree).find(n=>n.props?.name===name&&n.type!=='input' || n.props?.name===name&&n.props?.type!=='hidden')};}
 return render;
}
test('repeated event search/reset keeps one stable form and resets controlled values',()=>{
 const render=setup();const initial=render({});
 initial.field('q').props.onChange({target:{value:'draft'}});
 assert.equal(render({}).field('q').props.value,'draft');
 for(let i=0;i<5;i++){
  const result=render({event:'party',q:'saved',payment:'unknown'});
  assert.equal(result.nodes.filter(n=>n.type==='form').length,1);
  assert.equal(result.tree.type,initial.tree.type);assert.equal(result.tree.key,undefined);
  assert.equal(result.field('event').props.value,'party');assert.equal(result.field('q').props.value,'saved');
  const reset=render({});assert.equal(reset.tree.key,undefined);assert.equal(reset.field('q').props.value,'');assert.equal(reset.field('event').props.value,'');
 }
});
test('archived, nationality and cohort context survives GET submission; event-specific form omits event picker',()=>{
 const render=setup();const query={archived:'1',nationality_group:'foreign',preferred_class:'saturday',korean:'basic',english:'basic'};
 const result=render(query,'season9');
 assert.equal(result.tree.props.method,'get');
 for(const key of ['archived','nationality_group','preferred_class'])assert.equal(result.nodes.find(n=>n.type==='input'&&n.props.name===key).props.value,query[key]);
 assert.equal(result.nodes.some(n=>n.type==='select'&&n.props.name==='event'),false);
 assert.equal(result.field('korean').props.value,'basic');assert.equal(result.field('english').props.value,'basic');
});
