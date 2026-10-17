import { test } from 'node:test';
import assert from 'node:assert/strict';
import { documentAdminFixtures } from '../src/lib/document-admin-fixtures.ts';
import { canUseCompletedPdf, filterRequests, requestCounts, requestMessage, selectedRequests, signatureStatuses, templateName, templateReadiness, toggleVisibleSelection, updateTemplate } from '../src/lib/document-admin-model.ts';

const page={pageNumber:1,viewBox:[0,0,600,800],rotation:0,userUnit:1,width:600,height:800,transform:[1,0,0,-1,0,800]};
const settings={version:1,fingerprint:'same-pdf',pages:[page],fields:['name','date','signature','signature'].map((kind,i)=>({id:`field-${i}`,kind,pageNumber:1,rect:{x:100,y:100+i*80,width:180,height:40}}))};
test('fixtures represent all six states with explicit mock identities and no PDF/link/phone',()=>{
  const {templates,requests}=documentAdminFixtures();assert.equal(requests.length,18);
  for(const status of Object.keys(signatureStatuses))assert.equal(requests.filter(r=>r.status===status).length,3);
  for(const row of requests){assert.equal(row.isFixture,true);assert.match(row.participantName,/^가상 참가자/);assert.equal(row.artifactId,null);assert.equal(Object.hasOwn(row,'phone'),false);assert.equal(Object.hasOwn(row,'link'),false);if(row.status!=='completed')assert.equal(row.completedAt,null);if(row.status==='unsent')assert.equal(row.requestedAt,null);}
  assert.ok(templates.every(t=>t.original===null&&t.settings===null));
});
test('event/status/document/name filters combine without changing requests and distinguish same-name rows by ID',()=>{
  const {requests}=documentAdminFixtures(),before=structuredClone(requests);
  assert.equal(filterRequests(requests,{eventId:'fixture-event-2',status:'completed',name:'가상 참가자 09',templateId:'fixture-template-2'}).length,1);
  assert.equal(filterRequests(requests,{eventId:'fixture-event-1',status:'completed',name:'09'}).length,0);
  assert.equal(filterRequests(requests,{eventId:'',status:'',name:'없는 이름'}).length,0);
  const rows=[{...requests[0],participantName:'Alex'},{...requests[1],participantName:'Alex'}];assert.equal(filterRequests(rows,{eventId:'',status:'',name:'  ＡＬＥＸ  '}).length,2);assert.notEqual(rows[0].id,rows[1].id);assert.deepEqual(requests,before);
});
test('global dashboard includes unsent and shows explicit mock completion counts',()=>{
  assert.deepEqual(requestCounts(documentAdminFixtures().requests),{total:18,pending:3,completed:3,unsent:3});
  assert.deepEqual(requestCounts([]),{total:0,pending:0,completed:0,unsent:0});
});
test('visible bulk selection preserves identity, deduplicates and only previews visible selected requests',()=>{
  const {requests}=documentAdminFixtures();const visible=requests.slice(0,3);
  const selected=toggleVisibleSelection([requests[4].id],visible,true);assert.equal(selected.length,4);assert.equal(toggleVisibleSelection(selected,visible,true).length,4);
  assert.deepEqual(toggleVisibleSelection(selected,visible,false),[requests[4].id]);assert.equal(selectedRequests(visible,selected).length,3);assert.equal(selectedRequests([],selected).length,0);
});
test('renaming/versioning does not modify historical request title/version and settings snapshots are isolated',()=>{
  const {templates,requests}=documentAdminFixtures(),original={...templates[0],original:{filename:'test.pdf',bytes:100,fingerprint:'same-pdf'}};
  const before=structuredClone(requests),input=structuredClone(settings),changed=updateTemplate(original,'  새 서류 이름  ',input,'2026-10-16T09:00:00Z');
  assert.equal(changed.name,'새 서류 이름');assert.equal(changed.revision,2);assert.equal(original.revision,1);input.fields[0].rect.x=400;assert.equal(changed.settings.fields[0].rect.x,100);assert.deepEqual(requests,before);
  const list=templates.filter(t=>t.id!==original.id);assert.equal(list.length,2);assert.equal(requests.filter(r=>r.templateId===original.id).length,6);
});
test('template names, wrong-document coordinates, duplicate/unsupported fields are rejected',()=>{
  for(const v of ['', '  ', 'x'.repeat(101), 'one\ntwo'])assert.throws(()=>templateName(v));
  const template={...documentAdminFixtures().templates[0],original:{filename:'test.pdf',bytes:100,fingerprint:'same-pdf'}};
  assert.throws(()=>updateTemplate(template,'valid',{...settings,fingerprint:'another-pdf'},'now'));
  assert.throws(()=>updateTemplate(template,'valid',{...settings,fields:[settings.fields[0],settings.fields[0]]},'now'));
  assert.throws(()=>updateTemplate(template,'valid',{...settings,fields:[{...settings.fields[0],kind:'phone'}]},'now'));
  assert.throws(()=>updateTemplate(template,'valid',{...settings,fields:[{...settings.fields[0],rect:{x:-100,y:10,width:20,height:20}}]},'now'));
});
test('readiness distinguishes missing original from editable settings and keeps multiple signature fields',()=>{
  const template=documentAdminFixtures().templates[0];assert.equal(templateReadiness(template),'원본 PDF 미등록');
  const local={...template,original:{filename:'test.pdf',bytes:100,fingerprint:'same-pdf'}};assert.equal(templateReadiness(local),'필드 설정 필요');assert.equal(templateReadiness({...local,settings}),'세 종류 필드 설정됨');assert.equal(settings.fields.filter(f=>f.kind==='signature').length,2);
});
test('mock complete never grants PDF access without a real matching artifact',()=>{
  const complete=documentAdminFixtures().requests.find(r=>r.status==='completed');assert.equal(canUseCompletedPdf(complete,new Set()),false);assert.equal(canUseCompletedPdf(complete,new Set(['anything'])),false);
  const linked={...complete,artifactId:'actual-artifact'};assert.equal(canUseCompletedPdf(linked,new Set()),false);assert.equal(canUseCompletedPdf(linked,new Set(['actual-artifact'])),true);assert.equal(canUseCompletedPdf({...linked,status:'pending'},new Set(['actual-artifact'])),false);
});
test('message preview is personal, explicitly unsent and never invents an issued link',()=>{
  const {requests}=documentAdminFixtures();const message=requestMessage(requests[0]);assert.ok(message.includes(requests[0].participantName));assert.ok(message.includes(requests[0].eventName));assert.match(message,/가상 문자 미리보기 · 전송 안 됨/);assert.match(message,/\{개인별_서명_링크\}/);assert.doesNotMatch(message,/https?:\/\//);assert.notEqual(message,requestMessage(requests[6]));
});
test('fixture factory returns independent sessions so deletions/edits cannot leak across previews',()=>{
  const a=documentAdminFixtures(),b=documentAdminFixtures();a.templates[0].name='edited';a.requests[2].answers.media=true;assert.notEqual(a.templates[0].name,b.templates[0].name);assert.equal(b.requests[2].answers.media,false);
});
