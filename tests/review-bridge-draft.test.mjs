import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const sql = readFileSync(new URL('../supabase/drafts/history-review-auth-bridge-v2.sql', import.meta.url), 'utf8');
test('review draft stays blocked and never mutates the team subsystem', () => {
 assert(sql.indexOf('DRAFT_ONLY:') < sql.indexOf('CREATE TABLE'));
 assert(!/CREATE\s+OR\s+REPLACE/i.test(sql));
 assert(!/(?:ALTER TABLE|UPDATE|INSERT INTO|DELETE FROM)\s+public\.(?:event_|recruitment_|admin_users)/i.test(sql));
 assert(!/ALTER POLICY|DROP\s+(?:TABLE|POLICY|FUNCTION)/i.test(sql));
});
test('eligibility and approval both exclude archived attendance evidence', () => {
 assert.equal((sql.match(/AND NOT a\.is_archived\)/g) || []).length, 2);
 for (const column of ['event_id', 'id', 'source', 'is_archived']) {
  assert(sql.includes(`('public.event_application_admin_list','${column}',`));
 }
 assert.equal((sql.match(/t\.confirmation='confirmed' AND NOT e\.is_test/g) || []).length, 2);
 assert(sql.includes('Identity reassignment requires a separate reviewed procedure'));
 assert(sql.includes('person_id uuid NOT NULL UNIQUE'));
});
test('direct insert and revoke ordering keep the server-side boundaries', () => {
 assert(sql.includes('AS RESTRICTIVE FOR INSERT TO PUBLIC'));
 assert(sql.includes('VOLATILE SECURITY INVOKER'));
 assert(sql.includes("current_setting('transaction_isolation') <> 'read committed'"));
 assert(sql.includes("hashtextextended(p_user::text,0)"));
 assert(sql.includes("hashtextextended(auth.uid()::text,0)"));
 assert(sql.includes('ON DELETE RESTRICT'));
 assert(sql.includes('SET search_path=\'\''));
});

test('column ACL check normalizes only absent or empty ACL, retaining nonempty entries', () => {
 assert(sql.includes('aclexplode(CASE WHEN cardinality(c.attacl)>0 THEN c.attacl ELSE NULL::aclitem[] END)'));
 assert(!sql.includes('aclexplode(coalesce(c.attacl,ARRAY[]::aclitem[]))'));
});
