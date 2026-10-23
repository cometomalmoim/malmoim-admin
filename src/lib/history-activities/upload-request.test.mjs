import { policyModule } from './photo-policy.test-support.mjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {test} from 'node:test';
import ts from 'typescript';
function load(path,dependencies={}){
 const loaded={exports:{}};const {outputText}=ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
 runInNewContext(outputText,{module:loaded,exports:loaded.exports,Request,Response,File,Uint8Array,URL,
 require:name=>{if(name.endsWith('photo-policy'))return policyModule;if(name==='server-only')return {};assert.ok(Object.hasOwn(dependencies,name),`Unexpected dependency: ${name}`);return dependencies[name];}});
 return loaded.exports;
}
const moduleExports=load('./upload-request.ts');
const {createDisabledActivityUploadHandler}=moduleExports;
const uuid='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
function request(edit=()=>{},size=3,type='image/jpeg'){
 const form=new FormData();form.set('request_id',uuid);form.set('activity_id',uuid);form.set('file',new File([new Uint8Array(size)],'test.jpg',{type}));edit(form);
 return new Request('http://127.0.0.1:3003/api/admin/history/photos/upload',{method:'POST',headers:{Origin:'http://127.0.0.1:3003'},body:form});
}
const handler=status=>createDisabledActivityUploadHandler(async()=>({status}));
for(const [status,expected] of [['anonymous',401],['denied',403],['error',503]])test(`${status} fails closed before parsing body`,async()=>{const r=await handler(status)(request());assert.equal(r.status,expected);});
test('administrator valid request remains disabled and no fake completion is returned',async()=>{const r=await handler('admin')(request());assert.equal(r.status,503);assert.equal((await r.json()).code,'UPLOAD_DISABLED');assert.equal(r.headers.get('cache-control'),'private, no-store');});
test('cross-origin and missing origin denied without authentication calls',async()=>{for(const origin of [null,'http://evil.invalid']){const r=request();if(origin)r.headers.set('origin',origin);else r.headers.delete('origin');const result=await createDisabledActivityUploadHandler(async()=>{assert.fail('auth called');})(r);assert.equal(result.status,403);}});
for(const type of ['text/plain','image/svg+xml','application/octet-stream'])test(`reject ${type}`,async()=>{assert.equal((await handler('admin')(request(()=>{},1,type))).status,400);});
for(const type of ['image/jpeg','image/png','image/webp'])test(`declared ${type} still disabled, never verified or saved`,async()=>{assert.equal((await (await handler('admin')(request(()=>{},3,type))).json()).code,'UPLOAD_DISABLED');});
test('4.5MiB policy file and multipart overhead cannot fit the conservative route envelope',async()=>{
  for(const size of [policyModule.activityPhotoPolicy.maxBytes,policyModule.activityPhotoPolicy.maxBytes+1]){
    const original=request(()=>{},size);const bytes=await original.arrayBuffer();
    assert.ok(bytes.byteLength>size);
    const buffered=new Request(original.url,{method:'POST',headers:original.headers,body:bytes});
    const result=await handler('admin')(buffered);assert.equal(result.status,413);assert.equal((await result.json()).code,'BODY_TOO_LARGE');
  }
});
for(const field of ['completed','evidence','reporterContext','ticket','path','actor_id'])test(`forged ${field} rejected`,async()=>{assert.equal((await handler('admin')(request(f=>f.set(field,'true')))).status,400);});
test('duplicate files, malformed identity and empty file rejected',async()=>{assert.equal((await handler('admin')(request(f=>f.append('file',new File(['x'],'b.png',{type:'image/png'}))))).status,400);assert.equal((await handler('admin')(request(f=>f.set('activity_id','not-uuid')))).status,400);assert.equal((await handler('admin')(request(()=>{},0))).status,400);});
test('oversized streamed body rejected despite missing content-length',async()=>{const r=new Request('http://127.0.0.1:3003/api/admin/history/photos/upload',{method:'POST',headers:{Origin:'http://127.0.0.1:3003','Content-Type':'multipart/form-data; boundary=x'},body:new Uint8Array(4.5*1024*1024+65537)});assert.equal((await handler('admin')(r)).status,413);});
test('malformed multipart and raw auth errors produce safe responses',async()=>{const r=new Request('http://127.0.0.1:3003/api/admin/history/photos/upload',{method:'POST',headers:{Origin:'http://127.0.0.1:3003','Content-Type':'multipart/form-data; boundary=x'},body:'broken'});assert.equal((await handler('admin')(r)).status,400);const failed=await createDisabledActivityUploadHandler(async()=>{throw Error('PRIVATE_SECRET');})(request());assert.equal(failed.status,503);assert.ok(!(await failed.text()).includes('PRIVATE_SECRET'));});
test('real route wires existing auth and Node runtime, with no upload IO imports',async()=>{let auth=0;const route=load('../../app/api/admin/history/photos/upload/route.ts',{'@/lib/auth':{async getAdminAccess(){auth++;return {status:'admin'};}},'@/lib/history-activities/upload-request':moduleExports});assert.equal(route.runtime,'nodejs');assert.equal((await route.POST(request())).status,503);assert.equal(auth,1);});
test('existing admin helper calls getUser then only admin_users; no Storage or mutation',async()=>{const calls=[];const auth=load('../auth.ts',{'./supabase/server':{async createClient(){return {auth:{async getUser(){calls.push('getUser');return {data:{user:{id:uuid}},error:null};}},from(name){calls.push(name);assert.equal(name,'admin_users');return {select(column){assert.equal(column,'user_id');return {eq(column,id){assert.equal(column,'user_id');assert.equal(id,uuid);return {async maybeSingle(){return {data:{user_id:uuid},error:null};}};}};}};}};}}});assert.equal((await auth.getAdminAccess()).status,'admin');assert.deepEqual(calls,['getUser','admin_users']);});
