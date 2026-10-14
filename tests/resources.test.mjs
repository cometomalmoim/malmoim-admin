import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PDF_LIMIT, validatePdf, safeLink, resourceInput } from '../src/lib/resource-validation.ts';
const pdf=(body='')=>new TextEncoder().encode(`%PDF-1.7\n${body}\n%%EOF`);
test('PDF 형식과 크기 제한, 실행 콘텐츠 차단',()=>{
 assert.equal(validatePdf('test.pdf','application/pdf',pdf()),null);
 assert.ok(validatePdf('test.html','application/pdf',pdf()));
 assert.ok(validatePdf('test.pdf','text/html',pdf()));
 assert.ok(validatePdf('test.pdf','application/pdf',new Uint8Array(PDF_LIMIT+1)));
 assert.ok(validatePdf('test.pdf','application/pdf',new TextEncoder().encode('not pdf')));
 for(const body of ['/JavaScript','/JS','/Launch','/EmbeddedFile','/ObjStm','/Encrypt','/#4AavaScript'])assert.ok(validatePdf('x.pdf','application/pdf',pdf(body)));
 assert.ok(validatePdf('x.pdf','application/pdf',new TextEncoder().encode('%PDF-1.7 no trailer')));
});
test('외부 링크 프로토콜 및 자격 증명 차단',()=>{
 assert.equal(safeLink('https://example.com/video'),true);
 for(const value of ['javascript:alert(1)','file:///tmp/x','https://user:password@example.com','bad'])assert.equal(safeLink(value),false);
});
test('누적 주차는 기수 내 회차와 분리, 잘못된 정수 거부',()=>{
 const data=new FormData();data.set('title','검증용 자료');data.set('kind','english');data.set('season','2');data.set('session_number','1');data.set('cumulative_week','7');
 const result=resourceInput(data);assert.equal(result.session_number,1);assert.equal(result.cumulative_week,7);assert.equal(result.season,2);
 data.set('cumulative_week','-1');assert.throws(()=>resourceInput(data));
 data.set('cumulative_week','1.5');assert.throws(()=>resourceInput(data));
 data.set('cumulative_week','');assert.equal(resourceInput(data).cumulative_week,null);
 data.set('event_id','fake');assert.throws(()=>resourceInput(data));
});

 test('실제 PDF 구조 파싱과 위조 파일 거부',async()=>{
 const { PDFDocument }=await import('pdf-lib');
 const { pdfStructure }=await import('../src/lib/pdf-validation.ts');
 const document=await PDFDocument.create();document.addPage();
 const bytes=await document.save({useObjectStreams:false});
 assert.equal(await pdfStructure(bytes),null);
 assert.ok(await pdfStructure(pdf()));
 document.addJavaScript('test','app.alert("test")');
 assert.ok(await pdfStructure(await document.save({useObjectStreams:false})));
});
