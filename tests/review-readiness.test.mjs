import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
function load(file, imports, console = globalThis.console) {
 const compiled = { exports: {} };
 runInNewContext(ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
 { module: compiled, exports: compiled.exports, console, require: name => { if (name === 'server-only') return {}; if (name in imports) return imports[name]; throw Error(name); } });
 return compiled.exports;
}
const root = 'src/app/(public)/history/';
test('eligibility distinguishes denial from missing RPC and never grants on malformed response', async () => {
 const failures=[];
 const { checkReviewApproval }=load(root+'review-permission.ts', { '@/lib/supabase/server': {}, './review-diagnostics': { logReviewFailure: (...args)=>failures.push(args) } });
 for(const [data,error,expected] of [[true,null,'approved'],[false,null,'unapproved'],[null,{code:'PGRST202'},'error'],['true',null,'error']]) {
  assert.equal(await checkReviewApproval({rpc:async(name)=>{assert.equal(name,'history_can_create_review');return {data,error};}}),expected);
 }
 assert.equal(await checkReviewApproval({rpc:async()=>{throw Error('offline');}}),'error');
 assert.equal(failures.length,2);
});
test('server diagnostics expose only bounded stage/code, never database messages or secrets',()=>{
 const logs=[];const { logReviewFailure }=load(root+'review-diagnostics.ts',{}, {error:(...args)=>logs.push(args)});
 logReviewFailure('list',{code:'42P01',message:'private-record',details:'secret'});
 logReviewFailure('eligibility',{code:'untrusted-secret'});
 assert.equal(logs[0][1].code,'42P01');assert.equal(logs[1][1].code,'UNKNOWN');
 assert.doesNotMatch(JSON.stringify(logs),/private-record|secret/);
});
test('Production preflight covers 24 dependencies, all review objects and identity links without writes',()=>{
 const sql=readFileSync('supabase/review-release/00_production_preflight_readonly.sql','utf8');
 assert.match(sql,/BEGIN READ ONLY/);assert.match(sql,/qkhlvdctdcpfyvohhikl/);
 assert.equal((sql.match(/\('(?:auth|public)\.[^']+','[^']+','[^']+'\)/g)||[]).length,24);
 for(const name of ['history_reviews','history_participant_links','history_participant_audit','history_can_create_review','history-review-photos','identity_foreign_keys'])assert(sql.includes(name));
 assert.doesNotMatch(sql,/\b(?:CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|GRANT|REVOKE)\s+(?:TABLE|POLICY|FUNCTION|INTO|ON|public\.)/i);
});
test('Production candidate preserves the reviewed security body and remains unconditionally blocked',()=>{
 const draft=readFileSync('supabase/drafts/history-review-auth-bridge-v2.sql','utf8');
 const candidate=readFileSync('supabase/review-release/01_production_install_candidate_DRAFT.sql','utf8');
 const body=sql=>sql.slice(sql.indexOf('-- Future executable migration'));
 assert.equal(body(candidate),body(draft));
 assert(candidate.indexOf('DRAFT_ONLY:')<candidate.indexOf('CREATE TABLE'));
 assert(candidate.includes('qkhlvdctdcpfyvohhikl'));
});
