import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const base='supabase/review-release/';
const transaction=readFileSync(base+'02_verify_readonly.sql','utf8'),single=readFileSync(base+'02_verify_select_only.sql','utf8');
// Supabase Studio SQLEditor.constants.ts destructiveSqlRegex EXECUTE-string rule.
// Diagnostic regression only; this is NOT a SQL safety validator.
const studioRule=/execute\s+(?:format\s*\([^)]*\)\s*\|\||[^;]*['"])\s*(?:(drop|delete|truncate)\b|alter\s+table[^;]*\bdrop\s+column\b)/is;
const clean=s=>s.replace(/--[^\n]*/g,'').trim();
test('original warning false positive is reproduced; both revised variants avoid it',()=>{
 const original=transaction.replace("concat_ws(' ', 'EXECUTE', 'WITH', 'GRANT', 'OPTION')","'EXECUTE WITH GRANT OPTION'");
 assert(studioRule.test(clean(original)));assert(!studioRule.test(clean(transaction)));assert(!studioRule.test(clean(single)));
});
test('single SELECT preserves every check from read-only transaction variant',()=>{
 assert.equal(clean(single),clean(transaction).replace(/^BEGIN READ ONLY;\s*/,'').replace(/\s*COMMIT;$/,''));
 const withoutStrings=clean(single).replace(/'(?:''|[^'])*'/g,"''");
 assert.doesNotMatch(withoutStrings,/\b(?:INSERT|UPDATE|DELETE|TRUNCATE|CREATE|ALTER|DROP|GRANT|REVOKE|DO|EXECUTE|CALL|COPY|INTO)\b/i);
 assert(withoutStrings.startsWith('SELECT '));assert.equal((withoutStrings.match(/;/g)||[]).length,1);
});
test('grant-option string construction has identical PostgreSQL privilege meaning',{skip:!process.env.REVIEW_ACL_PGLITE_MODULE},async()=>{
 const {PGlite}=await import(process.env.REVIEW_ACL_PGLITE_MODULE);const db=new PGlite();try{
 const {rows}=await db.query("SELECT concat_ws(' ', 'EXECUTE', 'WITH', 'GRANT', 'OPTION') AS privilege, has_function_privilege(current_user,'pg_catalog.length(text)','EXECUTE WITH GRANT OPTION') AS before, has_function_privilege(current_user,'pg_catalog.length(text)',concat_ws(' ', 'EXECUTE', 'WITH', 'GRANT', 'OPTION')) AS after");
 assert.equal(rows[0].privilege,'EXECUTE WITH GRANT OPTION');assert.equal(rows[0].before,rows[0].after);
 }finally{await db.close();}
});
