import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
const data=JSON.parse(readFileSync(new URL('../src/lib/history-instagram/data.json',import.meta.url),'utf8'));
const evidence=JSON.parse(readFileSync(new URL('../docs/photo-production/instagram/source-manifest.json',import.meta.url),'utf8'));
const module={exports:{}};
runInNewContext(ts.transpileModule(readFileSync(new URL('../src/lib/history-instagram/archive.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,{module,exports:module.exports,require:()=>data});
const {instagramHistoryPhotos}=module.exports;
test('archive contains real source-backed images for all nine seasons with no remote image dependencies',()=>{
 assert.equal(data.length,9);assert.equal(data.reduce((n,a)=>n+a.photos.length,0),59);
 assert.equal(new Set(data.map(a=>a.cohort)).size,9);
 const sources=new Set(evidence.albums.flatMap(a=>a.photos.map(p=>p.sourceUrl)));
 for(const a of data){
  assert.equal(a.photos.length>0&&a.photos.length<=10,true);
  assert.ok(a.schedule.label.ko&&a.schedule.label.en);
  assert.ok(existsSync(new URL('../public'+a.schedule.posterSrc,import.meta.url)));
  for(const p of a.photos){assert.ok(sources.has(p.sourceUrl));assert.match(p.sourceUrl,/^https:\/\/www\.instagram\.com\/cometomalmoim\/p\/[\w-]+\/$/);assert.ok(existsSync(new URL('../public'+p.src,import.meta.url)));assert.ok(p.width<=1600&&p.height<=1600);}
 }
});
test('poster dates take precedence over differing caption schedules without inventing individual photo dates',()=>{
 const bySeason=new Map(data.map(a=>[a.cohort,a]));
 assert.match(bySeason.get(2).schedule.label.ko,/09\.13–10\.18/);
 assert.equal(bySeason.get(4).schedule.label.ko,'2026.01.01–02.07');
 assert.equal(bySeason.get(6).schedule.label.ko,'2026.04.16–05.21');
 assert.match(bySeason.get(3).schedule.label.ko,/11월 둘째 주/);
 assert.equal(bySeason.get(8).schedule.label.ko,'2026.08.19부터 6주 · 수·토요일');
 for(const season of [2,3,4,6,8,9])assert.ok(evidence.albums.find(a=>a.cohort===season).schedule.discrepancy);
});
test('localized cohort albums preserve slide order, source links and explicit poster context',()=>{
 const ko=instagramHistoryPhotos('ko'),en=instagramHistoryPhotos('en');
 assert.equal(en[0].cohort,9);assert.equal(ko[0].title,'말모임 9기 활동 기록');assert.equal(en[0].title,'MALMOIM Season 9 moments');
 for(let i=0;i<9;i++){
  assert.equal(en[i].date,ko[i].date);assert.equal(en[i].src,ko[i].src);assert.equal(en[i].slidePhotos.length,ko[i].slidePhotos.length);
  assert.ok(en[i].archive.periodLabel);assert.match(en[i].archive.posterUrl,/instagram\.com/);
  for(let j=0;j<en[i].slidePhotos.length;j++)assert.equal(en[i].slidePhotos[j].sourceUrl,data[i].photos[j].sourceUrl);
 }
});
