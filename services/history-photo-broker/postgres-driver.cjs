/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Node CommonJS service, outside Next.js runtime. */
// Standalone Node only. Explicit injection, never environment activation or automatic IO.
const {Pool}=require('pg'),{createHash}=require('node:crypto');
const AUDIT_HASH='f430c0a8d0b0df89e4c80cb3bede883d259673ee4e2e56ee55f1fc0e6a1eb5d1';
const PROBES=Object.freeze({session:"SELECT current_setting('ssl') AS ssl, current_setting('statement_timeout') AS statement_timeout, current_setting('request.jwt.claims') AS claims, current_user AS role",privateReceipt:'SELECT seal FROM photo_finish_v2.receipts LIMIT 1',otherRpc:"SELECT photo_finish_v2.attest('{}'::jsonb)",timeout:'SELECT pg_sleep(5)'});
exports.LOCAL_READ_ONLY_PROBES=PROBES;
const COMMIT='SELECT photo_finish_v2.commit($1::jsonb) AS completion';
function fault(error){const code=String(error?.code??'');return Object.assign(new Error('Photo database operation not confirmed'),/^[A-Z0-9]{5}$/.test(code)?{code}:{});}
function validCommit(values){try{if(values.length!==1||typeof values[0]!=='string')return false;const c=JSON.parse(values[0]),id=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;return Object.keys(c).sort().join()==='jobId,receiptId,requestId,revision,seal'&&[c.jobId,c.requestId,c.receiptId].every(v=>typeof v==='string'&&id.test(v))&&Number.isSafeInteger(c.revision)&&c.revision>=0&&c.revision<Number.MAX_SAFE_INTEGER&&typeof c.seal==='string'&&/^[a-f0-9]{64}$/.test(c.seal);}catch{return false;}}
function validRole(r){return r?.active_role==='photo_finish_worker'&&r.login_role==='photo_finish_worker'&&r.expected_rpc===true&&['rolsuper','rolbypassrls','rolcreaterole','rolcreatedb','rolreplication','rolinherit','has_memberships','owns_or_creates_schema','direct_object_rights','unexpected_function_rights'].every(k=>r[k]===false);}
/** Local profile always READ ONLY, exact loopback60422. It cannot enable writes.
 * In production only verified TLS on an explicit Supabase pooler is accepted.
 * receipt resolution is NOT implemented here: createPhotoWorkerConnection still requires it. */
exports.createPostgresPhotoDriver=function(contract,{localReadOnly=false,ca,PoolClass=Pool}={}){
 if(contract.PHOTO_WORKER_ROLE!=='photo_finish_worker'||contract.COMMIT_SQL!==COMMIT||createHash('sha256').update(contract.ROLE_AUDIT_SQL).digest('hex')!==AUDIT_HASH)throw Error('Unreviewed DB contract');
 return {async open(options){
  let u,user,password;try{u=new URL(options.connectionString);user=decodeURIComponent(u.username);password=decodeURIComponent(u.password);}catch{throw fault();}
  if(!['postgres:','postgresql:'].includes(u.protocol)||!password||u.pathname!=='/postgres'||u.search||u.hash||options.max!==2||options.connectionTimeoutMillis!==2000||options.idleTimeoutMillis!==10000||options.statementTimeoutMillis!==3000||options.preparedStatements!==false||options.ssl?.rejectUnauthorized!==true)throw Error('Invalid DB configuration');
  if(localReadOnly?u.hostname!=='127.0.0.1'||u.port!=='60422'||user!=='photo_finish_worker':!/[.]pooler[.]supabase[.]com$/.test(u.hostname)||u.port!=='6543'||!/^photo_finish_worker[.][a-z0-9]{20}$/.test(user))throw Error('Unapproved DB target');
  // Do not pass URI/sslmode or missing fields to pg: no PG* environment fallback.
  let pool;try{pool=new PoolClass({host:u.hostname,port:Number(u.port),user,password,database:'postgres',ssl:localReadOnly?false:{rejectUnauthorized:true,...(ca?{ca}:{})},max:2,min:0,idleTimeoutMillis:10000,connectionTimeoutMillis:2000,query_timeout:4500,statement_timeout:3000,lock_timeout:2000,idle_in_transaction_session_timeout:5000,application_name:'history-photo-worker',keepAlive:true,maxUses:1});}catch(e){throw fault(e);}
  // No raw errors/connection metadata in logs, including idle-client errors.
  pool.on('error',()=>{});let closed=false;const active=new Set();let closing;
  return {
   async transaction(work){
    if(closed)throw fault();let client,begun=false,live=true,failure;const pending=new Set();
    const run=async(sql,values=[])=>{try{return await client.query({text:sql,values:[...values]});}catch(e){failure??=e;throw e;}};
    try{
     client=await pool.connect();active.add(client);client.on?.('error',e=>{failure??=e;});
     await run(localReadOnly?'BEGIN READ ONLY':'BEGIN');begun=true;
     await run('SET LOCAL ROLE NONE');
     await run("SET LOCAL statement_timeout='3000ms'");await run("SET LOCAL lock_timeout='2000ms'");await run("SET LOCAL idle_in_transaction_session_timeout='5000ms'");
     await run("SELECT set_config('request.jwt.claims','{}',true),set_config('request.jwt.claim.sub','',true)");
     const identity=await run(contract.ROLE_AUDIT_SQL);if(identity.rows.length!==1||!validRole(identity.rows[0]))throw Error('Worker role rejected');
     const tx={query(sql,values){
      if(!live)return Promise.reject(fault());if(!Array.isArray(values)){failure??=Error('Invalid parameters');return Promise.reject(fault());}
      if((sql!==contract.ROLE_AUDIT_SQL||values.length!==0)&&(sql!==COMMIT||!validCommit(values))&&!(localReadOnly&&values.length===0&&Object.values(PROBES).includes(sql))){failure??=Error('Query rejected');return Promise.reject(fault());}
      const op=run(sql,values).then(r=>{if(sql===COMMIT&&(r.rows.length!==1||r.rows[0]?.completion!==''))throw Error('Invalid void response');return r.rows;}).catch(e=>{failure??=e;throw fault(e);});pending.add(op);op.then(()=>pending.delete(op),()=>pending.delete(op));return op;
     }};
     const value=await work(tx);live=false;await Promise.all([...pending]);if(failure)throw failure;
     await run('COMMIT');begun=false;return value;
    }catch(e){live=false;if(client&&begun){try{await run('ROLLBACK');}catch{}}throw fault(e);
    }finally{live=false;if(client){active.delete(client);client.release(true);}}
   },
   close(){if(!closing){closed=true;for(const client of active)client.connection?.stream?.destroy();closing=pool.end().catch(e=>{throw fault(e);});}return closing;}
  };
 }};
};
