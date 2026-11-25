import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
const code=ts.transpileModule(readFileSync(new URL('../src/app/actions/participation-requests.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
function setup({result='saved',error=null,kind='daily',workerFails=false,afterFails=false}={}){
 const callbacks=[];let sends=0,refresh=0;const mod={exports:{}};const db={rpc:async()=>({data:result,error})};
 const deps={'@/lib/supabase/public':{createPublicClient:()=>db},'@/lib/supabase/server':{},'@/lib/auth':{},'@/lib/participation-requests':{participationInput:()=>({kind,token:'test-token',name:'test',details:{}})},'next/cache':{revalidatePath:()=>refresh++},'next/server':{after:fn=>{if(afterFails)throw Error('after');callbacks.push(fn);}},'@/lib/sms-worker':{processSmsQueue:async client=>{assert.equal(client,db);sends++;if(workerFails)throw Error('provider');}}};
 runInNewContext(code,{module:mod,exports:mod.exports,require:name=>deps[name]});return {submit:()=>mod.exports.submitParticipation({},new FormData()),callbacks,get sends(){return sends;},get refresh(){return refresh;}};
}
test('saved daily intake schedules notifications after the successful receipt',async()=>{const s=setup();const receipt=await s.submit();assert.equal(receipt.code,'saved');assert.equal(receipt.token,'test-token');assert.equal(s.sends,0);assert.equal(s.callbacks.length,1);await s.callbacks[0]();assert.equal(s.sends,1);assert.equal(s.refresh,1);});
test('rejected intake and exchange do not schedule daily alerts',async()=>{for(const opts of [{result:'duplicate'},{result:'closed'},{error:{}},{kind:'exchange'}]){const s=setup(opts);await s.submit();assert.equal(s.callbacks.length,0);assert.equal(s.sends,0);}});
test('provider or scheduling failure never loses the saved receipt',async()=>{const s=setup({workerFails:true});assert.equal((await s.submit()).code,'saved');await s.callbacks[0]();assert.equal((await setup({afterFails:true}).submit()).code,'saved');});
