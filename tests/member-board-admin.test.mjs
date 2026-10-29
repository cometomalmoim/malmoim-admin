import assert from "node:assert/strict";
import {readFileSync,existsSync,mkdirSync,writeFileSync} from "node:fs";
import {createRequire} from "node:module";
import {runInNewContext} from "node:vm";
import {test} from "node:test";
import ts from "typescript";
import {PassThrough} from "node:stream";
const require=createRequire(import.meta.url);
function load(file,mocks={},cache=new Map()){
 if(cache.has(file))return cache.get(file);
 const loaded={exports:{}};cache.set(file,loaded.exports);
 const {outputText}=ts.transpileModule(readFileSync(new URL("../"+file,import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}});
 runInNewContext(outputText,{module:loaded,exports:loaded.exports,FormData,Date,URLSearchParams,process:{env:{NODE_ENV:"test"}},require:id=>{
  if(Object.hasOwn(mocks,id))return mocks[id];
  if(id==="server-only"||id.endsWith(".css"))return {};
  if(!id.startsWith("@/")&&!id.startsWith("."))return require(id);
  const path=id.startsWith("@/")?"src/"+id.slice(2):file.slice(0,file.lastIndexOf("/")+1)+id.replace(/^\.\//,"");
  const target=[path,path+".ts",path+".tsx"].find(p=>existsSync(new URL("../"+p,import.meta.url)));
  if(!target)throw new Error("Missing test module: "+id);
  return load(target,mocks,cache);
 }});return loaded.exports;
}
const model=load("src/lib/member-board-admin-model.ts");
const id="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",postId="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",commentId="cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const post={id:postId,category:"question",title:"한국어 문법 질문",content:"Original post",author_name:"Member-post",status:"public",updated_at:"2026-10-20T00:00:00Z"};
const comment={id:commentId,post_id:postId,content:"Original comment",author_name:"Member-comment",status:"public",updated_at:"2026-10-20T01:00:00Z",post};
const report={id,post_id:null,comment_id:commentId,reason:"abuse",detail:"Report details",original_content:"Original comment",status:"pending",created_at:"2026-10-20T02:00:00Z",updated_at:"2026-10-20T02:00:00Z",post:null,comment};
const timeline=load("src/lib/member-board-timeline.ts");
function timelineLog(logId,action,created_at,overrides={}){
 return {id:logId,actor_id:id,post_id:null,comment_id:commentId,report_id:id,action,reason:action,created_at,...overrides};
}

test("receipt and successive moderation actions use one descending timestamp order without mutating responses",()=>{
 const receipt={id,created_at:"2026-10-20T20:00:00+09:00"};
 const review=timelineLog("review","report_reviewing","2026-10-20T21:09:01+09:00");
 const hide=timelineLog("hide","hide_comment","2026-10-20T21:09:50+09:00");
 const end=timelineLog("end","report_resolved","2026-10-20T21:10:00+09:00");
 const logs=Object.freeze([review,hide]);
 assert.deepEqual(Array.from(timeline.adminTimeline(logs,receipt),e=>e.kind==="action"?e.log.id:"receipt"),["hide","review","receipt"]);
 assert.deepEqual(Array.from(timeline.adminTimeline([review,end,hide],receipt),e=>e.kind==="action"?e.log.id:"receipt"),["end","hide","review","receipt"]);
 assert.deepEqual(logs,[review,hide]);
 // A target can have actions predating this report; do not force receipt last either.
 const older=timelineLog("old","hide_comment","2026-10-20T19:00:00+09:00");
 assert.equal(timeline.adminTimeline([older],receipt)[0].kind,"receipt");
});
test("microseconds and offsets precede deterministic ID ties, including receipt/log ties",()=>{
 const older=timelineLog("z","hide_comment","2026-10-20T12:09:00.123001Z");
 const newer=timelineLog("a","report_resolved","2026-10-20T21:09:00.123999+09:00");
 assert.deepEqual(Array.from(timeline.sortAdminLogs([older,newer]),l=>l.id),["a","z"]);
 const a=timelineLog("a","report_reviewing","2026-10-20T21:09:00.123456+09:00");
 const b=timelineLog("b","hide_comment","2026-10-20T12:09:00.123456Z");
 const receipt={id,created_at:a.created_at};
 for(const input of [[a,b],[b,a],[a,b]]){
  assert.deepEqual(Array.from(timeline.adminTimeline(input,receipt),e=>e.kind==="action"?e.log.id:"receipt"),["b","a","receipt"]);
 }
});
test("selecting another report and returning never retains or mutates its timeline",()=>{
 const a={id,created_at:"2026-10-20T20:00:00+09:00"};
 const b={id:postId,created_at:"2026-10-20T21:00:00+09:00"};
 const logsA=[timelineLog("early","hide_comment","2026-10-20T21:09:00+09:00"),timelineLog("late","report_resolved","2026-10-20T21:10:00+09:00")];
 const before=JSON.stringify(timeline.adminTimeline(logsA,a));
 assert.equal(timeline.adminTimeline([],b)[0].key,"0:receipt:"+postId);
 assert.equal(JSON.stringify(timeline.adminTimeline(logsA,a)),before);
 assert.equal(JSON.stringify(timeline.adminTimeline(JSON.parse(JSON.stringify(logsA)),a)),before);
});
test("admin filters bound state codes, force tab constraints and encode selection",()=>{
 assert.equal(model.adminBoardQuery({tab:"hidden",status:"public"}).status,"hidden");
 assert.equal(model.adminBoardQuery({tab:"notices",category:"free"}).category,"notice");
 const q=model.adminBoardQuery({tab:"reports",report_status:"rejected",target:"sql",outcome:"delete",page:"-1"});
 assert.equal(q.report_status,"all");assert.equal(q.target,"all");assert.equal(q.outcome,"all");assert.equal(q.page,1);
 const href=model.adminBoardHref(model.adminBoardQuery({tab:"reports",q:"a & b",target:"comment"}),{selected:id,page:2});
 assert.match(href,/q=a\+%26\+b/);assert.match(href,/target=comment/);assert.match(href,/selected=/);
});
test("report filters search real targets, preserve snapshots and prioritize unresolved reports",()=>{
 const rows=[{...report,id:"resolved",status:"resolved",created_at:"2026-10-21T00:00:00Z"},report,{...report,id:"older",status:"reviewing",created_at:"2026-10-19T00:00:00Z"}];
 const filter=values=>model.filterReports(rows,model.adminBoardQuery({tab:"reports",...values}),Date.parse("2026-10-21T00:00:00Z"));
 assert.deepEqual(Array.from(filter({}),r=>r.id),[id,"older","resolved"]);
 assert.equal(filter({report_status:"open"}).length,2);
 assert.equal(filter({target:"post"}).length,0);
 assert.equal(filter({category:"free"}).length,0);
 assert.equal(filter({scope:"author",q:"Member-comment"}).length,3);
 assert.equal(filter({scope:"title",q:"문법"}).length,3);
 assert.equal(filter({scope:"comments",q:"Original comment"}).length,3);
 assert.equal(filter({period:"day"}).length,2);
 assert.equal(report.original_content,"Original comment");
 const closed=model.filterReports(rows,model.adminBoardQuery({outcome:"no_action"}),Date.now(),new Set([id,"resolved"]));
 assert.deepEqual(Array.from(closed,r=>r.id),["resolved"]);
});
test("comment reports can only hide/restore the exact comment, never its parent",()=>{
 const options=model.reportOptions(report);
 assert.equal(options[0].action,"hide_comment");assert.equal(options[0].id,commentId);assert.equal(options[0].version,comment.updated_at);
 assert.equal(options.some(o=>o.action==="hide_post"),false);
 const restore=model.reportOptions({...report,comment:{...comment,status:"hidden"}});
 assert.equal(restore[0].action,"show_comment");
 const deleted=model.reportOptions({...report,comment:{...comment,status:"deleted"}});
 assert.equal(deleted.some(o=>o.value==="visibility"),false);
 const noAction=options.find(o=>o.value==="no_action");
 assert.equal(noAction.status,"resolved");assert.equal(noAction.action,"report_review");assert.equal(noAction.prefix,"[조치 없음] ");
 const postReport=model.reportOptions({...report,post_id:postId,comment_id:null,post,comment:null});
 assert.equal(postReport[0].action,"hide_post");assert.equal(postReport[0].id,postId);
});
function repository({access="admin",reports=[report],logs=[],errorTable="",counts=[2,1,0,1]}={}){
 const calls=[],selects=[],orders=[],limits=[];
 let countIndex=0,clients=0;
 const client={from(table){
  calls.push(table);let rows=[...(table==="board_reports"?reports:logs)],range=[0,Infinity],one=false,head=false;
  const builder={select(fields,options){selects.push(fields);head=options?.head;return builder;},order(column,options){orders.push({table,column,ascending:options?.ascending??true});return builder;},eq(key,value){rows=rows.filter(r=>r[key]===value);return builder;},neq(){return builder;},in(key,values){rows=rows.filter(r=>values.includes(r[key]));return builder;},not(key){rows=rows.filter(r=>r[key]!==null);return builder;},or(expression){const conditions=expression.split(",").map(c=>c.split(".eq."));rows=rows.filter(r=>conditions.some(([key,value])=>r[key]===value));return builder;},range(a,b){range=[a,b];return builder;},limit(n){limits.push(n);range=[0,n-1];return builder;},maybeSingle(){one=true;return builder;},then(resolve,reject){const data=rows.slice(range[0],range[1]+1);return Promise.resolve(table===errorTable?{data:null,error:{code:"42501"},count:null}:{data:one?data[0]??null:data,error:null,count:head?counts[countIndex++%counts.length]:null}).then(resolve,reject);}};
  return builder;
 }};
 const api=load("src/lib/member-board-admin.ts",{"./auth":{getAdminAccess:async()=>({status:access})},"./supabase/server":{createClient:async()=>{clients++;return client;}}});
 return {api,calls,selects,orders,limits,clients:()=>clients};
}
test("anonymous, members and failed admin checks never query private report data",async()=>{
 for(const access of ["anonymous","denied","error"]){
  const repo=repository({access});
  assert.equal(await repo.api.adminReports(model.adminBoardQuery({})),null);
  assert.equal(await repo.api.adminBoardStats(),null);
  assert.equal(await repo.api.hiddenPostLogs([postId]),null);
  assert.equal(repo.clients(),0);assert.equal(repo.calls.length,0);
 }
});
test("statistics expose errors as unavailable, never invented zero counts",async()=>{
 const repo=repository();assert.deepEqual(Array.from(await repo.api.adminBoardStats()),[2,1,0,1]);
 assert.equal(await repository({errorTable:"board_reports"}).api.adminBoardStats(),null);
 assert.equal(await repository({counts:[2,null,0,1]}).api.adminBoardStats(),null);
});
test("selected log queries are bounded and server responses normalize created_at/ID descending",async()=>{
 const a=timelineLog("a","report_reviewing","2026-10-20T12:09:00.100001Z");
 const b=timelineLog("b","hide_comment","2026-10-20T12:09:00.100002Z");
 const c=timelineLog("c","report_resolved",b.created_at);
 const repo=repository({logs:[a,b,c]});
 const data=await repo.api.adminReports(model.adminBoardQuery({selected:id}));
 assert.deepEqual(Array.from(data.logs,l=>l.id),["c","b","a"]);
 assert.deepEqual(repo.limits,[200]);
 const orders=repo.orders.filter(o=>o.table==="board_moderation_logs");
 assert.ok(orders.length>0);assert.ok(orders.every(o=>o.ascending===false));
 assert.deepEqual(orders.slice(-2).map(o=>o.column),["created_at","id"]);
});

test("one action revalidation updates status, counts and timeline; selection changes and reloads use the same ordering",async()=>{
 const React=require("react"),{renderToPipeableStream}=require("react-dom/server");
 const selectedReport={...report,created_at:"2026-10-20T20:00:00+09:00"};
 const anotherId="dddddddd-dddd-4ddd-8ddd-dddddddddddd";
 const another={...report,id:anotherId,comment_id:anotherId,comment:{...comment,id:anotherId},created_at:"2026-10-20T20:30:00+09:00"};
 const logs=[timelineLog("review","report_reviewing","2026-10-20T21:09:01+09:00"),timelineLog("hide","hide_comment","2026-10-20T21:09:50+09:00",{report_id:null})];
 const counts=[2,2,0,0],repo=repository({reports:[selectedReport,another],logs,counts});
 const invalidations=[];let committed=false,mutationCount=0,clientRefreshes=0,submitAction;
 const actions=load("src/app/actions/community-board.ts",{
  "next/cache":{updateTag:()=>{},revalidatePath:(path,type)=>{assert.ok(committed);invalidations.push({path,type});}},
  "next/navigation":{redirect:()=>assert.fail("keep the selected report and filters")},
  "@/lib/auth":{getAdminAccess:async()=>({status:"admin"})},
  "@/lib/supabase/server":{createClient:async()=>({auth:{getUser:async()=>({data:{user:{id}},error:null})},rpc:async(name,args)=>{
   mutationCount++;assert.equal(name,"member_board_mutate");assert.equal(args.p_action,"report_review");assert.equal(args.p_id,id);
   selectedReport.status="resolved";selectedReport.updated_at="2026-10-20T21:10:00+09:00";
   logs.push(timelineLog("end","report_resolved",selectedReport.updated_at));counts[1]=1;committed=true;
   return {data:postId,error:null};
  }})},
 });
 const {AdminBoardWorkspace}=load("src/components/community/admin-board.tsx",{
  react:{...React,useActionState:(action,initial)=>{submitAction=action;return [initial,()=>{},false];}},
  "@/components/admin/admin-shell":{AdminShell:({children})=>React.createElement("main",null,children)},
  "next/navigation":{useRouter:()=>({push:()=>{},refresh:()=>clientRefreshes++})},
  "@/lib/community-board":{},
  "@/lib/member-board-admin":{adminBoardStats:repo.api.adminBoardStats,adminReports:repo.api.adminReports},
  "@/app/actions/community-board":actions,"./board-form":{BoardForm:()=>null},
 });
 function render(query){return new Promise((resolve,reject)=>{
  let html="";const output=new PassThrough();output.on("data",chunk=>html+=chunk);output.on("end",()=>resolve(html));
  const stream=renderToPipeableStream(React.createElement(AdminBoardWorkspace,{email:"Test",query}),{onAllReady(){stream.pipe(output);},onError:reject});
 });}
 function times(html){const list=/<ol class="member-log">([\s\S]*?)<\/ol>/.exec(html)?.[1]??"";return Array.from(list.matchAll(/datetime="([^"]+)"/gi),m=>m[1]);}
 const query=model.adminBoardQuery({tab:"reports",report_status:"open",selected:id});
 const before=await render(query);
 assert.deepEqual(times(before),[logs[1].created_at,logs[0].created_at,selectedReport.created_at]);
 const form=new FormData();for(const[k,v]of Object.entries({action:"report_review",id,version:report.updated_at,admin:"true",status:"resolved",reason:"Reviewed"}))form.set(k,v);
 assert.equal((await submitAction({message:""},form)).success,true);
 assert.equal(mutationCount,1);assert.equal(clientRefreshes,0);
 assert.equal(invalidations.filter(r=>r.path==="/admin/member-board").length,1);
 assert.ok(invalidations.some(r=>r.path==="/admin/member-board"&&r.type===undefined));
 assert.ok(invalidations.some(r=>r.path==="/admin/member-board/"+postId&&r.type===undefined));
 const after=await render(query);
 assert.match(after,/신고 내역 <span>1<!-- -->건/); // completed report leaves the open list
 assert.match(after,/신고 대기<\/span><strong>1<\/strong>/);
 assert.match(after,/member-badge--resolved/);assert.match(after,/신고 상세/);
 const expected=[logs[2].created_at,logs[1].created_at,logs[0].created_at,selectedReport.created_at];
 assert.deepEqual(times(after),expected);
 assert.deepEqual(times(await render({...query,selected:anotherId})),[another.created_at]);
 assert.deepEqual(times(await render(query)),expected);
 // A fresh request, with newly allocated inputs, has the same result as action revalidation.
 assert.deepEqual(times(await render(JSON.parse(JSON.stringify(query)))),expected);
 assert.equal(clientRefreshes,0);
});
test("report reader scans past DB row limits, paginates and keeps a selected report outside active filters",async()=>{
 const rows=Array.from({length:501},(_,i)=>({...report,id:String(i),created_at:new Date(Date.UTC(2026,9,20,0,0,i)).toISOString()}));
 const repo=repository({reports:[...rows,{...report,status:"resolved"}]});
 const data=await repo.api.adminReports(model.adminBoardQuery({tab:"reports",report_status:"pending",page:"2",selected:id}));
 assert.equal(data.total,501);assert.equal(data.rows.length,20);assert.equal(data.page,2);assert.equal(data.selected.id,id);
 assert.ok(repo.calls.filter(t=>t==="board_reports").length>=3);
 assert.equal(repo.selects.some(s=>s.includes("reporter_id")),false);
 assert.equal(await repository({errorTable:"board_reports"}).api.adminReports(model.adminBoardQuery({})),null);
});
test("latest completion reason distinguishes no action without inventing a DB status",async()=>{
 const log=(report_id,reason)=>({id:report_id,report_id,reason,action:"report_resolved",created_at:"2026-10-20T00:00:00Z"});
 const repo=repository({reports:[{...report,status:"resolved"}],logs:[log(id,"[조치 없음] Reviewed"),log(id,"older completion")]});
 const data=await repo.api.adminReports(model.adminBoardQuery({outcome:"no_action"}));
 assert.equal(data.total,1);assert.ok(data.noActionIds.includes(id));assert.equal(data.rows[0].status,"resolved");
});
test("shared mutation requires admin access for every hide/restore/review and preserves exact target/version",async()=>{
 for(const action of ["hide_post","show_post","hide_comment","show_comment","report_review"]){
  for(const admin of [false,true]){
   const calls=[];
   const api=load("src/app/actions/community-board.ts",{
    "next/cache":{updateTag:()=>{},revalidatePath:()=>{}},"next/navigation":{redirect:()=>assert.fail("moderation must retain the current URL")},
    "@/lib/auth":{getAdminAccess:async()=>({status:admin?"admin":"denied"})},
    "@/lib/supabase/server":{createClient:async()=>({auth:{getUser:async()=>({data:{user:{id}},error:null})},rpc:async(name,args)=>{calls.push({name,args});return {data:postId,error:null};}})},
   });
   const form=new FormData();for(const[k,v] of Object.entries({action,id:action.includes("comment")?commentId:postId,version:"2026-10-20T00:00:00Z",reason:"Reviewed reason",status:"resolved",admin:"true"}))form.set(k,v);
   const result=await api.mutateCommunity({},form);
   assert.equal(calls.length,admin?1:0);
   if(admin){assert.equal(result.success,true);assert.equal(calls[0].args.p_action,action);assert.equal(calls[0].args.p_id,form.get("id"));assert.equal(calls[0].args.p_version,form.get("version"));assert.equal(calls[0].args.p_input.reason,"Reviewed reason");}
  }
 }
});
test("no-action closures still require a meaningful reason and respect the existing length limit",()=>{
 const shared=load("src/lib/community-board-model.ts");
 const form=new FormData();form.set("status","resolved");form.set("reason","[조치 없음]   ");
 assert.throws(()=>shared.communityInput("report_review",form,true));
 form.set("reason","[조치 없음] Reviewed, no rule violation");
 assert.equal(shared.communityInput("report_review",form,true).status,"resolved");
 form.set("reason","[조치 없음] "+"x".repeat(500));assert.throws(()=>shared.communityInput("report_review",form,true));
});

test("administrator detail exposes moderation, but only notices get edit/delete controls",()=>{
 const React=require("react"),{renderToStaticMarkup}=require("react-dom/server");
 const {AdminPostDetail}=load("src/components/community/admin-board.tsx",{
  "@/lib/community-board":{},"@/lib/member-board-admin":{},"@/components/admin/admin-shell":{},
  "./admin-moderation-form":{AdminModerationForm:({options})=>React.createElement("div",{"data-actions":options.map(o=>o.action).join(",")})},
  "./board-form":{BoardForm:({action})=>React.createElement("form",{"data-action":action})},"./board-list":{date:()=>"2026. 10. 20."},
 });
 const data={post:{...post,created_at:"2026-10-20T00:00:00Z",can_edit:true,is_pinned:false,view_count:1},comments:[],comment_total:0,comment_page:1,reports:[],logs:[]};
 const render=p=>renderToStaticMarkup(React.createElement(AdminPostDetail,{data:{...data,post:p},query:model.adminBoardQuery({})}));
 const member=render(data.post);assert.doesNotMatch(member,/공지사항 수정|data-action="post_delete"/);assert.match(member,/hide_post,pin/);
 const notice=render({...data.post,category:"notice"});assert.match(notice,/공지사항 수정/);assert.match(notice,/data-action="post_delete"/);
 assert.doesNotMatch(render({...data.post,status:"deleted"}),/data-actions="hide_post/);
});

test("report workspace streams a selected panel, preserves filters, and renders honest empty/error states",async()=>{
 const React=require("react"),{renderToPipeableStream}=require("react-dom/server");
 const shell=load("src/components/admin/admin-shell.tsx",{
  "next/navigation":{useRouter:()=>({push:()=>{}}),usePathname:()=>"/admin/board",useSearchParams:()=>new URLSearchParams()},
  "../brand-logo":{BrandLogo:()=>React.createElement("strong",null,"MALMOIM")},
  "../logout-form":{LogoutForm:()=>React.createElement("button",null,"로그아웃")},
 });
 async function render({empty=false,error=false,stats=[2,1,0,1],selected=true}={}){
  const {AdminBoardWorkspace}=load("src/components/community/admin-board.tsx",{
   "@/components/admin/admin-shell":shell,
   "next/navigation":{useRouter:()=>({push:()=>{}}),notFound:()=>{throw new Error("Not found");}},
   "@/lib/community-board":{},
   "@/lib/member-board-admin":{adminBoardStats:async()=>stats,adminReports:async()=>error?null:{rows:empty?[]:[report],total:empty?0:1,page:1,selected:selected&&!empty?report:null,logs:[],noActionIds:[]}},
   "./board-form":{BoardForm:()=>null},"@/app/actions/community-board":{mutateCommunity:async()=>({message:"Test only"})},
  });
  return new Promise((resolve,reject)=>{
   const output=new PassThrough();let html="";output.on("data",c=>html+=c);output.on("end",()=>resolve(html));
   const stream=renderToPipeableStream(React.createElement(AdminBoardWorkspace,{email:"QA — isolated fixture",query:model.adminBoardQuery({tab:"reports",q:"Original",target:"comment",selected:selected?id:""})}),{onAllReady(){stream.pipe(output);},onError:reject});
  });
 }
 const html=await render();assert.match(html,/신고 상세/);assert.match(html,/Original comment/);assert.match(html,/공개 식별 정보 미제공/);assert.match(html,/is-selected/);
 assert.match(html,/hide_comment/);assert.doesNotMatch(html,/value="hide_post"/);
 assert.match(html,/name="reason"/);assert.match(html,/처리 사유/);
 assert.match(await render({empty:true}),/조건에 맞는 신고가 없습니다/);
 const unavailable=await render({error:true,stats:null});assert.match(unavailable,/조회 불가/);assert.match(unavailable,/role="alert"/);
 if(process.env.MEMBER_BOARD_VISUAL_DIR){
  const folder=process.env.MEMBER_BOARD_VISUAL_DIR;mkdirSync(folder,{recursive:true});
  const css=["src/app/globals.css","src/components/admin/admin.css","src/components/community/admin-board.css"].map(p=>readFileSync(new URL("../"+p,import.meta.url),"utf8")).join("\n");
  writeFileSync(folder+"/index.html",`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>격리된 관리자 UI 검증</title><style>body{margin:0;font-family:Arial,sans-serif}*{box-sizing:border-box}a{color:inherit}button,input,select,textarea{font:inherit}${css}</style><div style="padding:8px;background:#fff3cd;text-align:center;font-size:12px">격리된 자동 테스트 데이터 · 운영 서비스와 연결되지 않은 레이아웃 검증 화면</div>${html}</html>`);
 }
});
