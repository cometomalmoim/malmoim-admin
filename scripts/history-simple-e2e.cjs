/* eslint-disable @typescript-eslint/no-require-imports -- Personal local browser E2E only. */
// Uses only an operator-logged-in isolated Chrome context. Never reads passwords,
// exports cookies, traces HTTP headers, or uses privileged Supabase credentials.
const assert=require('node:assert/strict'),sharp=require('sharp');
const ORIGIN='http://127.0.0.1:3022';
async function run({chromium,endpoint='http://127.0.0.1:9322'}){
 if(endpoint!=='http://127.0.0.1:9322')throw Error('LOCAL_TEST_BROWSER_REQUIRED');
 const browser=await chromium.connectOverCDP(endpoint),context=browser.contexts()[0];
 let stage='administrator',albumId,publicContext;const passed=[];
 const page=await context.newPage();
 const check=async(request,method,path,body)=>{const r=await request.fetch(ORIGIN+path,{method,headers:body?{origin:ORIGIN,'content-type':'application/json'}:undefined,...(body?{data:body}:{})});return r;};
 async function catalog(){const r=await page.request.get(ORIGIN+'/api/admin/history-photos');assert.equal(r.status(),200);const d=await r.json();assert.equal(d.enabled,true);return d.albums;}
 async function poll(predicate,timeout=45000){const until=Date.now()+timeout;do{const result=await predicate();if(result)return result;await new Promise(resolve=>setTimeout(resolve,500));}while(Date.now()<until);throw Error('STEP_TIMEOUT');}
 try{
  await catalog();passed.push('admin_getUser_and_allowlist');
  await page.goto(ORIGIN+'/admin/history');await page.getByRole('heading',{name:'활동 사진 관리',exact:true}).waitFor();
  const beforeAbout=await page.request.get(ORIGIN+'/about');assert.equal(beforeAbout.status(),200);passed.push('about_preserved');
  stage='register_upload';const title='개인 E2E '+Date.now(),registration=page.getByRole('group',{name:'활동·사진 등록',exact:true});
  await registration.getByLabel('활동명',{exact:true}).fill(title);await registration.getByLabel('활동일',{exact:true}).fill(new Date().toISOString().slice(0,10));await registration.getByLabel('설명',{exact:true}).fill('개인 테스트 자동 검증용 이미지 · 검증 후 삭제');
  const png=await sharp({create:{width:640,height:400,channels:3,background:'#3c7c9b'}}).png().toBuffer();await registration.locator('input[type=file]').setInputFiles({name:'personal-e2e.png',mimeType:'image/png',buffer:png});await registration.getByRole('button',{name:'비공개로 등록',exact:true}).click();
  const album=await poll(async()=>{const a=(await catalog()).find(a=>a.title===title);if(a)albumId=a.id;return a?.history_photo_items?.length===1&&a.history_photo_items[0].ready?a:null;});
  const photo=album.history_photo_items[0],path='/api/history-photo-file?id='+photo.id;
  assert.equal(album.published,false);assert.equal(photo.approved,false);assert.equal((await page.request.get(ORIGIN+path+'&admin=1')).status(),200);passed.push('real_storage_upload_and_server_confirmation');
  publicContext=await browser.newContext();const publicPage=await publicContext.newPage(),anonymous=publicContext.request;
  const listed=async()=>{const r=await anonymous.get(ORIGIN+'/api/history-photos');assert.equal(r.status(),200);return (await r.json()).activities;};
  assert(!(await listed()).some(a=>a.id===album.id));assert.equal((await anonymous.get(ORIGIN+path)).status(),404);assert.equal((await check(anonymous,'POST','/api/admin/history-photos',{op:'publish',id:album.id,published:true})).status(),401);passed.push('anonymous_private_read_and_write_denied');
  stage='publish';const card=page.locator('article').filter({has:page.getByRole('heading',{name:title,exact:true})});await card.getByRole('button',{name:'완료 사진 공개 승인',exact:true}).click();await poll(async()=>(await listed()).some(a=>a.id===album.id));const visible=await anonymous.get(ORIGIN+path);assert.equal(visible.status(),200);assert(visible.headers()['content-type'].includes('image/webp'));assert(visible.headers()['cache-control'].includes('no-store'));
  await publicPage.goto(ORIGIN+'/history');await publicPage.getByRole('tab',{name:'특별 활동',exact:true}).click();const image=publicPage.locator(`img[src*="${photo.id}"]`).first();await image.waitFor({state:'visible'});await poll(()=>image.evaluate(img=>img.complete&&img.naturalWidth>0));await publicPage.getByRole('button',{name:title+' 사진 상세 보기',exact:true}).click();await publicPage.getByRole('dialog').waitFor();await publicPage.keyboard.press('Escape');passed.push('anonymous_history_image_and_slide_visible');
  stage='unpublish';await card.getByRole('button',{name:'비공개 전환',exact:true}).click();await poll(async()=>!(await listed()).some(a=>a.id===album.id));assert.equal((await anonymous.get(ORIGIN+path)).status(),404);await publicPage.reload();await publicPage.getByRole('tab',{name:'특별 활동',exact:true}).click();assert.equal(await publicPage.locator(`img[src*="${photo.id}"]`).count(),0);passed.push('unpublish_hides_new_requests');
  stage='delete';await page.evaluate(()=>{window.confirm=message=>message==='활동과 사진을 모두 삭제할까요?';});await card.getByRole('button',{name:'활동 전체 삭제',exact:true}).click();await poll(async()=>!(await catalog()).some(a=>a.id===album.id));assert.equal((await page.request.get(ORIGIN+path+'&admin=1')).status(),404);passed.push('delete_metadata_and_storage_acknowledgement_verified');albumId=undefined;
  return {status:'passed',checks:passed};
 }catch{
  // Only the newly created fixture is eligible for cleanup; never existing albums.
  let cleanup='not_needed';if(albumId){try{const r=await check(page.request,'POST','/api/admin/history-photos',{op:'delete_album',id:albumId});cleanup=r.ok()?'completed':'needs_review';}catch{cleanup='needs_review';}}
  return {status:'failed',stage,checks:passed,cleanup};
 }finally{await publicContext?.close();/* Logged-in operator window remains open. */}
}
if(require.main===module){const packagePath=process.env.PHOTO_E2E_PLAYWRIGHT_PATH??'playwright';run({chromium:require(packagePath).chromium}).then(result=>{console.log(JSON.stringify(result));process.exit(result.status==='passed'?0:1);}).catch(()=>{console.error('PERSONAL_BROWSER_E2E_UNAVAILABLE');process.exitCode=1;});}
module.exports={run};
