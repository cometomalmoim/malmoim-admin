import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { consentItems, inkPath, koreaDate, requireSigningReady, type ConsentAnswers, type Ink } from './pdf-signing.ts';
import type { PdfFieldSettings } from './pdf-fields.ts';
export type DemoDocument={bytes:Uint8Array;settings:PdfFieldSettings};
const fontBytes=()=>readFile('public/fonts/NanumGothic-Regular.ttf');
export async function createDemoDocument():Promise<DemoDocument>{
 const doc=await PDFDocument.create();doc.registerFontkit(fontkit);const font=await doc.embedFont(await fontBytes(),{subset:false});const p=doc.addPage([595,842]);
 const text=(s:string,y:number,size=12)=>p.drawText(s,{x:40,y,font,size,color:rgb(.08,.18,.15)});
 text('말모임 개발 전용 테스트 동의서',790,22);text('실제 활동 동의서 원본이 아닙니다. 실제 개인정보·서명 입력 금지.',760,11);
 text('이 문서는 관리자 → 참가자 → 완료 PDF 연결 시연만을 위한 문서입니다.',735,10);
 for(const [i,item]of consentItems.entries()){
  text(`${i+1}. ${item.title} ${item.optional?'(선택 · 거절 가능)':'(필수 확인)'}`,690-i*75,13);
  let line='',y=667-i*75;for(const char of item.text){if(font.widthOfTextAtSize(line+char,10)>510){text(line,y,10);line='';y-=16;}line+=char;}text(line,y,10);
 }
 for(const [title,y]of [['이름',350],['날짜 (한국 시간)',310],['서명 1',235],['동일 서명 2',135]] as const){text(title,y+(title.startsWith('서명')||title.startsWith('동일')?63:32),11);p.drawRectangle({x:150,y,width:360,height:title.startsWith('서명')||title.startsWith('동일')?55:24,borderWidth:1,borderColor:rgb(.5,.6,.5)});}
 text('촬영·홍보 응답은 서명과 별개이며, 아래 완료 기록에 응답을 명시합니다.',80,10);
 text('개발 서버 메모리 전용 · 실제 인증·DB·Storage·문자 연동 없음',55,10);
 const bytes=await doc.save(),fingerprint=createHash('sha256').update(bytes).digest('hex');
 return {bytes,settings:{version:1,fingerprint,pages:[{pageNumber:1,viewBox:[0,0,595,842],rotation:0,userUnit:1,width:595,height:842,transform:[1,0,0,-1,0,842]}],fields:[{id:'demo-name',kind:'name',pageNumber:1,rect:{x:150,y:350,width:360,height:24}},{id:'demo-date',kind:'date',pageNumber:1,rect:{x:150,y:310,width:360,height:24}},...[235,135].map((y,i)=>({id:`demo-sign-${i}`,kind:'signature' as const,pageNumber:1,rect:{x:150,y,width:360,height:55}}))]}};
}
export async function completeDemoPdf(original:DemoDocument, name:string, requestId:string, answers:ConsentAnswers,ink:Ink,at:string):Promise<Uint8Array>{
 requireSigningReady(answers,ink,original.settings.fields,true);
 const doc=await PDFDocument.load(original.bytes);doc.registerFontkit(fontkit);const font=await doc.embedFont(await fontBytes(),{subset:false});const p=doc.getPage(0);
 for(const f of original.settings.fields){const r=f.rect;if(f.kind==='signature'){const scale=Math.min((r.width-12)/900,(r.height-8)/300);p.drawSvgPath(inkPath(ink),{x:r.x+6,y:r.y+r.height-4,scale,borderColor:rgb(.05,.12,.15),borderWidth:5});}else p.drawText(f.kind==='name'?name:koreaDate(at),{x:r.x+6,y:r.y+6,size:12,font});}
 const record=doc.addPage([595,842]);const text=(s:string,y:number,size=12)=>record.drawText(s,{x:40,y,font,size});
 text('개발 시연 완료 기록 · 실제 법적 서명 증명 아님',790,18);text(`가상 참가자: ${name}`,745);text(`요청: ${requestId}`,718,10);text(`서버 접수 시각: ${at}`,691,10);
 for(const [i,item]of consentItems.entries())text(`${item.title}: ${item.id==='media'?(answers.media?'동의':'동의하지 않음'):'확인함'}`,640-i*40);
 text(`테스트 문서 버전: demo-consent-v1`,430);text(`원본 SHA-256:`,395,10);text(original.settings.fingerprint,375,9);
 text('선택 동의 거절은 완료를 막지 않습니다. 동일 서명이 두 곳에 적용됩니다.',330,10);text('DB/Storage 저장 없음. 서버 재시작·HMR 시 요청과 PDF가 사라집니다.',305,10);
 doc.setTitle('말모임 개발 시연 완료 PDF');return doc.save();
}
