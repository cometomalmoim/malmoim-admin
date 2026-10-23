// Explicit local60422 integration only. New fixtures, real five-minute expiry, no clock edits.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),https=require('node:https'),Module=require('node:module'),{execFileSync,fork}=require('node:child_process');
const repo=path.resolve(__dirname,'../../../..'),root='/private/tmp/malmoim-photo-package-KCloOQ',setup=require('../install-local.cjs'),{t,sql,pin}=setup.connect(root);
const uuid=()=>crypto.randomUUID();
async function boot(file){
 pin();if(t.projectId!=='malmoim-photo-package-e118b7ab'||t.dbPort!==60422)throw Error('target');
 const ctx=JSON.parse(fs.readFileSync(file));const bundle=JSON.parse(execFileSync(process.execPath,[repo+'/services/history-photo-broker/build.cjs'],{encoding:'utf8'})).bundle;
 const modules=Object.fromEntries(['broker-oidc','service-handler','verified-finalization','server-receipts','receipt-generations','limited-storage'].map(k=>[k,require(bundle+'/'+k+'.js')]));
 let text=fs.readFileSync(repo+'/services/history-photo-broker/local-lab-adapter.cjs','utf8').replaceAll('/private/tmp/malmoim-photo-integration-025aae9c',root).replaceAll('malmoim-photo-integration-025aae9c',t.projectId).replaceAll('58422','60422').replaceAll('58421','60421');
 text=text.replace("const engine=modules['verified-finalization'].createVerifiedFinalization(",'const finalizationPorts=').replace("process.exit(86);}});","process.exit(86);}};const engine=modules['verified-finalization'].createVerifiedFinalization(finalizationPorts);").replace('return {authenticate,administrator:admin,storageOrigin:api','return {testFinalization:finalizationPorts,authenticate,administrator:admin,storageOrigin:api');
 const m=new Module(repo+'/services/history-photo-broker/generation-test-adapter.cjs',module);m.filename=repo+'/services/history-photo-broker/generation-test-adapter.cjs';m.paths=Module._nodeModulePaths(path.dirname(m.filename));m._compile(text,m.filename);
 const ports=await m.exports.createPorts({modules,configPath:ctx.config});
 const secret=fs.readFileSync(root+'/verified-finalization/photo_finish_attestor.private','utf8').trim(),connectionString='postgresql://photo_finish_attestor:'+encodeURIComponent(secret)+'@127.0.0.1:60422/postgres';
 const generation=require(repo+'/services/history-photo-broker/generation-source.cjs').createPostgresGenerationSource({connectionString,localTest60422:true,reviewed:true});
 const receipts=require(repo+'/services/history-photo-broker/receipt-source.cjs').createPostgresReceiptSource({connectionString,localReadOnly:true});
 return {ctx,ports,modules,generation,receipts,close:async()=>{await generation.close();await receipts.close();}};
}
exports.boot=boot;
if(require.main===module){
if(process.argv[2]==='--issue-crash'){
 (async()=>{const b=await boot(process.argv[3]),r=await b.modules['receipt-generations'].createReceiptGenerationRecovery({finalization:b.ports.testFinalization,...b.generation}).revalidate(b.ctx.input,b.ctx.auth);if(r.status!=='issued')throw Error('issuance blocked');process.send?.({issued:true});process.exit(86);})().catch(()=>process.exit(1));
}else{
 let jwks;const checks=[];const ok=(name,b)=>{if(!b)throw Error('check '+name);checks.push(name);};
 (async()=>{
  pin();sql(fs.readFileSync(__dirname+'/008_verify.read-only.sql','utf8'));
  const snapshot=()=>JSON.parse(sql("BEGIN READ ONLY;SELECT jsonb_build_object('jobs',(SELECT coalesce(jsonb_object_agg(id,to_jsonb(j)),'{}') FROM photo_finish_v2.jobs j),'receipts',(SELECT coalesce(jsonb_object_agg(id,to_jsonb(r)),'{}') FROM photo_finish_v2.receipts r),'generations',(SELECT coalesce(jsonb_object_agg(id,to_jsonb(g)),'{}') FROM photo_finish_v2.receipt_generations g),'objects',(SELECT coalesce(jsonb_object_agg(id,to_jsonb(o)),'{}') FROM storage.objects o),'activities',(SELECT coalesce(jsonb_object_agg(id,to_jsonb(a)),'{}') FROM photo_service_v4.activities a),'requests',(SELECT coalesce(jsonb_object_agg(id,to_jsonb(r)),'{}') FROM photo_service_v4.requests r));ROLLBACK;"));
  const before=snapshot(),run=fs.mkdtempSync(root+'/generation-test-');fs.chmodSync(run,0o700);
  const previous=root+'/broker-service-3rE997';fs.copyFileSync(previous+'/tls.crt',run+'/tls.crt');fs.copyFileSync(previous+'/tls.key',run+'/tls.key');fs.chmodSync(run+'/tls.key',0o600);
  const pair=crypto.generateKeyPairSync('rsa',{modulusLength:2048}),key={...pair.publicKey.export({format:'jwk'}),kid:'generation-test',alg:'RS256',use:'sig'};
  jwks=https.createServer({key:fs.readFileSync(run+'/tls.key'),cert:fs.readFileSync(run+'/tls.crt')},(q,r)=>{r.setHeader('content-type','application/json');r.end(JSON.stringify({keys:[key]}));});await new Promise(r=>jwks.listen(0,'127.0.0.1',r));
  const config=JSON.parse(fs.readFileSync(previous+'/config.private.json'));config.profile='local-60422';config.testCrashAfterFinalReadback=false;config.caPath=run+'/tls.crt';config.jwksUrl='https://127.0.0.1:'+jwks.address().port+'/jwks';fs.writeFileSync(run+'/config.private.json',JSON.stringify(config),{mode:0o600});
  function bearer(){const now=Math.floor(Date.now()/1000),o=config.oidc,h=Buffer.from(JSON.stringify({alg:'RS256',typ:'JWT',kid:key.kid})).toString('base64url'),p=Buffer.from(JSON.stringify({iss:o.issuer,aud:o.audience,project_id:o.projectId,owner_id:o.ownerId,sub:o.subject,environment:o.environment,iat:now,exp:now+300})).toString('base64url');return 'Bearer '+h+'.'+p+'.'+crypto.sign('RSA-SHA256',Buffer.from(h+'.'+p),pair.privateKey).toString('base64url');}
  const status=JSON.parse(execFileSync(repo+'/node_modules/.bin/supabase',['status','--workdir',root,'-o','json'],{stdio:['ignore','pipe','pipe']}));if(status.API_URL!==t.apiUrl||new URL(status.DB_URL).port!=='60422')throw Error('API target');
  const {createClient}=require(repo+'/node_modules/@supabase/supabase-js'),client=createClient(t.apiUrl,status.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}}),login=await client.auth.signInWithPassword(JSON.parse(fs.readFileSync(root+'/login-private.json')));if(login.error)throw Error('admin login');const auth={authorization:bearer(),userSession:login.data.session.access_token};
  const contextFile=run+'/context.private.json';let ctx={config:run+'/config.private.json',auth};fs.writeFileSync(contextFile,JSON.stringify(ctx),{mode:0o600});let b=await boot(contextFile);
  ok('OIDC and independent real admin verified',(await b.ports.authenticate(auth.authorization)).status==='verified'&&!!await b.ports.administrator(auth.userSession));
  const sharp=require(repo+'/node_modules/sharp'),fixtures=[];
  for(const color of ['#4567ab','#ab6745','#45ab67']){
   let a=await b.ports.command('create',{requestId:uuid(),title:'Receipt generation test',date:'2026-10-22',description:'Isolated expired receipt test'},auth.userSession);
   a=await b.ports.command('visibility',{activityId:a.activityId,requestId:uuid(),revision:a.revision,published:false},auth.userSession);
   const bytes=await sharp({create:{width:24,height:24,channels:3,background:color}}).png().toBuffer();
   const reserved=await b.ports.command('reserve',{activityId:a.activityId,requestId:uuid(),revision:a.revision,size:bytes.length,mime:'image/png'},auth.userSession),actor=await b.ports.administrator(auth.userSession),job=await b.ports.job(reserved.jobId,actor.actorId),permit=await b.ports.permit(job);
   const sent=await fetch(permit,{method:'PUT',headers:{'content-type':'image/png','x-upsert':'false'},body:bytes});ok('new temporary object uploaded',sent.ok);
   const stopped=await b.modules['verified-finalization'].createVerifiedFinalization({...b.ports.testFinalization,checkpoint:async stage=>{if(stage==='attested')throw Error('new fixture interrupted');}}).run({jobId:job.id,requestId:job.requestId},auth);ok('new job pending after durable initial receipt',stopped.status==='uncertain');
   const state=await b.generation.state(job.id,job.requestId,actor.actorId);ok('initial generation zero pending',state.generation===0&&state.job.state==='pending');fixtures.push({job,state,actor:actor.actorId});
  }
  fs.writeFileSync(run+'/fixtures.private.json',JSON.stringify(fixtures),{mode:0o600});
  console.log(JSON.stringify({stage:'waiting_for_real_receipt_expiry',newPhotos:3,clockOrReceiptEdits:false}));
  const until=Math.max(...fixtures.map(f=>Date.parse(f.state.issuedAt)))+300500;
  while(Date.now()<until){await new Promise(r=>setTimeout(r,Math.min(30000,until-Date.now())));console.log(JSON.stringify({stage:'expiry_wait',remainingSeconds:Math.max(0,Math.ceil((until-Date.now())/1000))}));}
  auth.authorization=bearer();await b.close();b=await boot(contextFile);const f=fixtures[0],input={jobId:f.job.id,requestId:f.job.requestId,revision:f.job.revision,generation:0,previousReceiptId:f.state.receiptId,recoveryRequestId:uuid()};
  const gp={finalization:b.ports.testFinalization,...b.generation},engine=b.modules['receipt-generations'].createReceiptGenerationRecovery(gp);
  // Without real re-download no issuance; no fallback to claimed browser evidence.
  const noFile=await b.modules['receipt-generations'].createReceiptGenerationRecovery({...gp,finalization:{...gp.finalization,storage:{...gp.finalization.storage,readFinal:async()=>null}}}).revalidate(input,auth);ok('missing actual immutable file blocks issuance',noFile.status==='manual_required');
  const badSession=await engine.revalidate(input,{...auth,userSession:'invalid'});ok('invalid administrator denied',badSession.status==='blocked');
  const invalidOidc=await engine.revalidate(input,{...auth,authorization:'Bearer a.b.c'});ok('forged workload denied',invalidOidc.status==='blocked');
  const race=await Promise.all([engine.revalidate(input,auth),engine.revalidate({...input,recoveryRequestId:uuid()},auth)]);ok('concurrent generation issuance one winner',race.filter(r=>r.status==='issued').length===1);
  const newState=await b.generation.state(f.job.id,f.job.requestId,f.actor);ok('new generation links original and is pending',newState.generation===1&&newState.receiptId!==f.state.receiptId&&newState.job.state==='pending');
  ok('old generation replay rejected',(await engine.revalidate(input,auth)).status!=='issued');
  ok('old expired receipt lookup rejected',!await b.receipts.read({jobId:f.job.id,requestId:f.job.requestId,revision:0,receiptId:f.state.receiptId,seal:f.state.seal},f.actor));
  const finish=b.modules['receipt-generations'].createGenerationFinalizer(gp,b.receipts);
  const commits=await Promise.all([finish.run({jobId:f.job.id,requestId:f.job.requestId},auth),finish.run({jobId:f.job.id,requestId:f.job.requestId},auth)]);ok('one successful generation commit',commits.filter(r=>r.status==='recorded').length===1);
  ok('completed generation does not reissue',(await engine.revalidate({...input,generation:1,previousReceiptId:newState.receiptId,recoveryRequestId:uuid()},auth)).status==='already_complete');
  // Second new fixture: real child process dies after issuance; no DB/file rollback or renewal.
  const second=fixtures[1];ctx={...ctx,auth,input:{jobId:second.job.id,requestId:second.job.requestId,revision:0,generation:0,previousReceiptId:second.state.receiptId,recoveryRequestId:uuid()}};fs.writeFileSync(contextFile,JSON.stringify(ctx),{mode:0o600});
  const child=fork(__filename,['--issue-crash',contextFile],{stdio:['ignore','ignore','ignore','ipc']});let issued=false;child.on('message',m=>{issued=m.issued===true;});const code=await new Promise(r=>child.once('exit',r));ok('actual process exits after durable generation issuance',issued&&code===86);
  await b.close();b=await boot(contextFile);const restored=await b.generation.state(second.job.id,second.job.requestId,second.actor);ok('fresh process source reads durable generation',restored.generation===1&&!restored.consumed);
  const resumed=b.modules['receipt-generations'].createGenerationFinalizer({finalization:b.ports.testFinalization,...b.generation},b.receipts);
  ok('restart resumes existing generation without reissuing',(await resumed.run({jobId:second.job.id,requestId:second.job.requestId},auth)).status==='recorded');
  ok('lost reply recovery does not commit twice',(await resumed.run({jobId:second.job.id,requestId:second.job.requestId},auth)).status==='already_complete');
  const third=fixtures[2];let a=await b.ports.command('inspect',{activityId:third.job.activityId},auth.userSession);await b.ports.command('visibility',{activityId:a.activityId,requestId:uuid(),revision:a.revision,published:false},auth.userSession);
  const stale=await b.modules['receipt-generations'].createReceiptGenerationRecovery({finalization:b.ports.testFinalization,...b.generation,state:async()=>third.state}).revalidate({jobId:third.job.id,requestId:third.job.requestId,revision:0,generation:0,previousReceiptId:third.state.receiptId,recoveryRequestId:uuid()},auth);ok('private transition during revalidation rejects stale generation',stale.status!=='issued');
  const after=snapshot();for(const kind of Object.keys(before))ok('preserved prior '+kind,Object.entries(before[kind]).every(([id,v])=>JSON.stringify(v)===JSON.stringify(after[kind][id])));
  for(const fixture of fixtures)ok('original expired receipt unchanged',JSON.stringify(after.receipts[fixture.state.receiptId])===JSON.stringify({...after.receipts[fixture.state.receiptId],consumed:false})&&after.receipts[fixture.state.receiptId].issued_at===fixture.state.issuedAt);
  await b.close();sql(fs.readFileSync(__dirname+'/008_verify.read-only.sql','utf8'));jwks.close();
  fs.writeFileSync(run+'/result.json',JSON.stringify({checks:checks.length,passed:checks,realExpiry:true,newPhotos:3,production:false},null,2));console.log(JSON.stringify({passed:checks.length,realExpiry:true,newPhotos:3,result:run+'/result.json'}));
 })().catch(e=>{jwks?.close();console.error(e.message?.startsWith('check ')?e.message:'generation_local_validation_failed');process.exitCode=1;});
}

}
