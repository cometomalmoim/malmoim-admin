// Integration: real Supabase JS client + application signup/login/logout actions
// + real PostgreSQL SQL/RLS/trigger in memory. Auth HTTP responses are local
// fixtures; this never contacts Supabase, sends email, or creates a live account.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import {runInNewContext} from "node:vm";
import path from "node:path";
import ts from "typescript";
import {createClient,isAuthRetryableFetchError} from "@supabase/supabase-js";
import WebSocket from "ws";
import {PGlite} from "../work/sql/node_modules/@electric-sql/pglite/dist/index.js";
const require=createRequire(import.meta.url),root=path.resolve(import.meta.dirname,"..");
function load(name,mocks={}){
 const file=path.resolve(root,name),loaded={exports:{}};
 const {outputText}=ts.transpileModule(readFileSync(file,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
 runInNewContext(outputText,{module:loaded,exports:loaded.exports,Date,Intl,FormData,process:{env:{}},require:id=>Object.hasOwn(mocks,id)?mocks[id]:id==="server-only"?{}:id.startsWith("@/")?load("src/"+id.slice(2)+".ts",mocks):id.startsWith(".")?load(path.relative(root,path.resolve(path.dirname(file),id+".ts")),mocks):require(id)});
 return loaded.exports;
}
class Redirect extends Error{constructor(destination){super("Test redirect");this.destination=destination;}}
const db=new PGlite(),accounts=new Map(),sessions=new Map();let confirmEmail=false;
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{"Content-Type":"application/json"}});
const authError=(code,message,status=400)=>json({code,msg:message,error_code:code},status);
function session(user){
 const encode=value=>Buffer.from(JSON.stringify(value)).toString("base64url");
 const token=encode({alg:"HS256",typ:"JWT"})+"."+encode({sub:user.id,role:"authenticated",aud:"authenticated",exp:Math.floor(Date.now()/1000)+3600,session_id:crypto.randomUUID()})+"."+Buffer.from("local-fixture-signature").toString("base64url");
 sessions.set(token,user);
 return {access_token:token,token_type:"bearer",refresh_token:crypto.randomUUID(),expires_in:3600,user};
}
async function transport(input,init={}){
 const url=new URL(String(input));assert.equal(url.origin,"http://127.0.0.1:54321");
 const headers=new Headers(init.headers),token=headers.get("authorization")?.replace(/^Bearer /,""),user=sessions.get(token);
 const body=init.body?JSON.parse(init.body):{};
 if(url.pathname==="/auth/v1/signup"){
  const email=body.email.toLowerCase();if(accounts.has(email))return authError("user_already_exists","Already registered",422);
  const account={id:crypto.randomUUID(),email,aud:"authenticated",role:"authenticated",created_at:new Date().toISOString(),app_metadata:{provider:"email",providers:["email"]},user_metadata:body.data??{},identities:[{id:crypto.randomUUID(),provider:"email"}]};
  try{
   await db.exec("reset role");
   await db.query("insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3::jsonb)",[account.id,email,JSON.stringify(account.user_metadata)]);
  }catch{return authError("unexpected_failure","Profile transaction rejected",500);}
  accounts.set(email,{user:account,password:body.password,confirmed:!confirmEmail});
  return json(confirmEmail?account:session(account));
 }
 if(url.pathname==="/auth/v1/user")return user?json(user):authError("bad_jwt","Missing session",401);
 if(url.pathname==="/auth/v1/token"){
  const account=accounts.get(body.email?.toLowerCase());
  if(!account||account.password!==body.password)return authError("invalid_credentials","Invalid credentials");
  if(!account.confirmed)return authError("email_not_confirmed","Email not confirmed");
  return json(session(account.user));
 }
 if(url.pathname==="/auth/v1/logout"){sessions.delete(token);return new Response(null,{status:204});}
 const name=url.pathname.replace("/rest/v1/rpc/","");
 assert.ok(["member_registration_v2_ready","member_nickname_available","prepare_member_registration","save_member_registration_v2"].includes(name));
 await db.exec("reset role");await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user?.id??""]);
 await db.exec(user?"set role authenticated":"set role anon");
 try{
  const keys=Object.keys(body),parameters=keys.map((key,i)=>key+" => $"+(i+1));
  assert.ok(keys.every(key=>/^p_[a-z_]+$/.test(key)));
  const values=keys.map(key=>typeof body[key]==="object"?JSON.stringify(body[key]):body[key]);
  const result=await db.query(`select public.${name}(${parameters.join(",")}) value`,values);
  return json(result.rows[0].value);
 }catch(error){return json({code:error.code,message:"Fixture RPC rejected"},400);}
 finally{await db.exec("reset role");}
}
const backend=createClient("http://127.0.0.1:54321","sb_publishable_local_fixture",{realtime:{transport:WebSocket},global:{fetch:transport},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const policy=load("src/lib/member-registration-policy.ts").memberRegistrationPolicy;
const {registerMember}=load("src/lib/member-registration.ts");
const actions=load("src/app/actions/auth.ts",{"@/lib/supabase/server":{createClient:async()=>backend},"@supabase/supabase-js":{isAuthRetryableFetchError},"next/navigation":{redirect:destination=>{throw new Redirect(destination);}}});
const input=(email,nickname)=>({email,nickname,password:"FixtureOnly1!",passwordConfirmation:"FixtureOnly1!",name:"",phoneNumber:"",callingCode:"",nationality:"",gender:"",birthDate:"1980-01-01",koreanLevel:"basic",englishLevel:"native",foreignLanguages:[],termsConsent:true,privacyConsent:false,termsVersion:policy.termsVersion,privacyVersion:policy.privacyVersion,collectionVersion:policy.consentVersion});
const loginForm=email=>{const form=new FormData();form.set("email",email);form.set("password","FixtureOnly1!");return form;};
try{
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create table auth.users(id uuid primary key,email text unique,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to anon,authenticated;`);
 for(const file of ["supabase/001_admin_users.sql","supabase/drafts/20261017_member_board_review.sql","supabase/manual/20261022_member_signup_setup.sql"])await db.exec(readFileSync(file,"utf8"));
 const first=input("signup-flow@example.test","FlowMember");
 assert.equal((await registerMember(first,backend,policy)).status,"complete");
 const uid=(await backend.auth.getUser()).data.user.id;
 const profile=(await db.query("select * from member_profiles where user_id=$1",[uid])).rows[0];
 assert.equal(profile.birth_date.toISOString().slice(0,10),first.birthDate);
 assert.equal(profile.korean_proficiency,"basic");assert.equal(profile.english_proficiency,"native");assert.equal(profile.name,null);
 assert.equal((await db.query("select nickname from board_aliases where user_id=$1",[uid])).rows[0].nickname,first.nickname);
 assert.equal((await db.query("select terms_accepted from member_policy_acceptances where user_id=$1",[uid])).rows[0].terms_accepted,true);
 await assert.rejects(actions.memberLogout(),error=>error instanceof Redirect&&error.destination==="/");
 assert.equal((await backend.auth.getSession()).data.session,null);
 assert.equal((await registerMember(first,backend,policy)).status,"invalid","duplicate nickname/email must not create another account");
 const duplicate=await registerMember({...first,nickname:"OtherName"},backend,policy);assert.equal(duplicate.status,"invalid");assert.ok(duplicate.errors.email);
 await assert.rejects(actions.memberLogin({},loginForm(first.email)),error=>error instanceof Redirect&&error.destination==="/");
 assert.equal((await backend.auth.getUser()).data.user.id,uid);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]);
 await db.exec("set role authenticated");
 const post=(await db.query("select member_board_mutate('post_save',null,null,$1::jsonb,$2::uuid) id",[JSON.stringify({category:"free",title:"Signup flow fixture",content:"Isolated integration content"}),crypto.randomUUID()])).rows[0].id;
 const detail=(await db.query("select member_board_detail($1) data",[post])).rows[0].data;
 assert.equal(detail.post.author_name,first.nickname);assert.equal("author_id" in detail.post,false);
 await db.exec("reset role");
 await assert.rejects(actions.memberLogout(),error=>error instanceof Redirect&&error.destination==="/");
 // Confirm-email ON: profile already exists; verification then login needs no re-entry.
 confirmEmail=true;const second=input("verify-flow@example.test","VerifyMember");
 const confirmation=await registerMember(second,backend,policy,"en");assert.equal(confirmation.status,"confirmation");assert.match(confirmation.message,/do not need to enter/);
 const secondUid=accounts.get(second.email).user.id;
 assert.equal((await db.query("select count(*)::int count from member_profiles where user_id=$1",[secondUid])).rows[0].count,1);
 assert.equal((await db.query("select count(*)::int count from member_policy_acceptances where user_id=$1",[secondUid])).rows[0].count,1);
 assert.ok((await actions.memberLogin({},loginForm(second.email))).message);
 accounts.get(second.email).confirmed=true;
 await assert.rejects(actions.memberLogin({},loginForm(second.email)),error=>error instanceof Redirect&&error.destination==="/");
 await assert.rejects(actions.memberLogout(),error=>error instanceof Redirect&&error.destination==="/");
 assert.equal((await backend.auth.getSession()).data.session,null);
 assert.equal(accounts.size,2);
 console.log("PASS: SDK signup → real profile/alias/acceptance transaction → logout → password login → logout → authenticated board post; duplicate rejection; email-confirmation flow without profile re-entry (local fixtures only).");
}finally{await backend.auth.stopAutoRefresh();await db.close();}
