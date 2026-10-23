/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Node service. */
const {Pool}=require('pg');
const LOOKUP='SELECT photo_finish_v2.lookup_receipt($1::uuid,$2::uuid,$3::uuid,$4::uuid) AS receipt';
exports.RECEIPT_LOOKUP_SQL=LOOKUP;
exports.createPostgresReceiptSource=function({connectionString,localReadOnly=false,ca,PoolClass=Pool}){
 let u,user,password;try{u=new URL(connectionString);user=decodeURIComponent(u.username);password=decodeURIComponent(u.password);}catch{throw Error('Receipt source disabled');}
 if(!['postgres:','postgresql:'].includes(u.protocol)||!password||u.pathname!=='/postgres'||u.search||u.hash||(localReadOnly?u.hostname!=='127.0.0.1'||u.port!=='60422'||user!=='photo_finish_attestor':!/[.]pooler[.]supabase[.]com$/.test(u.hostname)||u.port!=='6543'||!/^photo_finish_attestor[.][a-z0-9]{20}$/.test(user)))throw Error('Receipt source target rejected');
 let pool;try{pool=new PoolClass({host:u.hostname,port:Number(u.port),user,password,database:'postgres',ssl:localReadOnly?false:{rejectUnauthorized:true,...(ca?{ca}:{})},max:2,maxUses:1,connectionTimeoutMillis:2000,idleTimeoutMillis:10000,statement_timeout:3000,query_timeout:4500,application_name:'history-photo-receipt-reader'});}catch{throw Error('Receipt source disabled');}pool.on('error',()=>{});let closed=false;
 return {async read(c,actor){
  if(closed)return null;const id=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;if(![c.jobId,c.requestId,c.receiptId,actor].every(x=>typeof x==='string'&&id.test(x)))return null;
  let client;try{client=await pool.connect();client.on?.('error',()=>{});await client.query('BEGIN READ ONLY');await client.query('SET LOCAL ROLE NONE');await client.query("SELECT set_config('request.jwt.claims','{}',true),set_config('request.jwt.claim.sub','',true)");
   const r=await client.query("SELECT current_user AS role,session_user AS login,rolsuper,rolbypassrls,rolcreaterole,rolcreatedb,rolinherit,EXISTS(SELECT FROM pg_auth_members WHERE member=r.oid) AS member,has_table_privilege(current_user,'photo_finish_v2.receipts','SELECT,INSERT,UPDATE,DELETE') AS direct,has_function_privilege(current_user,'photo_finish_v2.lookup_receipt(uuid,uuid,uuid,uuid)','EXECUTE') AS allowed,pg_get_userbyid(p.proowner) AS owner,p.prosecdef,p.proconfig FROM pg_roles r CROSS JOIN pg_proc p WHERE rolname=current_user AND p.oid='photo_finish_v2.lookup_receipt(uuid,uuid,uuid,uuid)'::regprocedure");const a=r.rows[0];if(r.rows.length!==1||a.role!=='photo_finish_attestor'||a.login!==a.role||a.allowed!==true||a.owner!=='photo_finish_owner'||a.prosecdef!==true||!a.proconfig?.includes('search_path=""')||['rolsuper','rolbypassrls','rolcreaterole','rolcreatedb','rolinherit','member','direct'].some(k=>a[k]!==false))throw Error('Invalid attestor');
   const row=await client.query({text:LOOKUP,values:[c.jobId,c.requestId,c.receiptId,actor]});await client.query('COMMIT');return row.rows.length===1?row.rows[0].receipt:null;
  }catch{if(client){try{await client.query('ROLLBACK');}catch{}}return null;}finally{client?.release(true);}
 },async close(){if(!closed){closed=true;try{await pool.end();}catch{throw Error('Receipt source close failed');}}}};
};
