/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Node service. */
// Explicit generation operations only. No automatic issuance on lookup/finalize.
const {Pool}=require('pg');
exports.createPostgresGenerationSource=function({connectionString,localTest60422=false,reviewed=false,ca,PoolClass=Pool}){
 if(!reviewed)throw Error('Generation source disabled');let u,user,password;
 try{u=new URL(connectionString);user=decodeURIComponent(u.username);password=decodeURIComponent(u.password);}catch{throw Error('Generation source disabled');}
 if(!['postgres:','postgresql:'].includes(u.protocol)||!password||u.pathname!=='/postgres'||u.search||u.hash||(localTest60422?u.hostname!=='127.0.0.1'||u.port!=='60422'||user!=='photo_finish_attestor':!/[.]pooler[.]supabase[.]com$/.test(u.hostname)||u.port!=='6543'||!/^photo_finish_attestor[.][a-z0-9]{20}$/.test(user)))throw Error('Generation target rejected');
 const pool=new PoolClass({host:u.hostname,port:Number(u.port),user,password,database:'postgres',ssl:localTest60422?false:{rejectUnauthorized:true,...(ca?{ca}:{})},max:2,maxUses:1,connectionTimeoutMillis:2000,idleTimeoutMillis:10000,statement_timeout:5000,query_timeout:7000,application_name:'history-photo-generation-attestor'});pool.on('error',()=>{});let closed=false;
 async function run(write,values){if(closed)throw Error('Generation source closed');let c;try{
  c=await pool.connect();c.on?.('error',()=>{});await c.query(write?'BEGIN':'BEGIN READ ONLY');await c.query('SET LOCAL ROLE NONE');await c.query("SELECT set_config('request.jwt.claims','{}',true),set_config('request.jwt.claim.sub','',true)");
  const audit=await c.query("SELECT current_user AS role,session_user AS login,rolsuper,rolbypassrls,rolcreaterole,rolcreatedb,rolinherit,EXISTS(SELECT FROM pg_auth_members WHERE member=r.oid) AS member,has_table_privilege(current_user,'photo_finish_v2.receipt_generations','SELECT,INSERT,UPDATE,DELETE') AS direct FROM pg_roles r WHERE rolname=current_user");
  const a=audit.rows[0];if(audit.rows.length!==1||a.role!=='photo_finish_attestor'||a.login!==a.role||['rolsuper','rolbypassrls','rolcreaterole','rolcreatedb','rolinherit','member','direct'].some(k=>a[k]!==false))throw Error('Generation identity rejected');
  const name=write?'photo_finish_v2.revalidate_generation(jsonb,jsonb)':'photo_finish_v2.recovery_state(uuid,uuid,uuid)';
  const f=await c.query({text:"SELECT pg_get_userbyid(proowner) AS owner,prosecdef,proconfig,has_function_privilege(current_user,oid,'EXECUTE') AS allowed FROM pg_proc WHERE oid=to_regprocedure($1)",values:[name]});const fn=f.rows[0];if(f.rows.length!==1||fn.owner!=='photo_finish_owner'||!fn.prosecdef||!fn.proconfig?.includes('search_path=""')||fn.allowed!==true)throw Error('Generation RPC rejected');
  const out=await c.query({text:write?'SELECT photo_finish_v2.revalidate_generation($1::jsonb,$2::jsonb) AS result':'SELECT photo_finish_v2.recovery_state($1::uuid,$2::uuid,$3::uuid) AS result',values});
  if(out.rows.length!==1||!out.rows[0].result)throw Error('Generation result rejected');await c.query('COMMIT');return out.rows[0].result;
 }catch{if(c){try{await c.query('ROLLBACK');}catch{}}throw Error('Generation outcome requires inspection');}finally{c?.release(true);}}
 return {state:(job,request,actor)=>run(false,[job,request,actor]),issue:(e,p)=>run(true,[JSON.stringify(e),JSON.stringify(p)]),async close(){if(!closed){closed=true;try{await pool.end();}catch{throw Error('Generation source close failed');}}}};
};
