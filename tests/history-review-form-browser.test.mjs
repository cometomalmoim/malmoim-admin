import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createRequire} from 'node:module';import {runInNewContext} from 'node:vm';import ts from 'typescript';
const require=createRequire(import.meta.url);
test('Chrome: email search does not validate empty UUIDs; participant submit still does',{skip:!process.env.REVIEW_FORM_BROWSER_MODULE},async()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');const compiled={exports:{}};
 runInNewContext(ts.transpileModule(readFileSync('src/app/admin/history-review-access/review-access-manager.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{module:compiled,exports:compiled.exports,require:n=>n==='./actions'?{}:n==='next/link'?{default:props=>React.createElement('a',props)}:require(n)});
 const html=renderToStaticMarkup(React.createElement(compiled.exports.ReviewAccessManager));
 const {chromium}=await import(process.env.REVIEW_FORM_BROWSER_MODULE);const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage();await page.route('**/*',r=>r.abort());await page.setContent(html);
 await page.evaluate(()=>{window.invalidFields=[];document.addEventListener('invalid',e=>window.invalidFields.push(e.target.type),true);document.querySelector('form').addEventListener('submit',e=>e.preventDefault());const button=[...document.querySelectorAll('button')].find(b=>b.textContent==='회원 이메일 검색');button.addEventListener('click',()=>document.querySelector('input[type=email]').reportValidity());});
 assert.equal(await page.getByRole('button',{name:'회원 이메일 검색',exact:true}).getAttribute('type'),'button');
 await page.getByRole('button',{name:'회원 이메일 검색',exact:true}).click();assert.deepEqual(await page.evaluate(()=>window.invalidFields),['email']);
 await page.getByLabel('정확한 회원 이메일').fill('synthetic@example.invalid');await page.evaluate(()=>{window.invalidFields=[];});
 await page.getByRole('button',{name:'회원 이메일 검색',exact:true}).click();assert.deepEqual(await page.evaluate(()=>window.invalidFields),[]);
 await page.getByRole('button',{name:'회원·참가 이력 조회',exact:true}).click();assert.equal((await page.evaluate(()=>window.invalidFields)).length,2);
 assert.equal(await page.getByLabel('Auth 회원 ID',{exact:true}).inputValue(),'');assert.equal(await page.getByLabel('기존 참가자 ID',{exact:true}).inputValue(),'');
 }finally{await browser.close();}
});
