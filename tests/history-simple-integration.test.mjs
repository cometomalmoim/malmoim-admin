import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
const require=createRequire(import.meta.url),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
function load(file,stubs={}){const loaded={exports:{}};const code=ts.transpileModule(readFileSync(new URL('../'+file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;runInNewContext(code,{module:loaded,exports:loaded.exports,require:name=>Object.hasOwn(stubs,name)?stubs[name]:require(name)});return loaded.exports;}
const navigation=load('src/lib/admin-navigation.ts');
const {AdminView}=load('src/components/admin/admin-view.tsx',{
 'next/link':({children,...props})=>React.createElement('a',props,children),
 '@/lib/admin-navigation':navigation,
 './admin-shell':{AdminShell:({children})=>React.createElement('main',null,children)},
 './scoped-panel':{ScopedPanel:()=>React.createElement('div',null,'unrelated-panel')},
 './simple-history-photo-ui':{HistoryPhotoUi:()=>React.createElement('div',null,'simple-auth-rls-photo-manager')},
});
test('real admin history mounts simple manager, while preview and other pages retain their behavior',()=>{
 assert.match(renderToStaticMarkup(React.createElement(AdminView,{segments:['history']})),/simple-auth-rls-photo-manager/);
 assert.doesNotMatch(renderToStaticMarkup(React.createElement(AdminView,{segments:['history'],preview:true})),/simple-auth-rls-photo-manager/);
 assert.doesNotMatch(renderToStaticMarkup(React.createElement(AdminView,{segments:['events']})),/simple-auth-rls-photo-manager/);
});
