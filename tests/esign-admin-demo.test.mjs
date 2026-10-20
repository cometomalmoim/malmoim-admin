import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import * as model from '../src/lib/document-admin-model.ts';
import {documentAdminFixtures} from '../src/lib/document-admin-fixtures.ts';
import {previewKstDate} from '../src/lib/esign-preview-date.ts';
import {consentItems} from '../src/lib/pdf-signing.ts';
const require=createRequire(import.meta.url);
function load(file,mocks,extra={}){
 const js=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const m={exports:{}};runInNewContext(js,{module:m,exports:m.exports,require:n=>Object.hasOwn(mocks,n)?mocks[n]:n==='server-only'?{}:n.startsWith('@/')||n.startsWith('.')?{}:require(n),Response,Request,URL,process,...extra});return m.exports;
}
function protectedPage(status){let demoCalls=0;const Demo=()=>{demoCalls++;};
 const page=load('src/components/admin/protected-admin.tsx',{'@/lib/auth':{getAdminAccess:async()=>({status,email:'fake-admin'})},'@/components/document-admin/esign-admin-demo':{EsignAdminDemo:Demo},'next/server':{connection:async()=>{}},'next/navigation':{redirect:()=>{throw Error('LOGIN_REDIRECT');},notFound:()=>{throw Error('404');}}});return{...page,Demo,calls:()=>demoCalls};}
test('non-admin cannot receive demo component; anonymous redirects using shared auth',async()=>{
 for(const state of ['anonymous','denied','error']){const p=protectedPage(state);if(state==='anonymous')await assert.rejects(p.ProtectedAdmin({segments:['esign-demo']}),/LOGIN_REDIRECT/);else assert.notEqual((await p.ProtectedAdmin({segments:['esign-demo']})).type,p.Demo);assert.equal(p.calls(),0);}
});
test('authenticated admin routes to explicit browser demo without accessing application services',async()=>{const p=protectedPage('admin'),element=await p.ProtectedAdmin({segments:['esign-demo']});assert.equal(element.type,p.Demo);assert.equal(element.props.email,'fake-admin');});
test('browser-only UI does not mount request API component or offer development-only preview link',()=>{
 const {DocumentAdminPreview}=load('src/components/document-admin/document-admin-preview.tsx',{
  '@/lib/document-admin-model':model,'@/lib/document-admin-fixtures':{documentAdminFixtures},'@/lib/esign-preview-date':{previewKstDate},'@/lib/pdf-signing':{consentItems},
  'next/link':{default:({children,href})=>React.createElement('a',{href},children)},'./signing-target-preview':{SigningTargetPreview:()=>{throw Error('request component must not mount');}},'./document-admin.module.css':{},
 });
 const html=renderToStaticMarkup(React.createElement(DocumentAdminPreview,{browserOnly:true}));
 assert.match(html,/개발용 시연 \/ 실제 신청자 정보 없음 \/ 문자 발송 없음 \/ PDF 영구 저장 없음/);
 assert.match(html,/가상 참가자 01/);assert.match(html,/서류 템플릿/);assert.doesNotMatch(html,/합격자 요청 준비|\/preview\/pdf-fields/);
});
function assetHandler(status){let reads=0;const {GET}=load('src/app/admin/esign-demo/assets/[...asset]/route.ts',{'@/lib/auth':{getAdminAccess:async()=>({status})},'node:fs/promises':{readFile:async()=>{reads++;return new Uint8Array([1]);}}});return{GET,reads:()=>reads};}
test('renderer assets fail closed before disk read for every non-admin',async()=>{for(const state of ['anonymous','denied','error']){const a=assetHandler(state);assert.equal((await a.GET(new Request('http://localhost'),{params:Promise.resolve({asset:['build','pdf.worker.min.mjs']})})).status,403);assert.equal(a.reads(),0);}});
test('admin renderer assets allow local PDF resources, reject traversal and scripting engine',async()=>{const a=assetHandler('admin');for(const asset of [['..','secret'],['wasm','quickjs-eval.js'],['build','other.mjs'],['build','x','y']])assert.equal((await a.GET(null,{params:Promise.resolve({asset})})).status,404);assert.equal(a.reads(),0);const result=await a.GET(null,{params:Promise.resolve({asset:['build','pdf.worker.min.mjs']})});assert.equal(result.status,200);assert.equal(result.headers.get('cache-control'),'no-store');assert.equal(a.reads(),1);});
