import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createRequire} from 'node:module';
import {unzipSync,strFromU8} from 'fflate';
import ts from 'typescript';
const require=createRequire(import.meta.url);
function load(file,mocks){const mod={exports:{}};runInNewContext(ts.transpileModule(readFileSync(new URL('../'+file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module:mod,exports:mod.exports,require:name=>Object.hasOwn(mocks,name)?mocks[name]:require(name),Buffer,Response,URL,Intl});return mod.exports;}
const workbook=load('src/lib/applicant-export.ts',{'./applicant-validation':{applicationStatuses:{accepted:'합격'},paymentStatuses:{paid:'입금 완료'}},'./applicant-languages':{languageLevelLabel:(_,v)=>v??'미입력'},'./season9-gender':{applicantGenderLabel:v=>v??'미입력'},'./attribution':{trafficSources:{naver:'네이버'}}}).applicantWorkbook;
const row=n=>({id:String(n),event_id:'event',source:'manual',name:n===0?'=HYPERLINK("bad") <이름>':'신청자 '+n,contact:'01001234567',contact_type:'phone',created_at:'2026-11-02T00:00:00Z',event_title:'말모임 9기',status:'accepted',payment_status:'paid'});
test('xlsx has a real filterable table, frozen header, literal phone and safe participant text',()=>{
 const zip=unzipSync(workbook([row(0),row(1)])),sheet=strFromU8(zip['xl/worksheets/sheet1.xml']),table=strFromU8(zip['xl/tables/table1.xml']);
 assert.match(table,/<autoFilter ref="A1:Q3"/);assert.match(table,/showRowStripes="1"/);assert.match(sheet,/state="frozen"/);
 assert.match(sheet,/>01001234567<\/t>/);assert.match(sheet,/=HYPERLINK\(&quot;bad&quot;\) &lt;이름&gt;/);assert.doesNotMatch(sheet,/<f[ >]/);assert.match(sheet,/2026-11-02 09:00/);
});
test('export enforces admin access before reading any applicants',async()=>{
 let reads=0;const {GET}=load('src/app/api/admin/applicants/export/route.ts',{'@/lib/auth':{getAdminAccess:async()=>({status:'anonymous'})},'@/lib/recruitment':{getRecruitment:async()=>{reads++;}},'@/lib/applicant-export':{applicantWorkbook:workbook}});
 assert.equal((await GET(new Request('https://example.test/api/admin/applicants/export'))).status,403);assert.equal(reads,0);
});
test('export includes all filtered pages, omits SMS queries, and returns a private xlsx',async()=>{
 const calls=[];const {GET}=load('src/app/api/admin/applicants/export/route.ts',{'@/lib/auth':{getAdminAccess:async()=>({status:'admin'})},'@/lib/recruitment':{getRecruitment:async(...args)=>{calls.push(args);const p=args[1];return {kind:'ready',count:501,rows:Array.from({length:p===1?500:1},(_,i)=>row((p-1)*500+i))};}},'@/lib/applicant-export':{applicantWorkbook:workbook}});
 const response=await GET(new Request('https://example.test/api/admin/applicants/export?event=event&preferred_class=saturday&archived=1&page=99'));
 assert.equal(response.status,200);assert.equal(calls.length,2);for(const c of calls){assert.equal(c[2].event,'event');assert.equal(c[2].preferred_class,'saturday');assert.equal(c[2].archived,'1');assert.equal(c[2].page,undefined);assert.equal(c[4].pageSize,500);assert.equal(c[4].includeSms,false);}
 assert.match(response.headers.get('cache-control'),/no-store/);assert.match(response.headers.get('content-type'),/spreadsheetml/);
 const zip=unzipSync(new Uint8Array(await response.arrayBuffer()));assert.match(strFromU8(zip['xl/tables/table1.xml']),/A1:Q502/);
});
test('changed lists or oversized exports fail instead of downloading a partial roster',async()=>{
 for(const mode of ['oversized','changed']){
  const {GET}=load('src/app/api/admin/applicants/export/route.ts',{'@/lib/auth':{getAdminAccess:async()=>({status:'admin'})},'@/lib/recruitment':{getRecruitment:async(_,p)=>({kind:'ready',count:mode==='oversized'?5001:p===1?501:502,rows:Array.from({length:500},(_,i)=>row(i))})},'@/lib/applicant-export':{applicantWorkbook:workbook}});
  const response=await GET(new Request('https://example.test/api/admin/applicants/export'));assert.equal(response.status,mode==='oversized'?413:409);
 }
});
