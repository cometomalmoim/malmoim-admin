import "server-only";

import type {FileReceipt,FinalizationCommit} from './verified-finalization';
/** Disabled by default. Uses only the installed worker commit(jsonb), never reservation. */
export const PHOTO_WORKER_ROLE = "photo_finish_worker";
export const PHOTO_DB_SECRET_NAME = "HISTORY_PHOTO_WORKER_DATABASE_URL";
export const ROLE_AUDIT_SQL = `SELECT current_user AS active_role, session_user AS login_role,
 r.rolsuper, r.rolbypassrls, r.rolcreaterole, r.rolcreatedb, r.rolreplication, r.rolinherit,
 EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members m WHERE m.member=r.oid) AS has_memberships,
 EXISTS(SELECT 1 FROM pg_catalog.pg_namespace n WHERE n.nspowner=r.oid
 OR (n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema' AND has_schema_privilege(r.oid,n.oid,'CREATE'))) AS owns_or_creates_schema,
 EXISTS(SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema' AND c.relkind IN ('r','p','v','m','f','S')
 AND (c.relowner=r.oid OR CASE WHEN c.relkind='S' THEN has_sequence_privilege(r.oid,c.oid,'USAGE,SELECT,UPDATE') ELSE (has_table_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AND NOT (n.nspname='extensions' AND c.relkind='v' AND c.relname IN ('pg_stat_statements','pg_stat_statements_info') AND NOT has_table_privilege(r.oid,c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))) END)) AS direct_object_rights,
 EXISTS(SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
 WHERE (n.nspname IN ('photo_finish_v2','photo_scope_v3','photo_service_v4','scope_private','public')) AND has_schema_privilege(r.oid,n.oid,'USAGE') AND
 (p.proowner=r.oid OR (has_function_privilege(r.oid,p.oid,'EXECUTE') AND
 p.oid IS DISTINCT FROM to_regprocedure('photo_finish_v2.commit(jsonb)')))) AS unexpected_function_rights,
 (to_regprocedure('photo_finish_v2.commit(jsonb)') IS NOT NULL AND has_schema_privilege(r.oid,'photo_finish_v2','USAGE') AND has_function_privilege(r.oid,'photo_finish_v2.commit(jsonb)','EXECUTE')) AS expected_rpc
 FROM pg_catalog.pg_roles r WHERE r.rolname=current_user`;
export const COMMIT_SQL = "SELECT photo_finish_v2.commit($1::jsonb) AS completion";

