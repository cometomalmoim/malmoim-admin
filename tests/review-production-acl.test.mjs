import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const modulePath=process.env.REVIEW_ACL_PGLITE_MODULE;
const sql=readFileSync('supabase/review-release/01_production_install_candidate_v3_BLOCKED.sql','utf8');
test('V3 stays blocked, reads team objects only and preserves all existing review policies',()=>{
 assert(sql.indexOf('DRAFT_ONLY:')<sql.indexOf('CREATE TABLE'));
 assert.doesNotMatch(sql,/(?:ALTER TABLE|UPDATE|INSERT INTO|DELETE FROM)\s+public\.(?:event_|recruitment_|admin_users)/i);
 const original=readFileSync('supabase/review-release/01_production_install_candidate_DRAFT.sql','utf8');
 const policies=s=>s.match(/CREATE POLICY[\s\S]*?;/gi);
 assert.deepEqual(policies(sql),policies(original));
 assert(sql.includes('required existing Storage ACL absent; no global GRANT'));
});
test('real in-memory PostgreSQL accepts exact column grants and rejects excess/inherited privileges', {skip:!modulePath},async()=>{
 const {PGlite}=await import(modulePath);const db=new PGlite();
 try {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE ROLE inherited_writer;
   CREATE TABLE public.history_reviews(id uuid,author_id uuid,display_name text,title text,category text,content text,photo_paths text[],created_at timestamptz,updated_at timestamptz);
   GRANT SELECT ON public.history_reviews TO anon,authenticated;
   GRANT INSERT(id,author_id,display_name,title,category,content,photo_paths) ON public.history_reviews TO authenticated;
   GRANT UPDATE(title,category,content,photo_paths) ON public.history_reviews TO authenticated;
   GRANT DELETE ON public.history_reviews TO authenticated;`);
  const tableGuard=sql.slice(sql.indexOf(" IF has_table_privilege('authenticated','public.history_reviews','INSERT,UPDATE,TRUNCATE,REFERENCES,TRIGGER')")).split(' THEN')[0].replace(/^ IF /,'');
  const columnGuard=sql.slice(sql.indexOf(' IF EXISTS(SELECT 1 FROM pg_attribute c\n WHERE')).split(' THEN')[0].replace(/^ IF /,'');
  const check=async()=> (await db.query(`SELECT (${tableGuard}) AS table_reject, (${columnGuard}) AS column_reject`)).rows[0];
  const baseline=await db.query("SELECT has_table_privilege('authenticated','public.history_reviews','INSERT,UPDATE') AS whole_table, has_any_column_privilege('authenticated','public.history_reviews','INSERT,UPDATE') AS any_column");
  assert.deepEqual(baseline.rows[0],{whole_table:false,any_column:true});
  assert.deepEqual(await check(),{table_reject:false,column_reject:false});
  for(const [grant,expected] of [
   ['GRANT INSERT ON public.history_reviews TO authenticated',{table_reject:true,column_reject:true}],
   ['GRANT INSERT(created_at) ON public.history_reviews TO authenticated',{table_reject:false,column_reject:true}],
   ['GRANT UPDATE(title) ON public.history_reviews TO authenticated WITH GRANT OPTION',{table_reject:false,column_reject:true}],
   ['GRANT INSERT(title) ON public.history_reviews TO anon',{table_reject:true,column_reject:false}],
   ['GRANT UPDATE(created_at) ON public.history_reviews TO inherited_writer; GRANT inherited_writer TO authenticated',{table_reject:false,column_reject:true}],
   ['GRANT REFERENCES(title) ON public.history_reviews TO authenticated',{table_reject:false,column_reject:true}],
  ]) {
   await db.exec('BEGIN');await db.exec(grant);assert.deepEqual(await check(),expected,grant);await db.exec('ROLLBACK');
  }
 } finally {await db.close();}
});
test('executable candidate adds reviewed-policy snapshot and final assertions without changing security DDL',()=>{
 const executable=readFileSync('supabase/review-release/01_production_install.sql','utf8');
 assert(!executable.includes('DRAFT_ONLY:'));
 assert(executable.includes('qkhlvdctdcpfyvohhikl'));
 assert(executable.includes('existing Storage policy snapshot changed'));
 assert(executable.includes('review policy scope/roles/commands mismatch'));
 assert(executable.includes('review bucket configuration mismatch'));
 const policies=s=>s.match(/CREATE POLICY[\s\S]*?;/gi);
 assert.deepEqual(policies(executable),policies(sql));
 const snapshot=JSON.parse(executable.split('$snapshot$')[1]);
 assert.equal(snapshot.length,21);
 assert.equal(snapshot.filter(p=>p.permissive==='RESTRICTIVE').length,8);
 assert(snapshot.every(p=>p.table==='storage.objects'&&!p.name.startsWith('hrv2_')));
 assert(executable.indexOf('existing Storage policy snapshot changed')<executable.indexOf('CREATE TABLE'));
 assert.doesNotMatch(executable,/(?:ALTER TABLE|UPDATE|INSERT INTO|DELETE FROM)\s+public\.(?:event_|recruitment_|admin_users|history_photo_)/i);
 assert(executable.trim().endsWith('COMMIT;'));
});
