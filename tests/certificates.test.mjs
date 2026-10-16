import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {PDFDocument,degrees} from 'pdf-lib';
import {unzipSync} from 'fflate';
import {certificateSameOrigin,identity,selectCandidates,attendedFirst,collectPages,demoCandidates,defaultPlacement,placement} from '../src/lib/certificate-model.ts';
import {certificatePdf,certificateZip} from '../src/lib/certificate-pdf.ts';
const font = new Uint8Array(await readFile(new URL('../public/fonts/NanumGothic-Regular.ttf',import.meta.url)));
test('동명이인은 복합 식별자로 구분하고 참석자 우선; 원본 조회는 상태 보존',()=>{
 assert.equal(demoCandidates[0].name,demoCandidates[1].name);
 assert.notEqual(identity(demoCandidates[0]),identity(demoCandidates[1]));
 assert.equal(selectCandidates(demoCandidates,[identity(demoCandidates[0])])[0].attendance,'unrecorded');
 assert.equal(attendedFirst(demoCandidates)[0].attendance,'attended');
 assert.throws(()=>selectCandidates(demoCandidates,[identity(demoCandidates[0]),identity(demoCandidates[0])]));
 assert.throws(()=>selectCandidates(demoCandidates,['other-event:manual:id']));
});
test('25명과 DB 응답 제한을 넘는 전체 페이지 조회',async()=>{
 const rows=Array.from({length:1032},(_,id)=>({id}));const calls=[];
 const all=await collectPages(async(a,b)=>{calls.push([a,b]);return rows.slice(a,b+1);},500);
 assert.equal(all.length,1032);assert.deepEqual(calls,[[0,499],[500,999],[1000,1499]]);
});
test('위치와 크기·정렬·배치 입력 경계',()=>{
 for(const p of [{...defaultPlacement,x:NaN},{...defaultPlacement,y:101},{...defaultPlacement,size:0},{...defaultPlacement,align:'bad'}])assert.throws(()=>placement(p));
 assert.throws(()=>selectCandidates(demoCandidates,[]));
});
test('가상 한글 PDF와 32명 ZIP, 동명이인 파일 보존',async()=>{
 const bytes=await certificatePdf('홍길동 김민수',defaultPlacement,font,undefined,true);
 const doc=await PDFDocument.load(bytes);assert.equal(doc.getPageCount(),1);
 await mkdir('work/certificates',{recursive:true});await writeFile('work/certificates/sample.pdf',bytes);
 const files=[];for(const p of demoCandidates)files.push({id:`${p.source}-${p.application_id}`,bytes:await certificatePdf(p.name,defaultPlacement,font,undefined,true)});
 const zip=certificateZip(files);assert.equal(Object.keys(unzipSync(zip)).length,32);await writeFile('work/certificates/batch.zip',zip);
});
test('PDF/PNG 배경 지원, 원본 PDF 페이지 크기 보존, 회전·다중페이지 거부',async()=>{
 const original=await PDFDocument.create();original.addPage([700,900]);const bytes=await original.save();
 const pdf=await certificatePdf('이예원',defaultPlacement,font,{bytes,mime:'application/pdf'});
 const result=await PDFDocument.load(pdf);assert.equal(result.getPages()[0].getWidth(),700);
 const png=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j4ZkAAAAASUVORK5CYII=','base64'));
 assert.equal((await PDFDocument.load(await certificatePdf('김민수',defaultPlacement,font,{bytes:png,mime:'image/png'},true))).getPageCount(),1);
 original.getPages()[0].setRotation(degrees(90));const rotated=await original.save();await assert.rejects(()=>certificatePdf('김민수',defaultPlacement,font,{bytes:rotated,mime:'application/pdf'}));original.getPages()[0].setRotation(degrees(0));original.addPage(); const multi=await original.save(); await assert.rejects(()=>certificatePdf('김민수',defaultPlacement,font,{bytes:multi,mime:'application/pdf'}));
});
test('페이지 밖 이름·지원하지 않는 글자·제어문자 차단',async()=>{
 await assert.rejects(()=>certificatePdf('홍길동',{...defaultPlacement,x:0},font));
 await assert.rejects(()=>certificatePdf('홍\n길동',defaultPlacement,font));
 await assert.rejects(()=>certificatePdf('😀',defaultPlacement,font));
});
test('JPG 이미지 배경과 오른쪽·왼쪽 정렬',async()=>{
 const jpg=new Uint8Array(Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAKAAoDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3OiiipJP/2Q==','base64'));
 for(const align of ['left','right']){
  const pdf=await certificatePdf('이예원',{...defaultPlacement,align},font,{bytes:jpg,mime:'image/jpeg'},true);
  assert.equal((await PDFDocument.load(pdf)).getPageCount(),1);
 }
});

test('로컬 서버 별칭 및 동일 출처 허용, 타 출처·프로토콜·Origin 누락 거부',()=>{
 const h=new Headers({host:'127.0.0.1:3108',origin:'http://127.0.0.1:3108','x-forwarded-proto':'http'});
 assert.equal(certificateSameOrigin(h,'http://localhost:3108/api/admin/certificates'),true);
 h.set('origin','https://evil.example');assert.equal(certificateSameOrigin(h,'http://localhost:3108'),false);
 h.set('origin','https://127.0.0.1:3108');assert.equal(certificateSameOrigin(h,'http://localhost:3108'),false);
 h.delete('origin');assert.equal(certificateSameOrigin(h,'http://localhost:3108'),false);
});
