const fs=require('node:fs'),{connect}=require('../install-local.cjs'),{apply}=require('./apply-local.cjs');
const root=process.argv[2],{sql,t}=connect(root);if(t.dbPort!==60422||t.projectId!=='malmoim-photo-package-e118b7ab')throw Error('target');
const tests=[],ok=(n,v)=>{if(!v)throw Error('assertion '+n);tests.push(n);};
function as(role,q){return sql('BEGIN;'+(role.startsWith('photo_')?'GRANT '+role+' TO postgres WITH INHERIT FALSE,SET TRUE;':'')+'SET LOCAL ROLE '+role+';'+q+'ROLLBACK;');}
function deny(n,f){let rejected=false;try{f();}catch{rejected=true;}ok(n,rejected);}
let stage='verify';try{
 apply(root);const c=JSON.parse(fs.readFileSync(__dirname+'/contract.json'));
 const shared=()=>sql("BEGIN READ ONLY;SELECT md5(concat_ws('|',(SELECT string_agg(to_jsonb(p)::text,E'\\n' ORDER BY schemaname,tablename,policyname) FROM pg_policies p WHERE schemaname IN ('auth','storage') OR tablename='admin_users'),(SELECT string_agg(relacl::text,E'\\n' ORDER BY oid) FROM pg_class WHERE oid IN ('public.admin_users'::regclass,'auth.users'::regclass,'storage.objects'::regclass,'storage.buckets'::regclass)),(SELECT string_agg(prosrc||coalesce(proacl::text,''),E'\\n' ORDER BY oid) FROM pg_proc WHERE pronamespace IN ('auth'::regnamespace,'storage'::regnamespace))));ROLLBACK;");const before=shared();for(const role of ['photo_helper_reader_owner','photo_capability_owner','photo_finish_worker','authenticated','anon'])ok('actual role '+role,as(role,'SELECT current_user;')===role);stage='limited SELECT';
 ok('read helper executes with limited owner',as('photo_helper_reader_owner',"SELECT photo_scope_v3.verified_state('00000000-0000-4000-8000-000000000000'::uuid) IS NULL;")==='t');
 ok('metadata helper executes',as('photo_helper_reader_owner',"SELECT photo_service_v4.public_version('00000000-0000-4000-8000-000000000000'::uuid);")==='0');
 stage='denials';deny('reader cannot read auth users',()=>as('photo_helper_reader_owner','SELECT id FROM auth.users LIMIT 1;'));
 deny('reader cannot directly read admin_users',()=>as('photo_helper_reader_owner','SELECT user_id FROM public.admin_users LIMIT 1;'));
 deny('reader cannot access Storage objects',()=>as('photo_helper_reader_owner','SELECT id FROM storage.objects LIMIT 1;'));
 deny('reader cannot access receipt seal',()=>as('photo_helper_reader_owner','SELECT seal FROM photo_finish_v2.receipts LIMIT 1;'));
 deny('reader cannot update jobs',()=>as('photo_helper_reader_owner',"UPDATE photo_finish_v2.jobs SET state='blocked' WHERE false;"));
 deny('reader cannot insert capability',()=>as('photo_helper_reader_owner','INSERT INTO scope_private.capabilities DEFAULT VALUES;'));
 deny('reader cannot create schema objects',()=>as('photo_helper_reader_owner','CREATE TABLE photo_service_v4.forbidden_test(n integer);'));
 deny('reader cannot call commit',()=>as('photo_helper_reader_owner',"SELECT photo_finish_v2.commit('{}');"));
 deny('cap owner cannot UPDATE capability',()=>as('photo_capability_owner','UPDATE scope_private.capabilities SET revoked=true WHERE false;'));
 deny('cap owner cannot read capability records',()=>as('photo_capability_owner','SELECT jti FROM scope_private.capabilities LIMIT 1;'));
 deny('cap owner cannot read shared administrator table',()=>as('photo_capability_owner','SELECT user_id FROM public.admin_users LIMIT 1;'));
 deny('cap owner cannot call unrelated public RPC',()=>as('photo_capability_owner',"SELECT public.photo_service_command_v4('{}');"));
 deny('authenticated cannot call moved helper',()=>as('authenticated',"SELECT photo_service_v4.managed_job(gen_random_uuid(),gen_random_uuid());"));
 deny('anonymous cannot call capability helper',()=>as('anon',"SELECT photo_finish_v2.cap(gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),'photo_storage_issuer');"));
 deny('worker cannot call attestation helper',()=>as('photo_finish_worker',"SELECT photo_finish_v2.attest('{}');"));
 deny('worker cannot assume helper owner',()=>as('photo_finish_worker','SET ROLE photo_helper_reader_owner;'));
 ok('idempotent ownership apply',apply(root).changed===false);ok('shared schemas and policies unchanged',shared()===before);
 fs.writeFileSync(root+'/owner-hardening-result.json',JSON.stringify({passed:tests.length,checks:tests,moved:c.moved,remainingPostgres:c.remainingPostgres,sharedUnchanged:true},null,2));console.log(JSON.stringify({ownerPermissionTests:tests.length,movedFunctions:Object.keys(c.moved).length,remainingPostgres:c.remainingPostgres.length,sharedUnchanged:true}));
}catch(e){console.error('owner_permission_test_failed '+stage+' '+(String(e.message).startsWith('assertion ')?e.message:'SQL rejected'));process.exitCode=1;}
