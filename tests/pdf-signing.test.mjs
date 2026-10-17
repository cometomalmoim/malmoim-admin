import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PDFDocument, PDFName, PDFNumber, degrees, decodePDFRawStream } from 'pdf-lib';
import { parseSettings, toPdf } from '../src/lib/pdf-fields.ts';
import { activityFields, activityPdfSha256, inkPath, koreaDate, requireSigningReady, signingSnapshot, testParticipant, validInk } from '../src/lib/pdf-signing.ts';
import { signedPreviewPdf } from '../src/lib/pdf-signing-pdf.ts';

const ink = [[{ x:.1,y:.7 },{ x:.2,y:.2 },{ x:.3,y:.65 },{ x:.8,y:.3 }]];
const answers = { media:false,rules:true,consequences:true,refund:true };
const pageInfo = (rotation, n=1, unit=1) => {
  const p = {pageNumber:n,rotation,userUnit:unit,viewBox:[20,30,470,670],width:450,height:640,transform:[1,0,0,-1,-20,670]};
  if(rotation===90)Object.assign(p,{width:640,height:450,transform:[0,1,1,0,-30,-20]});
  if(rotation===180)Object.assign(p,{transform:[-1,0,0,1,470,-30]});
  if(rotation===270)Object.assign(p,{width:640,height:450,transform:[0,-1,-1,0,670,470]});
  p.width*=unit;p.height*=unit;p.transform=p.transform.map(v=>v*unit);return p;
};
async function fixture(){
  const doc=await PDFDocument.create();const pages=[0,90,180,270].map((rotation,i)=>{
    const p=doc.addPage([500,700]);p.setCropBox(20,30,450,640);p.setRotation(degrees(rotation));if(i===2)p.node.set(PDFName.of('UserUnit'),PDFNumber.of(2));return pageInfo(rotation,i+1,i===2?2:1);
  });
  const original=await doc.save();const digest=await crypto.subtle.digest('SHA-256',original);const fingerprint=Buffer.from(digest).toString('hex');
  const fields=pages.flatMap(p=>['signature','name','date'].map((kind,i)=>({id:`${p.pageNumber}-${kind}`,kind,pageNumber:p.pageNumber,rect:toPdf({x:.15,y:.2+i*.2,width:.45,height:.1},p)})));
  return {original,settings:{version:1,fingerprint,pages,fields}};
}
test('backward-compatible settings keep legacy signatures and accept typed fields',()=>{
  const p=pageInfo(0);const base={version:1,fingerprint:'same',pages:[p],fields:[{id:'old',pageNumber:1,rect:toPdf({x:.1,y:.2,width:.3,height:.1},p)}]};
  assert.deepEqual(parseSettings(JSON.stringify(base),'same',[p]),base.fields);
  for(const kind of ['signature','name','date']){const v={...base,fields:[{...base.fields[0],kind}]};assert.equal(parseSettings(JSON.stringify(v),'same',[p])[0].kind,kind);}
  assert.throws(()=>parseSettings(JSON.stringify({...base,fields:[{...base.fields[0],kind:'email'}]}),'same',[p]));
});
test('media decline is independent; unanswered media, missing confirmations, blank ink and fields block',()=>{
  const fields=['name','date','signature'].map(kind=>({kind}));
  assert.doesNotThrow(()=>requireSigningReady(answers,ink,fields,true));
  assert.doesNotThrow(()=>requireSigningReady({...answers,media:true},ink,fields,true));
  for(const id of ['media','rules','consequences','refund'])assert.throws(()=>requireSigningReady({...answers,[id]:id==='media'?null:false},ink,fields,true));
  assert.throws(()=>requireSigningReady(answers,ink,fields,false));
  assert.throws(()=>requireSigningReady(answers,[],fields,true));
  for(const missing of ['name','date','signature'])assert.throws(()=>requireSigningReady(answers,ink,fields.filter(f=>f.kind!==missing),true));
});
test('signature ink validates motion, finite bounded points and complexity',()=>{
  assert.equal(validInk(ink),true);assert.equal(validInk([[{x:.5,y:.5}]]),false);
  for(const invalid of [[[{x:NaN,y:.1},{x:.5,y:.1}]],[[{x:-1,y:0}]],Array(81).fill(ink[0]),[Array(4001).fill(ink[0][0])]])assert.equal(validInk(invalid),false);
  assert.match(inkPath(ink),/^M90.00 210.00 L180.00 60.00/);
});
test('Korean date crosses UTC midnight and review snapshot does not mutate with edits',async()=>{
  assert.equal(koreaDate('2026-10-16T15:01:00.000Z'),'2026-10-17');assert.throws(()=>koreaDate('bad'));
  const {settings}=await fixture();const a={...answers},i=structuredClone(ink);const snap=signingSnapshot(settings,a,i,true,'2026-10-16T12:00:00Z');a.media=true;i[0][0].x=.9;settings.fields[0].kind='date';
  assert.equal(snap.answers.media,false);assert.equal(snap.ink[0][0].x,.1);assert.equal(snap.settings.fields[0].kind,'signature');
});
test('reference placement only applies to exact uploaded document',()=>{
  assert.deepEqual(activityFields(activityPdfSha256).map(f=>f.kind),['name','signature','date']);assert.throws(()=>activityFields('different'));
});
test('PDF keeps original pages/crop/rotation, inserts same ink at all rotations/UserUnit and appends responses',async()=>{
  const {original,settings}=await fixture();const before=original.slice();const snap=signingSnapshot(settings,answers,ink,true,'2026-10-16T12:00:00Z');
  const font=new Uint8Array(await readFile(new URL('../public/fonts/NanumGothic-Regular.ttf',import.meta.url)));
  const result=await signedPreviewPdf(original,snap,font);const doc=await PDFDocument.load(result);assert.equal(doc.getPageCount(),5);assert.deepEqual(original,before);
  const expected={0:[1,0,0,1],90:[0,1,-1,0],180:[-1,0,0,-1],270:[0,-1,1,0]};
  for(let n=0;n<4;n++){
    const p=doc.getPage(n);assert.equal(p.getRotation().angle,n*90);assert.deepEqual(p.getCropBox(),{x:20,y:30,width:450,height:640});
    const streams=p.node.Contents();const text=Array.from({length:streams.size()},(_,i)=>new TextDecoder().decode(decodePDFRawStream(streams.lookup(i)).decode())).join('\n');
    assert.match(text,/90 210 m/);assert.match(text,/180 60 l/);assert.ok(text.includes('BT'),'name/date text');
    const rotation=expected[n*90];
    const matrices=[...text.matchAll(/([-\d.eE]+) ([-\d.eE]+) ([-\d.eE]+) ([-\d.eE]+) ([-\d.eE]+) ([-\d.eE]+) cm/g)].map(m=>m.slice(1,5).map(Number));
    assert.ok(matrices.some(matrix=>matrix.every((value,i)=>Math.abs(value-rotation[i])<1e-9)),'drawing rotation matches the page');
  }
  assert.equal(doc.getTitle(),'말모임 전자서명 테스트 PDF');
});
test('PDF rejects mismatched file, tampered page transform/date and non-test participant',async()=>{
  const {original,settings}=await fixture();const snap=signingSnapshot(settings,answers,ink,true,'2026-10-16T12:00:00Z');const font=new Uint8Array(await readFile(new URL('../public/fonts/NanumGothic-Regular.ttf',import.meta.url)));
  for(const change of [s=>{s.originalSha256='wrong'},s=>{s.date='2000-01-01'},s=>{s.participant={...testParticipant,name:'실제 사용자'}},s=>{s.settings.pages[0].transform[4]+=1},s=>{s.answers.media=null}]){const s=structuredClone(snap);change(s);await assert.rejects(()=>signedPreviewPdf(original,s,font));}
});