export type DbRow = Record<string, unknown>;
export interface PhotoTransaction {
  /** Real adapter: unnamed parameterized statements, bounded server query timeout.
   * No arbitrary SQL from requests. Timeout must cancel/settle at driver level;
   * a Promise.race alone is insufficient and cannot authorize replay. */
  query(sql: string, values: readonly unknown[]): Promise<DbRow[]>;
}
export interface PhotoPool {
  /** BEGIN / callback / COMMIT; any exception => ROLLBACK; always release client.
   * Commit-response loss is uncertain. Never automatically replay transactions. */
  transaction<T>(work: (tx: PhotoTransaction) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
export type PoolOptions = {
  connectionString: string; max: 2; idleTimeoutMillis: 10000;
  connectionTimeoutMillis: 2000; statementTimeoutMillis: 3000;
  ssl: { rejectUnauthorized: true }; preparedStatements: false;
};
export type WorkerPreparation = {
  runtime: "nodejs"; poolMode: "transaction"; projectRef: string; host: string;
  /** Internal deployment review, never a request flag. No reviewed config exists. */
  deploymentReviewed: boolean;
};
export type WorkerAdapters = {
  preparation: WorkerPreparation;
  /** Server-only secret provider. Never called by default. Do not cache user sessions. */
  readSecret(name: typeof PHOTO_DB_SECRET_NAME): Promise<string | null>;
  /** getUser + current admin_users lookup, no client-provided actor ID or admin flag. */
  authorize(context: unknown): Promise<{ actorId: string } | null>;
  /** Trusted server-held/DB-attested receipt resolver, never request JSON or browser evidence.
   * Must authenticate workload separately and bind the unconsumed one-use receipt to actor.
   * No production implementation exists. A worker cannot SELECT receipts directly. */
  receipts: {resolve(command: WorkerCommand, actorId:string): Promise<{command:WorkerCommand;evidence:FileReceipt}|null>};
  driver: { open(options: PoolOptions): Promise<PhotoPool> };
  /** Real Vercel adapter must attach lifecycle management once per warm pool. */
  attachLifecycle(pool: PhotoPool): void;
};
export type WorkerCommand = FinalizationCommit;
export type WorkerResult = { status: "disabled" | "denied" | "recorded" | "conflict" | "uncertain" };
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
function valid(input: WorkerCommand): boolean {
 return !!input && Object.keys(input).sort().join()==="jobId,receiptId,requestId,revision,seal" &&
 [input.jobId,input.requestId,input.receiptId].every(x=>typeof x==='string'&&uuid.test(x)) &&
 Number.isSafeInteger(input.revision)&&input.revision>=0&&input.revision<Number.MAX_SAFE_INTEGER&&
 typeof input.seal==='string'&&/^[a-f0-9]{64}$/.test(input.seal);
}
function receiptMatches(c:WorkerCommand,r:{command:WorkerCommand;evidence:FileReceipt}|null,actor:string){
 if(!r||!valid(r.command)||Object.keys(c).some(k=>c[k as keyof WorkerCommand]!==r.command[k as keyof WorkerCommand]))return false;
 const e=r.evidence,ext={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[e?.mime];
 return !!e&&!!ext&&[e.activityId,e.photoId].every(x=>uuid.test(x))&&e.actorId===actor&&e.jobId===c.jobId&&e.requestId===c.requestId&&e.revision===c.revision&&e.basis==='immutable-final-readback'&&
 Number.isSafeInteger(e.epoch)&&e.epoch>=0&&Number.isSafeInteger(e.size)&&e.size>0&&e.size<=4718592&&/^[a-f0-9]{64}$/.test(e.digest)&&
 e.tempPath===`${e.activityId}/${e.photoId}.${ext}`&&e.finalPath===`${e.activityId}/${e.photoId}/${e.digest}.${ext}`;
}
function safeIdentity(rows: DbRow[]): boolean {
  const r=rows[0];return rows.length===1 && !!r && r.active_role===PHOTO_WORKER_ROLE && r.login_role===PHOTO_WORKER_ROLE && r.expected_rpc===true &&
    ["rolsuper","rolbypassrls","rolcreaterole","rolcreatedb","rolreplication","rolinherit","has_memberships","owns_or_creates_schema","direct_object_rights","unexpected_function_rights"].every(k=>r[k]===false);
}
function options(secret: string, p: WorkerPreparation): PoolOptions | null {
  try {
    const url=new URL(secret);
    if (!p.deploymentReviewed || p.runtime!=="nodejs" || p.poolMode!=="transaction" ||
      !/^[a-z0-9]{20}$/.test(p.projectRef) || !/^[a-z0-9.-]+\.pooler\.supabase\.com$/.test(p.host) ||
      !["postgres:","postgresql:"].includes(url.protocol) || url.hostname!==p.host || url.port!=="6543" ||
      url.pathname!=="/postgres" || url.search!=="" || url.hash!=="" || !url.password ||
      decodeURIComponent(url.username)!==`${PHOTO_WORKER_ROLE}.${p.projectRef}`) return null;
    return {connectionString:secret,max:2,idleTimeoutMillis:10000,connectionTimeoutMillis:2000,statementTimeoutMillis:3000,ssl:{rejectUnauthorized:true},preparedStatements:false};
  } catch { return null; }
}
/** Internal receipt consumption only. No driver, credentials, HTTP route or activation.
 * Storage verification -> attestor receipt -> this worker commit. An uncertain commit
 * requires independent inspection; never automatic replay or fabricated success.
 */
export function createPhotoWorkerConnection(adapters?: WorkerAdapters) {
  let shared: Promise<PhotoPool> | undefined;
  async function pool(config: PoolOptions): Promise<PhotoPool> {
    if (!shared) shared=adapters!.driver.open(config).then(async p=>{try{adapters!.attachLifecycle(p);return p;}catch{await p.close();throw Error("Pool lifecycle unavailable");}}).catch(()=>{shared=undefined;throw Error("Connection unavailable");});
    return shared;
  }
  return {
    async commit(input: WorkerCommand, context: unknown): Promise<WorkerResult> {
      if (!adapters || !adapters.preparation.deploymentReviewed) return {status:"disabled"};
      if (!valid(input)) return {status:"denied"};
      input=Object.freeze({...input});
      let transactionStarted=false;
      try {
        const actor=await adapters.authorize(context);if(!actor || !uuid.test(actor.actorId))return {status:"denied"};
        if(!adapters.receipts||!receiptMatches(input,await adapters.receipts.resolve(input,actor.actorId),actor.actorId))return {status:"denied"};
        const secret=await adapters.readSecret(PHOTO_DB_SECRET_NAME);if(!secret)return {status:"disabled"};
        const config=options(secret,adapters.preparation);if(!config)return {status:"denied"};
        const db=await pool(config);
        return await db.transaction(async tx=>{
          if(!safeIdentity(await tx.query(ROLE_AUDIT_SQL,[])))return {status:"denied"} as WorkerResult;
          const fresh=await adapters.authorize(context);if(fresh?.actorId!==actor.actorId)return {status:"denied"} as WorkerResult;
          if(!receiptMatches(input,await adapters.receipts.resolve(input,actor.actorId),actor.actorId))return {status:"denied"} as WorkerResult;
          transactionStarted=true;
          const rows=await tx.query(COMMIT_SQL,[JSON.stringify(input)]);
          // PostgreSQL void maps to an empty string. No bool/claimed acknowledgement exists.
          if(rows.length!==1 || rows[0]?.completion!=="")throw Error("Invalid DB acknowledgement");
          return {status:"recorded"} as WorkerResult;
        });
      } catch(error) { const code=error&&typeof error==="object"&&"code" in error?error.code:null;return {status:code==="42501"?"denied":code==="40001"?"conflict":transactionStarted?"uncertain":"denied"}; }
    },
    /** Process shutdown only. Never call after each HTTP request. */
    async close(): Promise<void> { const current=shared;shared=undefined;if(current){try{await(await current).close();}catch{/* sanitized */}} },
  };
}

/** Bridge to verified-finalization.jobs.commit: a status object must never be mistaken
 * for Promise<void> success. Independent job inspection handles already-complete recovery. */
export function createWorkerCommitPort(worker:Pick<ReturnType<typeof createPhotoWorkerConnection>,'commit'>,context:unknown){
 return async(command:FinalizationCommit):Promise<void>=>{
  if((await worker.commit(command,context)).status!=="recorded")throw Error("DB completion not confirmed");
 };
}
