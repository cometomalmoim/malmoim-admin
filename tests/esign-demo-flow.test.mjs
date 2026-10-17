import {test} from 'node:test';import assert from 'node:assert/strict';import {PDFDocument} from 'pdf-lib';
import {MemoryRequestRepository} from '../src/lib/esign-request-repository.ts';
import {StoredPreviewService} from '../src/lib/esign-request-service.ts';
import {DemoFlow} from '../src/lib/esign-demo-flow.ts';
const key={event_id:'preview-event-1',source:'season9',application_id:'preview-application-1'};
async function setup(){const repo=new MemoryRequestRepository(),service=new StoredPreviewService(repo),flow=new DemoFlow(repo,service,'fixture-admin');const result=await service.execute('fixture-admin',{operation:'validate',eventId:key.event_id,documentId:'fixture-template-1',version:1,keys:[key],days:7,idempotencyKey:'demo-request-123'});const row=result.body.result.requests[0];const link=await flow.issue(row.id,key.event_id);return {repo,service,flow,row,link};}
const submit=name=>({operation:'submit',name,answers:{media:false,rules:true,consequences:true,refund:true},ink:[[{x:.1,y:.2},{x:.6,y:.7},{x:.8,y:.3}]],read:true,confirmed:true,idempotencyKey:'submission-123'});
test('full demo verification/document/optional refusal/completion/download/admin status and idempotency',async()=>{const {repo,flow,row,link}=await setup();await assert.rejects(flow.action(link.token,null,{operation:'status'}),/VERIFICATION/);await assert.rejects(flow.action(link.token,null,{operation:'verify',code:'wrong'}),/CODE_INVALID/);const auth=await flow.action(link.token,null,{operation:'verify',code:link.code});assert.equal(auth.phase,'verified');const original=await flow.action(link.token,auth.session,{operation:'document'});assert.equal((await PDFDocument.load(original)).getPageCount(),1);assert.equal((await flow.summary(row.id)).phase,'signing');const response=await flow.action(link.token,auth.session,submit(row.name));assert.equal(response.phase,'completed');assert.equal((await repo.get(row.id,[key.event_id])).status,'completed');assert.equal((await flow.action(link.token,auth.session,submit(row.name))).code,'IDEMPOTENT_COMPLETION');await assert.rejects(flow.action(link.token,auth.session,{...submit(row.name),idempotencyKey:'different-123'}),/ALREADY_COMPLETED/);const pdf=await flow.action(link.token,auth.session,{operation:'pdf'});assert.equal((await PDFDocument.load(pdf)).getPageCount(),2);assert.deepEqual(await flow.adminPdf(row.id),pdf);});
test('required consent, name, signature reset and final confirmation enforced server-side',async()=>{const {flow,row,link}=await setup();const auth=await flow.action(link.token,null,{operation:'verify',code:link.code});await flow.action(link.token,auth.session,{operation:'document'});for(const patch of [{confirmed:false},{name:'other'},{read:false},{ink:[]},{answers:{media:false,rules:false,consequences:true,refund:true}},{answers:{media:null,rules:true,consequences:true,refund:true}}])await assert.rejects(flow.action(link.token,auth.session,{...submit(row.name),...patch}));assert.equal((await flow.action(link.token,auth.session,submit(row.name))).phase,'completed');});
test('cancel and expire block original, verify, submit and no artifact is fabricated',async()=>{for(const operation of ['cancel','expire']){const {service,flow,row,link}=await setup();const auth=await flow.action(link.token,null,{operation:'verify',code:link.code});await flow.action(link.token,auth.session,{operation:'document'});await service.execute('fixture-admin',{operation,eventId:key.event_id,requestId:row.id});await assert.rejects(flow.action(link.token,auth.session,submit(row.name)),/CANCELLED|EXPIRED/);await assert.rejects(flow.adminPdf(row.id),/PDF_NOT_READY/);}});
test('another request session, expired session and new-server state cannot access a link',async()=>{const a=await setup(),b=await setup();const auth=await a.flow.action(a.link.token,null,{operation:'verify',code:a.link.code});await assert.rejects(b.flow.action(b.link.token,auth.session,{operation:'document'}),/VERIFICATION/);await assert.rejects(a.flow.action(a.link.token,auth.session,{operation:'status'},Date.now()+31*60000),/VERIFICATION/);const fresh=new DemoFlow(a.repo,a.service,'fixture-admin');await assert.rejects(fresh.action(a.link.token,auth.session,{operation:'status'}),/SERVER_RESTARTED/);});
test('simultaneous submission completes once and shares idempotent result',async()=>{const {flow,row,link}=await setup();const auth=await flow.action(link.token,null,{operation:'verify',code:link.code});await flow.action(link.token,auth.session,{operation:'document'});const results=await Promise.all([flow.action(link.token,auth.session,submit(row.name)),flow.action(link.token,auth.session,submit(row.name))]);assert.deepEqual(results.map(r=>r.code),['DEMO_COMPLETED_IN_MEMORY','IDEMPOTENT_COMPLETION']);});

