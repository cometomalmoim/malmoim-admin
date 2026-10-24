import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {createHash} from "node:crypto";
import {createRequire} from "node:module";
import path from "node:path";
import {runInNewContext} from "node:vm";
import {test} from "node:test";
import ts from "typescript";
const require=createRequire(import.meta.url),root=path.resolve(import.meta.dirname,"..");
const React=require("react"),{renderToStaticMarkup}=require("react-dom/server");
function load(name,mocks={}){
 const requested=path.resolve(root,name),file=existsSync(requested)?requested:requested.replace(/\.ts$/,".tsx"),loaded={exports:{}};
 const {outputText}=ts.transpileModule(readFileSync(file,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}});
 runInNewContext(outputText,{module:loaded,exports:loaded.exports,Date,require:id=>Object.hasOwn(mocks,id)?mocks[id]:id.startsWith("@/")?load("src/"+id.slice(2)+".ts",mocks):id.startsWith(".")?load(path.relative(root,path.resolve(path.dirname(file),id+".ts")),mocks):require(id)});return loaded.exports;
}
const legal=load("src/lib/member-legal.ts"),markdown=load("src/lib/member-legal-markdown.ts");
const {MemberLegalContent}=load("src/components/member-legal-content.tsx",{"./member-legal.css":{}});
const directory=path.join(root,"docs/legal-review/20261021"),manifest=JSON.parse(readFileSync(path.join(directory,"manifest.json"),"utf8"));
const source=(kind,locale)=>readFileSync(path.join(directory,`${kind}.${locale}.md`),"utf8");
const fixtureDoc=kind=>markdown.prepareMemberLegalDocument(source(kind,"ko"),source(kind,"en"),"SYNTHETIC-UNAPPROVED-FIXTURE","2099-01-01");
test("historical draft originals and translations retain the recorded bytes after approval",()=>{
 assert.equal(manifest.status,"draft");assert.equal(manifest.effectiveDate,null);assert.equal(manifest.approvedVersion,null);
 for(const file of manifest.files)assert.equal(createHash("sha256").update(readFileSync(path.join(directory,file.name))).digest("hex"),file.sha256);
 assert.equal(manifest.files.find(f=>f.name==="privacy.ko.md").sha256,"47165c47f89382161d1afb90df81154beb58499eaa02fdf3596fba94826df8f5");
 assert.equal(manifest.files.find(f=>f.name==="terms.ko.md").sha256,"1b63e0697f2c2a753e8f3da3665b8894c34eea1ca7f63f9dabea3f0d8374af67");
});
test("all 16 privacy and 18 terms articles, list numbers, paragraphs and table dimensions match across languages",()=>{
 for(const [kind,count] of [["privacy",16],["terms",18]]){
  const doc=fixtureDoc(kind);assert.equal(doc.sections.length,count);
  assert.deepEqual(Array.from(doc.sections,s=>s.id),Array.from({length:count},(_,i)=>"article-"+(i+1)));
  assert.equal(legal.getPublishedMemberDocument(kind,{published:true,document:doc}),null,"internal placeholders must still prevent publication");
 }
 const tables=fixtureDoc("privacy").sections.flatMap(s=>s.blocks.ko).filter(b=>b.type==="table");assert.equal(tables.length,4);assert.deepEqual(Array.from(tables,t=>t.rows.length),[6,5,7,2]);
});
test("shared renderer retains every supplied content cell/list/paragraph in both languages without injecting HTML",()=>{
 const decode=text=>text.replace(/<[^>]*>/g,"").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#x27;/g,"'");
 for(const kind of ["privacy","terms"])for(const locale of ["ko","en"]){
  const doc=fixtureDoc(kind),parsed=markdown.parseLegalMarkdown(source(kind,locale));
  const html=renderToStaticMarkup(React.createElement(MemberLegalContent,{document:doc,locale,idPrefix:"fixture-"})),text=decode(html);
  const expected=[...parsed.introduction,...parsed.sections.flatMap(s=>s.blocks)].flatMap(b=>b.type==="table"?[...b.headers,...b.rows.flat()]:b.type==="list"?b.items.map(i=>i.text):[b.text]);
  for(const item of expected)assert.ok(text.includes(item.replace(/\*\*/g,"")),`${kind}/${locale} missing: ${item.slice(0,60)}`);
  for(const section of parsed.sections){assert.ok(text.includes(section.title));assert.ok(html.includes(`href="#fixture-${section.id}"`));assert.ok(html.includes(`id="fixture-${section.id}"`));}
  assert.equal((html.match(/<table>/g)||[]).length,kind==="privacy"?4:0);
 }
 const malicious={version:"fixture",effectiveDate:"2099-01-01",sections:[{id:"a",title:{ko:"가상",en:"Fixture"},paragraphs:{ko:['<script>alert("x")</script>'],en:[]}}]};
 assert.doesNotMatch(renderToStaticMarkup(React.createElement(MemberLegalContent,{document:malicious,locale:"ko"})),/<script>/);
});
test("approved documents may have unset dates; drafts, invalid dates and internal notes remain blocked",()=>{
 const doc={version:"fixture-only",effectiveDate:"2099-01-01",sections:[]};
 assert.equal(legal.getPublishedMemberDocument("terms").effectiveDate,null);assert.equal(legal.getPublishedMemberDocument("privacy").effectiveDate,null);
 assert.equal(legal.getPublishedMemberDocument("terms",{published:false,document:doc}),null);
 assert.equal(legal.getPublishedMemberDocument("terms",{published:true,document:doc}),doc);
 assert.equal(legal.getPublishedMemberDocument("privacy").sections.length,16);
 for(const effectiveDate of ["","2099-02-30","[최종 승인 후 기재]"])assert.equal(legal.getPublishedMemberDocument("terms",{published:true,document:{...doc,effectiveDate}}),null);
 assert.equal(legal.publishedMemberLegal.collection.basis,"contract");
 assert.equal(legal.getPublishedMemberDocument("privacy",{published:true,document:{...doc,sections:[{paragraphs:{ko:["운영 확인 필요"],en:[]}}]}}),null);
});
test("four approved routes remain public, localized, indexed and document kinds are never mixed",()=>{
 const localeTools=load("src/lib/public-locale.ts");
 for(const kind of ["privacy","terms"])for(const locale of ["ko","en"]){
  const filename=`src/app/${locale==="en"?"(english)/en":"(public)"}/${kind}/page.tsx`;
  const mocks={"@/components/member-legal-page":{MemberLegalPage:()=>null},"@/lib/member-legal":legal};
  const page=load(filename,mocks),element=page.default();assert.equal(element.props.kind,kind);assert.equal(element.props.locale,locale);assert.equal(page.metadata.robots.index,true);
  assert.equal(page.metadata.alternates.canonical,`${locale==="en"?"/en":""}/${kind}`);
  assert.equal(localeTools.publicLocaleDecision("/"+kind,"en").pathname,"/en/"+kind);
 }
});
test("approved pages expose full text with a pending date without internal notes; localized footer retains both links",()=>{
 for(const kind of ["privacy","terms"])for(const locale of ["ko","en"]){
  const {MemberLegalPage}=load("src/components/member-legal-page.tsx",{"next/link":{__esModule:true,default:"a"},"./member-privacy.css":{},"./member-legal-content":{MemberLegalContent}});
  const html=renderToStaticMarkup(React.createElement(MemberLegalPage,{kind,locale}));assert.doesNotMatch(html,/최종 승인 후 기재|운영 확인 필요|Operational verification required|2099/);
  assert.match(html,/미정|Not yet set/);assert.doesNotMatch(html,/개발·테스트|Development and testing/);assert.doesNotMatch(html,/2026-10-22/);assert.doesNotMatch(html,/Publication is being prepared|공개 준비 중/);
 }
 const {PublicFrame}=load("src/components/public-frame.tsx",{"next/link":{__esModule:true,default:"a"},"./public-shell-design.css":{},"./public-account":{PublicAccount:()=>null},"./public-header":{PublicHeader:()=>null}});
 for(const locale of ["ko","en"]){const html=renderToStaticMarkup(React.createElement(PublicFrame,{locale},null));for(const kind of ["privacy","terms"])assert.ok(html.includes(`href="${locale==="en"?"/en":""}/${kind}"`));assert.ok(html.includes(locale==="en"?"Terms of Service":"이용약관"));}
});
test("translation preparation rejects missing articles, missing paragraphs and altered list numbers",()=>{
 assert.throws(()=>markdown.prepareMemberLegalDocument(source("terms","ko"),source("terms","en").replace("1. **MALMOIM:","9. **MALMOIM:"),"fixture","2099-01-01"),/Translation block/);
 assert.throws(()=>markdown.prepareMemberLegalDocument(source("terms","ko"),source("terms","en").replace(/## Article 18[\s\S]*/,""),"fixture","2099-01-01"),/article mismatch/);
 assert.throws(()=>markdown.prepareMemberLegalDocument(source("terms","ko"),source("terms","en").replace("Members must set a nickname when registering.","\n\nExtra paragraph.\n\nAnother paragraph."),"fixture","2099-01-01"),/Translation block/);
});
test("signup modal selects each independently published document without enabling registration or consent",()=>{
 for(const kind of ["privacy","terms"]){
  const documents={privacy:{version:"privacy-fixture",effectiveDate:"2099-01-01",sections:[{id:"p",title:{ko:"개인정보 전용",en:"Privacy only"},paragraphs:{ko:["개인정보 본문"],en:["Privacy body only"]}}]},terms:{version:"terms-fixture",effectiveDate:"2099-01-01",sections:[{id:"t",title:{ko:"약관 전용",en:"Terms only"},paragraphs:{ko:["약관 본문"],en:["Terms body only"]}}]}};
  const {SignupLegalNotice}=load("src/components/signup-legal-notice.tsx",{
   react:{...React,useState:()=>[kind,()=>{}]},
   "./member-legal-modal":{MemberLegalModal:props=>React.createElement(MemberLegalContent,{document:props.document,locale:props.locale})},
  });
  const html=renderToStaticMarkup(React.createElement(SignupLegalNotice,{legal:null,documents,enabled:false,locale:"en",errors:{}}));
  assert.match(html,/disabled=""/);assert.doesNotMatch(html,/checked=""|name="privacyConsent"|name="termsVersion"/);
  assert.ok(html.includes(kind==="privacy"?"Privacy body only":"Terms body only"));assert.ok(!html.includes(kind==="privacy"?"Terms body only":"Privacy body only"));
 }
});

test("versioned snapshots preserve every clause while separating the internal note and date metadata",()=>{
 const audit=JSON.parse(readFileSync(path.join(directory,"approval-20261022.json"),"utf8"));
 assert.equal(audit.status,"approved");assert.equal(audit.effectiveDate,"2026-10-22");assert.equal(audit.internalAnnotations.length,2);
 for(const kind of ["privacy","terms"]){
  const original={};
  for(const locale of ["ko","en"]){
   let text=source(kind,locale).replace(/\r\n/g,"\n");
   for(const annotation of audit.internalAnnotations.filter(a=>a.kind===kind&&a.locale===locale))text=text.replace(annotation.text+"\n","");
   original[locale]=text.split("\n").filter(line=>!line.includes(locale==="ko"?"[최종 승인 후 기재]":"[To be entered after final approval]")).join("\n");
  }
  const expected={...markdown.prepareMemberLegalDocument(original.ko,original.en,`${kind}-v1`,null)};
  assert.equal(JSON.stringify(legal.getPublishedMemberDocument(kind)),JSON.stringify(expected));
 }
});

test("signup uses the approved versions, mandatory unchecked terms and a separate privacy modal without fabricated consent",()=>{
 const {SignupLegalNotice}=load("src/components/signup-legal-notice.tsx",{"./member-legal-modal":{MemberLegalModal:()=>null}});
 for(const locale of ["ko","en"]){
  const html=renderToStaticMarkup(React.createElement(SignupLegalNotice,{legal:legal.publishedMemberLegal,enabled:true,locale,errors:{}}));
  const checkbox=html.match(/<input[^>]*name="termsConsent"[^>]*>/)?.[0];assert.ok(checkbox);assert.match(checkbox,/required=""/);assert.doesNotMatch(html,/checked=""|name="privacyConsent"|disabled=""/);
  for(const version of ["terms-v1","privacy-v1","signup-v1"])assert.ok(html.includes(version));
 }
});
