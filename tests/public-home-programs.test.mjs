import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
function load(file) {
 const m={exports:{}};
 const {outputText}=ts.transpileModule(readFileSync(new URL('../'+file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}});
 runInNewContext(outputText,{module:m,exports:m.exports,Date,require:name=>load('src/lib/'+name.slice(2)+'.ts')});
 return m.exports;
}
const {homePrograms,homePhotos,isHomeProgramOpen}=load('src/lib/public-home-content.ts');
test('program label closes at the exact recruitment deadline and respects disabled/hidden state',()=>{
 const p=homePrograms[0],deadline=Date.parse(p.closesAt);
 assert.equal(isHomeProgramOpen(p,deadline-1),true);
 assert.equal(isHomeProgramOpen(p,deadline),false);
 assert.equal(isHomeProgramOpen(p,deadline+1),false);
 assert.equal(isHomeProgramOpen({...p,intakeEnabled:false},deadline-1),false);
 assert.equal(isHomeProgramOpen({...p,visible:false},deadline-1),false);
 assert.equal(isHomeProgramOpen({...p,closesAt:'invalid'},deadline-1),false);
});
test('localized program links resolve to existing routes and all selected photos exist with both locale descriptions',()=>{
 for(const p of homePrograms){for(const locale of ['ko','en'])assert.ok(existsSync(new URL('../src/app'+p.href[locale]+'/page.tsx',import.meta.url)));}
 const paths=new Set();for(const p of Object.values(homePhotos)){assert.ok(!paths.has(p.src));paths.add(p.src);assert.ok(existsSync(new URL('../public'+p.src,import.meta.url)));assert.ok(p.alt.ko&&p.alt.en);}
});