test('concurrent link requests reuse one request-specific link',async()=>{const {flow,row,link}=await setup();const [a,b]=await Promise.all([flow.issue(row.id,key.event_id),flow.issue(row.id,key.event_id)]);assert.deepEqual(a,b);assert.deepEqual(a,link);});

test('development errors remain recognizable after module reload', async () => {
 const {isDemoError}=await import('../src/lib/esign-demo-flow.ts');
 const stale=new Error('DEMO_VERIFICATION_REQUIRED');stale.status=401;
 assert.equal(isDemoError(stale),true);
 assert.equal(isDemoError(new Error('internal detail')),false);
 assert.equal(isDemoError(Object.assign(new Error('private path /tmp/file'),{status:500})),false);
});

test('PDF generation and persistence failures leave request pending and allow retry',async()=>{
 for(const stage of ['render','store']){
  const {repo,service,row}=await setup();let fail=true;
  const deps=stage==='render'?{render:async(...args)=>{if(fail)throw new Error('RENDER_FAILED');const {completeDemoPdf}=await import('../src/lib/esign-demo-pdf.ts');return completeDemoPdf(...args);}}:{store:async bytes=>{if(fail)throw new Error('STORE_FAILED');return bytes;}};
  const flow=new DemoFlow(repo,service,'fixture-admin',deps),link=await flow.issue(row.id,key.event_id);
  const auth=await flow.action(link.token,null,{operation:'verify',code:link.code});await flow.action(link.token,auth.session,{operation:'document'});
  await assert.rejects(flow.action(link.token,auth.session,submit(row.name)),/FAILED/);
  assert.equal((await repo.get(row.id,[key.event_id])).status,'pending');await assert.rejects(flow.adminPdf(row.id),/PDF_NOT_READY/);
  fail=false;assert.equal((await flow.action(link.token,auth.session,submit(row.name))).phase,'completed');
 }
});
test('contact change invalidates pending demo access without deleting history',async()=>{
 const {service,repo,flow,row,link}=await setup();
 const auth=await flow.action(link.token,null,{operation:'verify',code:link.code});
 await service.execute('fixture-admin',{operation:'scenario',eventId:key.event_id,keys:[key],scenario:'phone'});
 await assert.rejects(flow.action(link.token,auth.session,{operation:'document'}),/CANCELLED/);
 const saved=await repo.get(row.id,[key.event_id]);assert.equal(saved.status,'cancelled');assert.ok(saved.history.length>1);
});

test('cancellation during asynchronous PDF generation wins over completion',async()=>{
 const {repo,service,row}=await setup();let release,started;
 const entered=new Promise(resolve=>{started=resolve;}),gate=new Promise(resolve=>{release=resolve;});
 const flow=new DemoFlow(repo,service,'fixture-admin',{render:async()=>{started();await gate;return new TextEncoder().encode('%PDF-test');}});
 const link=await flow.issue(row.id,key.event_id),auth=await flow.action(link.token,null,{operation:'verify',code:link.code});await flow.action(link.token,auth.session,{operation:'document'});
 const submission=flow.action(link.token,auth.session,submit(row.name));const rejected=assert.rejects(submission,/CANCELLED/);
 await entered;await service.execute('fixture-admin',{operation:'cancel',eventId:key.event_id,requestId:row.id});release();await rejected;
 assert.equal((await repo.get(row.id,[key.event_id])).status,'cancelled');await assert.rejects(flow.adminPdf(row.id),/PDF_NOT_READY/);
});
