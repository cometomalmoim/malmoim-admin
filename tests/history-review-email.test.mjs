import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {runInNewContext} from 'node:vm';import ts from 'typescript';
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',email='Member@example.invalid';
function setup(status='admin',data={id,email,confirmed:true,secret:'must not return'},error=null){const calls=[];const compiled={exports:{}};runInNewContext(ts.transpileModule(readFileSync('src/app/admin/history-review-access/actions.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module:compiled,exports:compiled.exports,require:n=>n==='@/lib/auth'?{getAdminAccess:async()=>({status})}:{createClient:async()=>({rpc:async(name,args)=>{calls.push({name,args});return {data,error};}})}});return {...compiled.exports,calls};}
for(const status of ['anonymous','denied','error'])test(`email search denies ${status} without account query`,async()=>{const api=setup(status);assert('error'in await api.findReviewMemberByEmail(email));assert.equal(api.calls.length,0);});
test('admin searches one exact email and returns only UUID/email/verification',async()=>{const api=setup();const result=await api.findReviewMemberByEmail(email);assert.equal(JSON.stringify(result),JSON.stringify({member:{id,email,confirmed:true}}));assert.equal(api.calls[0].name,'history_admin_find_review_member');assert.equal(api.calls[0].args.p_email,email);});
test('invalid inputs never reach database; not-found/duplicate/malformed responses fail closed',async()=>{
 for(const value of [null,{},['a@b.co'],'',' x@y.co','x@y.co ','x\n@y.co','a@b.co,c@d.co','a@b.co;c@d.co','a'.repeat(255)+'@b.co']){const api=setup();assert('error'in await api.findReviewMemberByEmail(value));assert.equal(api.calls.length,0);}
 for(const [data,error] of [[null,null],[null,{code:'21000'}],[{id,email:'wrong@example.invalid',confirmed:true},null],[[{id,email,confirmed:true}],null]])assert('error'in await setup('admin',data,error).findReviewMemberByEmail(email));
});
test('real in-memory PostgreSQL email lookup rejects non-admins, duplicates and wildcards',{skip:!process.env.REVIEW_ACL_PGLITE_MODULE},async()=>{
 const {PGlite}=await import(process.env.REVIEW_ACL_PGLITE_MODULE);const db=new PGlite();try{
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE SCHEMA auth;
 CREATE TABLE public.admin_users(user_id uuid);CREATE TABLE auth.users(id uuid,email text,email_confirmed_at timestamptz);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '${id}'::uuid $$;
 GRANT USAGE ON SCHEMA auth,public TO anon,authenticated;GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated;
 INSERT INTO auth.users VALUES ('${id}','${email}',now()),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','duplicate@example.invalid',null),('cccccccc-cccc-4ccc-8ccc-cccccccccccc','duplicate@example.invalid',null);`);
 const sql=readFileSync('supabase/review-release/04_admin_review_member_email.sql','utf8');const start=sql.indexOf('CREATE FUNCTION public.history_admin_find_review_member');await db.exec(sql.slice(start,sql.indexOf('\nDO $$ BEGIN',start)));
 for(const role of ['anon','authenticated']){await db.exec('BEGIN');await db.exec(`SET LOCAL ROLE ${role}`);await assert.rejects(db.query('SELECT public.history_admin_find_review_member($1)',[email]),e=>e.code==='42501');await db.exec('ROLLBACK');}
 await db.query('INSERT INTO public.admin_users VALUES ($1)',[id]);await db.exec('SET ROLE authenticated');
 const find=async value=>(await db.query('SELECT public.history_admin_find_review_member($1) AS member',[value])).rows[0].member;
 assert.deepEqual(await find(email),{id,email,confirmed:true});assert.deepEqual(await find('member@example.invalid'),{id,email,confirmed:true});assert.equal(await find('%@example.invalid'),null);assert.equal(await find('missing@example.invalid'),null);
 await assert.rejects(find('duplicate@example.invalid'),e=>e.code==='21000');
 await db.exec('RESET ROLE');await db.query('INSERT INTO auth.users VALUES ($1,$2,NULL)',['dddddddd-dddd-4ddd-8ddd-dddddddddddd','MEMBER@EXAMPLE.INVALID']);await db.exec('SET ROLE authenticated');await assert.rejects(find(email),e=>e.code==='21000');await assert.rejects(find('a@b.co,c@d.co'),e=>e.code==='22023');
 }finally{await db.close();}
});
test('server accepts Auth-normalized case while preserving stored email and rejecting a different address',async()=>{
 const api=setup('admin',{id,email:'member@example.invalid',confirmed:true});
 assert('member'in await api.findReviewMemberByEmail('MEMBER@EXAMPLE.INVALID'));
 assert.equal(api.calls[0].args.p_email,'MEMBER@EXAMPLE.INVALID');
 assert('error'in await api.findReviewMemberByEmail('other@example.invalid'));
});
