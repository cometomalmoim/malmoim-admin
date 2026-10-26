import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
const source=ts.transpileModule(readFileSync(new URL('../src/components/admin/use-sms-delivery.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function harness(){
 const calls=[],timers=[],effects=[],cleanups=[];let reloads=0;
 const doc={visibilityState:'visible',addEventListener(){},removeEventListener(){}};
 const module={exports:{}};
 runInNewContext(source,{module,exports:module.exports,document:doc,Date,Map,setInterval:fn=>{timers.push(fn);return 1;},clearInterval:()=>{},require:key=>key==='react'?{useRef:v=>({current:v}),useState:v=>[v,()=>{}],useEffect:fn=>effects.push(fn)}:{refreshSms:async id=>{calls.push(id);return {ok:true};}}});
 return {calls,timers,doc,cleanups,async mount(rows,enabled=true){module.exports.useSmsDelivery(rows,async()=>{reloads++;},enabled);for(const fn of effects.splice(0)){const cleanup=fn();if(cleanup)cleanups.push(cleanup);}await new Promise(r=>setImmediate(r));},reloads:()=>reloads};
}
test('only accepted jobs are checked automatically, with shared query cooldown',async()=>{
 const h=harness();await h.mount([{id:'a',state:'accepted'},{id:'b',state:'failed'},{id:'c',state:'unknown'},{id:'d',state:'delivered'}]);
 assert.deepEqual(h.calls,['a']);assert.equal(h.reloads(),1);
 await h.mount([{id:'a',state:'accepted'}]);assert.deepEqual(h.calls,['a']);
 h.cleanups.forEach(fn=>fn());await h.timers[0]();assert.deepEqual(h.calls,['a']);
});
test('hidden pages and busy result views do not query the provider',async()=>{
 const hidden=harness();hidden.doc.visibilityState='hidden';await hidden.mount([{id:'a',state:'accepted'}]);assert.equal(hidden.calls.length,0);
 const busy=harness();await busy.mount([{id:'a',state:'accepted'}],false);assert.equal(busy.calls.length,0);
});
