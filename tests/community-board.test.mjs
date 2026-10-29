import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import {runInNewContext} from "node:vm";
import {test} from "node:test";
import ts from "typescript";
const require=createRequire(import.meta.url);
function load(file,mocks={}){
 const loaded={exports:{}};
 const {outputText}=ts.transpileModule(readFileSync(new URL("../"+file,import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}});
 runInNewContext(outputText,{module:loaded,exports:loaded.exports,FormData,Date,URLSearchParams,process:{env:{NODE_ENV:"test"}},require:id=>Object.hasOwn(mocks,id)?mocks[id]:id.startsWith("@/")?load("src/"+id.slice(2)+".ts",mocks):require(id)});
 return loaded.exports;
}
const model=load("src/lib/community-board-model.ts");
const id="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",other="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
function form(values={}){const f=new FormData();for(const[k,v]of Object.entries({action:"post_save",category:"free",title:"Title",content:"Content",nonce:id,locale:"en",...values}))f.set(k,v);return f;}
test("query filters are bounded and encoded without accepting arbitrary category/status/scope",()=>{
 const q=model.communityQuery({q:"  hello world  ",page:"2",category:"question",period:"month",scope:"comments"});
 assert.equal(q.page,2);assert.equal(q.q,"hello world");
 assert.match(model.boardHref("/en/board",q),/q=hello\+world/);
 const bad=model.communityQuery({category:"notice2",scope:"sql",period:"yesterday",page:"-1",status:"unknown",q:"x".repeat(1000)});
 assert.equal(bad.category,"all");assert.equal(bad.scope,"all");assert.equal(bad.page,1);assert.equal(bad.q.length,100);
});
test("post/comment validation rejects blank, overlong, notice escalation and malformed target",()=>{
 for(const fields of [{title:" "},{content:" "},{title:"x".repeat(201)},{content:"x".repeat(20001)},{category:"notice"}])
  assert.throws(()=>model.communityInput("post_save",form(fields),false));
 assert.equal(model.communityInput("post_save",form({category:"notice"}),true).category,"notice");
 assert.throws(()=>model.communityInput("post_save",form({category:"free"}),true));
 assert.throws(()=>model.communityInput("comment_save",form({post_id:"bad"}),false));
 assert.throws(()=>model.communityInput("comment_save",form({post_id:id,content:"x".repeat(2001)}),false));
 assert.throws(()=>model.communityInput("hide_post",form({reason:"test"}),false));
 assert.throws(()=>model.communityInput("hide_post",form({reason:" "}),true));
 const input=model.communityInput("post_save",form({author_id:other,status:"hidden",is_pinned:"true",view_count:"100"}),false);
 assert.deepEqual(Object.keys(input).sort(),["category","content","title"]);
});
function actions({user={id},admin=false,owner=true,rpcError=null,throwClient=false}={}){
 const calls=[],refresh=[];
 const api=load("src/app/actions/community-board.ts",{
  "next/cache":{updateTag:tag=>{assert.equal(tag,"public-announcements");},revalidatePath:path=>refresh.push(path)},
  "next/navigation":{redirect:path=>{throw new Error("REDIRECT:"+path);}},
  "@/lib/auth":{getAdminAccess:async()=>({status:admin?"admin":"denied"})},
  "@/lib/supabase/server":{createClient:async()=>{if(throwClient)throw new Error("private-secret-error");return{
   auth:{getUser:async()=>({data:{user},error:null})},
   rpc:async(name,args)=>{calls.push({name,args});return{name,data:name==="member_board_can_change"?owner:id,error:rpcError};},
  };}},
 });
 return{api,calls,refresh};
}
test("anonymous and forged administrator mutations stop before writes",async()=>{
 const anon=actions({user:null});assert.match((await anon.api.mutateCommunity({},form())).message,/log in/);assert.equal(anon.calls.length,0);
 const forged=actions();assert.match((await forged.api.mutateCommunity({},form({admin:"true",category:"notice"}))).message,/Administrator/);assert.equal(forged.calls.length,0);
});
test("server checks the owner before editing or deleting another author's post/comment",async()=>{
 for(const action of ["post_save","post_delete","comment_save","comment_delete"]){
  const a=actions({admin:true,owner:false});
  const result=await a.api.mutateCommunity({},form({action,id,version:"2026-10-17T00:00:00.000Z"}));
  assert.match(result.message,/cannot change/);assert.equal(a.calls.length,1);assert.equal(a.calls[0].name,"member_board_can_change");
 }
});
test("valid save uses the existing client with no submitted author/status and retains English destination",async()=>{
 const a=actions({admin:true});
 await assert.rejects(a.api.mutateCommunity({},form({author_id:other,status:"hidden",is_pinned:"true"})),/REDIRECT:\/en\/board\//);
 assert.equal(a.calls[0].name,"member_board_mutate");assert.equal("author_id"in a.calls[0].args.p_input,false);
 assert.equal("status"in a.calls[0].args.p_input,false);assert.ok(a.refresh.includes("/en/board"));
});
test("database/stale/network failures give safe messages, no success and no redirects",async()=>{
 const a=actions({admin:true,rpcError:{code:"40001",message:"private SQL details"}}),result=await a.api.mutateCommunity({},form());
 assert.match(result.message,/Could not save/);assert.equal(result.success,undefined);assert.doesNotMatch(result.message,/private SQL/);assert.equal(a.refresh.length,0);
 const unavailable=actions({throwClient:true});assert.doesNotMatch((await unavailable.api.mutateCommunity({},form())).message,/private-secret/);
});
test("forged operation IDs, timestamps and nonces are rejected without mutation",async()=>{
 for(const values of [{action:"DROP TABLE"},{id:"bad",version:"bad"},{id,version:"bad"},{nonce:"bad"}]){
  const a=actions({admin:true});assert.match((await a.api.mutateCommunity({},form(values))).message,/input/);assert.equal(a.calls.length,0);
 }
});
test("view counting requires a verified member and never runs for anonymous",async()=>{
 const a=actions({user:null});await a.api.recordCommunityView(id);assert.equal(a.calls.length,0);
 const member=actions();await member.api.recordCommunityView(id);assert.equal(member.calls[0].args.p_action,"view");
});

test("login return targets are limited to localized board screens, never external/admin paths",()=>{
 const {boardReturnPath}=load("src/lib/public-locale.ts");
 assert.equal(boardReturnPath("/board/new","en"),"/en/board/new");
 assert.equal(boardReturnPath("/en/board/"+id+"/edit","ko"),"/board/"+id+"/edit");
 for(const value of ["https://evil.test","//evil.test","/admin","/login","/board/new?next=https://evil.test","/board/../admin","/en/admin",null])
  assert.equal(boardReturnPath(value,"en"),null);
});

test("all six periods and independent administrator author/pin filters are bounded",()=>{
 for(const period of ["all","day","week","month","quarter","year"])
  assert.equal(model.communityQuery({period}).period,period);
 const query=model.communityQuery({author:"  Member-example  ",pinned:"pinned",scope:"comments",period:"day"});
 assert.equal(query.author,"Member-example");assert.equal(query.pinned,"pinned");
 assert.equal(model.communityQuery({author:"x".repeat(200),pinned:"truthy"}).author.length,100);
 assert.equal(model.communityQuery({pinned:"truthy"}).pinned,"all");
});
test("only a verified administrator can pin or unpin a general post",async()=>{
 for(const is_pinned of ["true","false"]){
  const values={action:"pin",id,version:"2026-10-17T00:00:00.000Z",is_pinned,reason:"Reviewed post"};
  const member=actions();assert.match((await member.api.mutateCommunity({},form(values))).message,/Administrator/);assert.equal(member.calls.length,0);
  const admin=actions({admin:true});assert.equal((await admin.api.mutateCommunity({},form(values))).success,true);
  assert.equal(admin.calls.length,1);assert.equal(admin.calls[0].args.p_action,"pin");
  assert.equal(admin.calls[0].args.p_input.is_pinned,is_pinned==="true");
  assert.ok(admin.refresh.includes("/board"));assert.ok(admin.refresh.includes("/admin/member-board"));
 }
});

test("database failures distinguish setup, permission, stale, rate and input errors without raw details",()=>{
 const cases=[["PGRST202",/not ready/],["PGRST205",/not ready/],["42501",/permissions/],["40001",/changed/],["P0003",/Too many/],["23505",/already/],["23514",/input/],["23502",/input/],["22P02",/input/]];
 for(const [code,expected]of cases)assert.match(model.communitySaveError(code,"en"),expected);
 assert.match(model.communitySaveError("PGRST202","ko"),/준비되지/);
 assert.doesNotMatch(model.communitySaveError("private SQL secret","en"),/secret/);
});
test("unavailable database never redirects, revalidates or reports successful insertion",async()=>{
 for(const code of ["PGRST202","PGRST205","42501","P0003","23505","23514"]){
  const a=actions({rpcError:{code,message:"private SQL secret"}});
  const result=await a.api.mutateCommunity({},form());
  assert.equal(result.success,undefined);assert.equal(a.refresh.length,0);
  assert.doesNotMatch(result.message,/private SQL secret/);
 }
});

test("detail rendering preserves legacy content but no member writing controls; existing comments retain pagination",async()=>{
 const React=require("react"),{renderToStaticMarkup}=require("react-dom/server");
 const {CommunityDetailView}=load("src/components/community/board-detail.tsx",{
  "./board-form":{BoardForm:({action})=>React.createElement("form",{"data-action":action}),CommunityViewCounter:()=>null},
  "./board-list":{date:()=>"Oct 20, 2026"},
 });
 const data={post:{id,category:"free",title:"Original title",content:"Original line\nhttps://example.com/long",author_name:"Member-public-alias",created_at:"2026-10-20T00:00:00Z",updated_at:"2026-10-20T00:00:00Z",view_count:2,is_pinned:false,status:"public",can_edit:false},comments:[],comment_total:0,comment_page:1,authenticated:false,admin:false};
 const render=(overrides={})=>renderToStaticMarkup(React.createElement(CommunityDetailView,{data:{...data,...overrides},locale:"en"}));
 const anon=render();
 assert.match(anon,/Original line\nhttps:\/\/example.com\/long/);
 assert.match(anon,/Member-public-alias/);assert.doesNotMatch(anon,/Log in to write a comment/);
 assert.doesNotMatch(anon,/data-action="(?:post_delete|report|comment_save)"/);
 assert.doesNotMatch(anon,/aria-label="Comment pages"/);
 const owner=render({authenticated:true,post:{...data.post,can_edit:true}});
 assert.doesNotMatch(owner,/data-action="(?:post_delete|report|comment_save)"/);
 assert.doesNotMatch(owner,new RegExp("/en/board/"+id+"/edit"));
 assert.match(render({comment_total:31}),/aria-label="Comment pages"/);
 assert.doesNotMatch(render({comment_total:0,comment_page:2}),/cp=1/);
});

test("localized loading variants announce busy state and never duplicate the public header",()=>{
 const React=require("react"),{renderToStaticMarkup}=require("react-dom/server");
 const {CommunityLoading}=load("src/components/community/board-loading.tsx",{"./community.css":{}});
 for(const locale of ["ko","en"])for(const view of ["list","detail","new","edit"]){
  const html=renderToStaticMarkup(React.createElement(CommunityLoading,{locale,view}));
  assert.match(html,/aria-busy="true"/);assert.match(html,/role="status"/);
  assert.doesNotMatch(html,/<header|public-header|<form/);
  assert.equal(html.includes("community-skeleton-rows"),view==="list");
  assert.equal(html.includes("community-skeleton-textarea"),view==="new"||view==="edit");
 }
});
