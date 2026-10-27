import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {runInNewContext} from 'node:vm';import ts from 'typescript';
function load(path,imports){const compiled={exports:{}};runInNewContext(ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:compiled,exports:compiled.exports,require:n=>imports[n]});return compiled.exports;}
const uid='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',pid='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
function setup(status='admin',failure=false){const calls=[];const actions=load('src/app/admin/history-review-access/actions.ts',{'@/lib/auth':{getAdminAccess:async()=>({status})},'@/lib/supabase/server':{createClient:async()=>({rpc:async(name,args)=>{calls.push({name,args});return {data:name==='history_manage_participant'?1:{member:{id:uid}},error:failure?{}:null};}})}});return {...actions,calls};}
const input={user:uid,person:pid,action:'approve',revision:0,identity:true,source:'manual',application:pid,reason:'Verified by administrator'};
for(const status of ['anonymous','denied','error'])test(`admin actions deny ${status} before querying identities or writing`,async()=>{const api=setup(status);assert('error'in await api.inspectReviewMember(uid,pid));assert('error'in await api.manageReviewMember(input));assert.equal(api.calls.length,0);});
test('administrator reads only exact IDs via read RPC and mutation only through audited management RPC',async()=>{const api=setup();assert('data'in await api.inspectReviewMember(uid,pid));assert('revision'in await api.manageReviewMember(input));assert.deepEqual(api.calls.map(c=>c.name),['history_admin_review_context','history_manage_participant']);assert.equal(api.calls[1].args.p_identity_confirmed,true);assert.equal(api.calls[1].args.p_revision,0);assert.equal(api.calls[1].args.p_reason,input.reason);});
test('invalid IDs, unverified identity, unknown source, missing reason and stale-shaped revisions never reach write RPC',async()=>{for(const changes of [{user:'not-a-uuid'},{identity:false},{source:'invented'},{reason:' '},{revision:-1},{revision:1.2},{application:''}]){const api=setup();assert('error'in await api.manageReviewMember({...input,...changes}));assert.equal(api.calls.length,0);}});
test('revocation can use current revision without current attendance and delegates authority to original RPC',async()=>{const api=setup();assert('revision'in await api.manageReviewMember({...input,action:'revoke',revision:1,identity:false,source:'',application:''}));assert.equal(api.calls[0].args.p_action,'revoke');assert.equal(api.calls[0].args.p_application,null);});
test('missing SQL or RPC failure is shown as infrastructure failure, not lack of participation',async()=>{const api=setup('admin',true);assert.match((await api.inspectReviewMember(uid,pid)).error,/RPC/);assert.match((await api.manageReviewMember(input)).error,/다시 조회/);});
test('new read RPC requires admin before identity access and never mutates existing records',()=>{const sql=readFileSync('supabase/review-release/03_admin_review_context.sql','utf8');assert(sql.indexOf('Administrator required')<sql.indexOf('FROM auth.users'));assert.match(sql,/SECURITY DEFINER SET search_path=''/);assert.match(sql,/REVOKE ALL[\s\S]*FROM PUBLIC,anon,authenticated,service_role/);assert.doesNotMatch(sql,/(?:INSERT INTO|UPDATE|DELETE FROM|ALTER TABLE)\s+(?:public|auth)\./i);for(const condition of ["confirmation='confirmed'","NOT e.is_test","NOT a.is_archived","s.session_date<="])assert(sql.includes(condition));});
test('cohort aggregates require explicit mappings, retain unclassified records and contain no personal outputs',()=>{const sql=readFileSync('supabase/review-release/00b_historical_eligibility_counts_readonly.sql','utf8');assert.match(sql,/BEGIN READ ONLY/);assert.match(sql,/cohort_map\(cohort,event_id\)/);assert.match(sql,/LEFT JOIN cohort_map/);assert.doesNotMatch(sql,/jsonb_build_object\([^;]*(?:'email'|'contact'|'person_id')/s);assert(sql.includes('excluded_sessions_exist_but_only_event_attendance'));});
test('manager requires inspection, identity confirmation, eligible evidence and reason; changing IDs clears approval state',async()=>{
 const React=await import('react');const runtime=await import('react/jsx-runtime');
 const hooks=[];let at=0;const tasks=[];const writes=[];const searches=[];
 const context={member:{id:uid,email:'synthetic@example.invalid',confirmed:true},person:{id:pid,name:'Synthetic participant',contact:'Synthetic contact'},link:null,evidence:[{source:'manual',application:pid,title:'Synthetic attended activity',starts_at:null,confirmation:'confirmed',attendance:'attended',archived:false,eligible:true}],audit:[]};
 const mockReact={...React,useRef(initial){const i=at++;return hooks[i]??=( {current:initial} );},useState(initial){const i=at++;if(!(i in hooks))hooks[i]=initial;return [hooks[i],v=>{hooks[i]=typeof v==='function'?v(hooks[i]):v;}];},useTransition(){return [false,fn=>tasks.push(Promise.resolve(fn()))];}};
 const compiled={exports:{}};runInNewContext(ts.transpileModule(readFileSync('src/app/admin/history-review-access/review-access-manager.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{module:compiled,exports:compiled.exports,require:n=>n==='react'?mockReact:n==='react/jsx-runtime'?runtime:n==='next/link'?{default:()=>null}:{findReviewMemberByEmail:async email=>{searches.push(email);return {member:context.member};},inspectReviewMember:async()=>({data:context}),manageReviewMember:async v=>{writes.push(v);return {revision:1};}}});
 function nodes(n){if(!n||typeof n!=='object')return [];if(Array.isArray(n))return n.flatMap(nodes);return [n,...nodes(n.props?.children)];}
 const render=()=>{at=0;return nodes(compiled.exports.ReviewAccessManager());};
 let tree=render();tree.find(n=>n.type==='input'&&n.props.type==='email').props.onChange({target:{value:'synthetic@example.invalid'}});
 const searchButton=()=>render().find(n=>n.type==='button'&&n.props.children==='회원 이메일 검색');
 assert.equal(searchButton().props.type,'button');
 assert(render().filter(n=>n.type==='input'&&!n.props.type).every(n=>n.props.value===''&&n.props.required));
 render().find(n=>n.type==='input'&&n.props.type==='email').props.ref.current={reportValidity:()=>false};searchButton().props.onClick();assert.equal(searches.length,0);
 render().find(n=>n.type==='input'&&n.props.type==='email').props.ref.current={reportValidity:()=>true};
 render().find(n=>n.type==='button'&&n.props.children==='회원 이메일 검색').props.onClick();await Promise.all(tasks.splice(0));
 tree=render();assert.equal(searches.length,1);assert.equal(writes.length,0);assert(!tree.some(n=>n.type==='button'&&n.props.children==='후기 작성 권한 승인'));
 const ids=tree.filter(n=>n.type==='input'&&!n.props.type);assert.equal(ids.length,2);assert.equal(ids[0].props.value,uid);
 ids[1].props.onChange({target:{value:pid}});
 render().find(n=>n.type==='form'&&n.props['aria-label']==='회원·참가 이력 조회').props.onSubmit({preventDefault(){}});await Promise.all(tasks.splice(0));tree=render();
 const approve=()=>render().find(n=>n.type==='button'&&n.props.children==='후기 작성 권한 승인');assert.equal(approve().props.disabled,true);
 tree.find(n=>n.type==='input'&&n.props.type==='radio').props.onChange();assert.equal(approve().props.disabled,true);
 render().find(n=>n.type==='input'&&n.props.type==='checkbox').props.onChange({target:{checked:true}});
 render().find(n=>n.type==='textarea').props.onChange({target:{value:'Direct identity verified'}});assert.equal(approve().props.disabled,false);
 approve().props.onClick();await Promise.all(tasks.splice(0));assert.equal(writes.length,1);assert.equal(writes[0].revision,0);assert.equal(writes[0].identity,true);
 render().find(n=>n.type==='input'&&!n.props.type).props.onChange({target:{value:pid}});
 assert(!render().some(n=>n.type==='button'&&n.props.children==='후기 작성 권한 승인'));
});
test('post-install verification includes exact read RPC signature and missing-function detection',()=>{const sql=readFileSync('supabase/review-release/02_verify_readonly.sql','utf8');assert(sql.includes('public.history_admin_review_context(uuid,uuid)'));assert(sql.includes('function_presence'));assert(sql.includes('service_role_execute'));});
test('in-memory PostgreSQL denies anonymous EXECUTE and non-admin direct read RPC before accessing personal tables',{skip:!process.env.REVIEW_ACL_PGLITE_MODULE},async()=>{
 const {PGlite}=await import(process.env.REVIEW_ACL_PGLITE_MODULE);const db=new PGlite();
 try {
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE SCHEMA auth;
 CREATE TABLE public.admin_users(user_id uuid);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid$$;
 GRANT USAGE ON SCHEMA auth,public TO anon,authenticated;GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated;`);
 const sql=readFileSync('supabase/review-release/03_admin_review_context.sql','utf8');
 const definition=sql.slice(sql.indexOf('CREATE FUNCTION public.history_admin_review_context'),sql.indexOf('\nDO $$ BEGIN',sql.indexOf('CREATE FUNCTION public.history_admin_review_context')));
 await db.exec(definition);
 for(const role of ['anon','authenticated']) {
 await db.exec('BEGIN');await db.exec(`SET LOCAL ROLE ${role}`);
 await assert.rejects(db.query(`SELECT public.history_admin_review_context('${uid}','${pid}')`),e=>e.code==='42501'&&(role==='anon'?/permission denied/i:/Administrator required/i).test(e.message));
 await db.exec('ROLLBACK');
 }
 // No auth.users, participant or audit table even exists in this test instance:
 // unauthorized calls must exit before reaching those personal data reads.
 }finally{await db.close();}
});
