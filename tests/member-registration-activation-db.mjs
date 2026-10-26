// Disposable in-memory PostgreSQL only. Never reads .env or contacts Supabase.
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {PGlite} from "../work/sql/node_modules/@electric-sql/pglite/dist/index.js";
const db=new PGlite();
try{
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create table auth.users(id uuid primary key,email text unique,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),nullif(current_setting('test.uid',true),''))::uuid$$;
 grant usage on schema auth to anon,authenticated;
 insert into auth.users values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');`);
 for(const file of ["supabase/001_admin_users.sql","supabase/drafts/20261017_member_board_review.sql"])await db.exec(await readFile(file,"utf8"));
 await db.exec("select set_config('test.uid','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false)");
 await db.query("select member_board_mutate('post_save',null,null,$1::jsonb,$2::uuid)",[JSON.stringify({category:"free",title:"Existing fixture",content:"Must remain unchanged"}),crypto.randomUUID()]);
 const preserved=(await db.query("select to_jsonb(p) snapshot from board_posts p")).rows[0].snapshot;
 await db.exec("select set_config('test.uid','',false)");
 const setup=await readFile("supabase/manual/20261022_member_signup_setup.sql","utf8");
 await db.exec(setup);

 const policy=(await db.query("select * from member_registration_policies")).rows[0];
 assert.equal(policy.terms_version,"terms-v1");assert.equal(policy.privacy_version,"privacy-v1");
 assert.equal(policy.collection_basis,"contract");assert.equal(policy.terms_snapshot.sections.length,18);assert.equal(policy.privacy_snapshot.sections.length,16);
 assert.doesNotMatch(JSON.stringify(policy),/운영 확인 필요|Operational verification required|최종 승인 후 기재/);
 assert.equal("mode" in policy,false);assert.equal("stage" in policy.terms_snapshot,false);
 assert.equal("approved" in policy,false);assert.equal(policy.enabled,true);
 assert.equal("terms_effective_date" in policy,false);assert.equal("privacy_effective_date" in policy,false);
 assert.equal("effectiveDate" in policy.terms_snapshot,false);
 await db.exec("set role anon");
 const ready=(await db.query("select member_registration_v2_ready() ready")).rows[0].ready;
 assert.deepEqual(ready,{enabled:true,terms_version:policy.terms_version,privacy_version:policy.privacy_version,collection_version:policy.collection_version,requires_consent:false});
 await assert.rejects(()=>db.query("select * from member_registration_policies"));
 await assert.rejects(()=>db.query("select member_registration_ready()"));
 await db.exec("reset role;select set_config('test.uid','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);set role authenticated;");
 const profile={name:null,phone_country_code:null,phone_number:null,nationality_code:null,gender:null,birth_date:"1980-01-01",korean_proficiency:"basic",english_proficiency:"native"};
 const args=["언어친구",JSON.stringify(profile),policy.collection_version,policy.terms_version,policy.privacy_version];
 const query="select save_member_registration_v2($1,$2::jsonb,'[]'::jsonb,$3,$4,$5,$6,false) id";
 await assert.rejects(()=>db.query(query,[...args,false]));
 assert.equal((await db.query(query,[...args,true])).rows[0].id,"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
 await db.exec("reset role");
 const evidence=(await db.query("select * from member_policy_acceptances")).rows[0];
 assert.equal(evidence.collection_version,policy.collection_version);assert.equal(evidence.terms_accepted,true);assert.equal(evidence.collection_accepted,false);
 assert.equal((await db.query("select count(*)::int count from member_profiles")).rows[0].count,1);
 await db.query("update member_profiles set name='Preserved optional fixture' where user_id=$1",["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"]);
 await db.query("insert into member_languages(user_id,language_code,proficiency) values($1,'ja','basic')",["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"]);
 await db.exec("set role authenticated");await db.query(query,[...args,true]);await db.exec("reset role");
 assert.equal((await db.query("select name from member_profiles")).rows[0].name,"Preserved optional fixture");
 assert.equal((await db.query("select count(*)::int count from member_languages")).rows[0].count,1);
 assert.deepEqual((await db.query("select to_jsonb(p) snapshot from board_posts p")).rows[0].snapshot,preserved);
 // Confirm-email ON: Auth's INSERT, profile, alias and acceptance commit together
 // without any browser session. No raw DOB/profile appears in Auth metadata.
 await db.exec("select set_config('test.uid','',false);set role anon");
 const prepareArgs=["new-signup@example.test","새언어친구",JSON.stringify(profile),policy.collection_version,policy.terms_version,policy.privacy_version];
 const prepare="select prepare_member_registration($1,$2,$3::jsonb,'[]'::jsonb,$4,$5,$6,true,false) token";
 const token=(await db.query(prepare,prepareArgs)).rows[0].token;
 await assert.rejects(()=>db.query("select * from member_signup_requests"));
 await db.exec("reset role");
 const newUid="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
 await db.query("insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3::jsonb)",[newUid,prepareArgs[0],JSON.stringify({malmoim_registration_token:token})]);
 assert.equal((await db.query("select count(*)::int count from member_profiles where user_id=$1",[newUid])).rows[0].count,1);
 assert.equal((await db.query("select count(*)::int count from member_policy_acceptances where user_id=$1",[newUid])).rows[0].count,1);
 assert.equal((await db.query("select count(*)::int count from member_signup_requests where token=$1",[token])).rows[0].count,0);
 assert.equal((await db.query("select auth.uid() uid")).rows[0].uid,null,"trigger must restore the caller's claim");
 await assert.rejects(()=>db.query("insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3::jsonb)",["cccccccc-cccc-4ccc-8ccc-cccccccccccc",prepareArgs[0],JSON.stringify({malmoim_registration_token:token})]));
 // Another user's request, expired tokens, duplicate nickname, or malformed
 // profiles cannot leave behind an Auth account or partial acceptance.
 const candidate="cccccccc-cccc-4ccc-8ccc-cccccccccccc";
 for(const [email,nickname,profileInput,mode] of [["other@example.test","別nickname",profile,"email"],["expired@example.test","ExpiredName",profile,"expired"],["collision@example.test","새언어친구",profile,"nickname"],["invalid@example.test","InvalidLevel",{...profile,name:"x".repeat(101)},"profile"]]){
  await db.exec("set role anon");
  const safeNickname=mode==="email"?"OtherName":nickname;
  const request=(await db.query(prepare,[email,safeNickname,JSON.stringify(profileInput),...prepareArgs.slice(3)])).rows[0].token;
  await db.exec("reset role");
  if(mode==="expired")await db.query("update member_signup_requests set expires_at=now()-interval '1 second' where token=$1",[request]);
  await assert.rejects(()=>db.query("insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3::jsonb)",[candidate,mode==="email"?"mismatch@example.test":email,JSON.stringify({malmoim_registration_token:request})]));
  assert.equal((await db.query("select count(*)::int count from auth.users where id=$1",[candidate])).rows[0].count,0);
  assert.equal((await db.query("select count(*)::int count from member_profiles where user_id=$1",[candidate])).rows[0].count,0);
 }
 await db.query("insert into auth.users(id,email) values($1,'unrelated@example.test')",[candidate]);
 assert.equal((await db.query("select count(*)::int count from member_profiles where user_id=$1",[candidate])).rows[0].count,0,"unrelated Auth accounts remain unaffected");
 await assert.rejects(()=>db.exec(setup),/Existing signup tables/);
 await db.exec("rollback");
 // New release bundles append evidence; old dates/snapshots/evidence never change.
 await assert.rejects(()=>db.query("update member_policy_acceptances set accepted_at=now()"),/immutable/);
 const clone="insert into member_registration_policies(collection_version,terms_version,privacy_version,collection_basis,terms_snapshot,privacy_snapshot,collection_snapshot,enabled) select $1,$2,$3,collection_basis,terms_snapshot||jsonb_build_object('version',$2::text),privacy_snapshot||jsonb_build_object('version',$3::text),collection_snapshot||jsonb_build_object('version',$1::text),false from member_registration_policies where collection_version=$4";
 await db.query(clone,["signup-v2","terms-v2","privacy-v2",policy.collection_version]);
 await db.query("update member_registration_policies set enabled=false where enabled");
 await db.query("update member_registration_policies set enabled=true where collection_version='signup-v2'");
 assert.equal((await db.query("select member_registration_v2_ready() ready")).rows[0].ready.collection_version,"signup-v2");
 await db.exec("select set_config('test.uid','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);set role authenticated");
 await db.query(query,[...args.slice(0,2),"signup-v2","terms-v2","privacy-v2",true]);
 await db.exec("reset role");
 assert.deepEqual((await db.query("select * from member_policy_acceptances where user_id=$1 and collection_version=$2",[evidence.user_id,evidence.collection_version])).rows[0],evidence);
 assert.equal((await db.query("select count(*)::int count from member_policy_acceptances where user_id=$1",[evidence.user_id])).rows[0].count,2);

 await assert.rejects(()=>db.query("update member_registration_policies set terms_snapshot=terms_snapshot||$1::jsonb where collection_version='signup-v2'",[JSON.stringify({changed:true})]),/immutable/);
 assert.deepEqual((await db.query("select to_jsonb(p) snapshot from board_posts p")).rows[0].snapshot,preserved);
 console.log("Single signup installer: immediate availability, versioned document evidence, immutable accepted snapshots/evidence, private access, required acceptance, atomic profile/evidence save, and duplicate-apply protection passed (memory database only).");
}finally{await db.close();}
