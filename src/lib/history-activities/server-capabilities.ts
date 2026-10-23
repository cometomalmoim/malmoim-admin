import "server-only";

/** Logical application operations, NOT SQL function names or callable endpoints.
 * Every RPC must atomically recheck admin_users, bindings, revision and tombstones.
 * Browser-session functions cannot assert file verification/completion/publication.
 * Worker EXECUTE grants must match ROLE_AUDIT_SQL before any real connection;
 * server-db.ts consumes only DB-attested receipts through photo_finish_v2.commit(jsonb).
 * Names here are logical application commands, never interpolated SQL or receipt evidence.
 */
export const PHOTO_DB_FUNCTIONS = Object.freeze({
  create_activity: "administrator", reserve_photos: "administrator",
  set_layout: "administrator", unpublish_activity: "administrator",
  record_permit: "permit_issuer",
  record_observation: "finalizer", commit_finalization: "finalizer",
  inspect_recovery: "finalizer", commit_publication: "finalizer",
  read_public_manifest: "public_reader",
} as const);
export const PHOTO_BUCKETS = Object.freeze({temporary:"history-activity-photos",final:"history-activity-final-photos"} as const);
export const PHOTO_MACHINE_ROLES = Object.freeze({
  finalizer:"photo_finish_worker",permit_issuer:"photo_storage_issuer",public_reader:"photo_scope_reader",
} as const);
export type MachinePurpose = "finalizer" | "permit_issuer" | "public_reader";
export type PhotoBinding = {
  requestId:string;activityId:string;photoId:string;revision:number;
  digest:string;extension:"jpg"|"png"|"webp";
};
export type StorageAction = "issue_temp_permit"|"read_temp"|"create_final"|"read_final"|"sign_final_read";
const operations:Record<StorageAction,{purpose:MachinePurpose[];area:"temporary"|"final"}>={
  issue_temp_permit:{purpose:["permit_issuer"],area:"temporary"},
  read_temp:{purpose:["finalizer"],area:"temporary"},
  create_final:{purpose:["finalizer"],area:"final"},
  read_final:{purpose:["finalizer","public_reader"],area:"final"},
  sign_final_read:{purpose:["public_reader"],area:"final"},
};
export interface MachinePeer {
  /** Opaque handle authenticated by a future real transport, NOT request JSON/JWT claims alone. */
  handle:unknown;subject:string;purpose:MachinePurpose;role:string;
}
export interface CapabilityAdapters {
  admin(context:unknown):Promise<{actorId:string}|null>;
  machine:{
    /** No request parameters. Resolve only server-owned credentials, fail if unconfigured.
     * Must reject service_role/BYPASSRLS/wildcard grants; DB and Storage identities are
     * separately verified and mapped to the SAME narrowly scoped purpose. */
    authenticate():Promise<MachinePeer|null>;
    /** Reauthenticate/recheck revocation/role/grants with trusted transport each operation. */
    verify(peer:MachinePeer):Promise<boolean>;
  };
  /** Trusted DB lookup: server allocated paths/request IDs, current CAS and deletion state.
   * Public reader must additionally prove ready immutable final + current public snapshot.
   * Never implement by returning a browser-provided boolean or echoing request metadata. */
  bindingAllowed(binding:PhotoBinding,operation:string,purpose:MachinePurpose|"administrator"):Promise<boolean>;
  db:{
    /** No arbitrary SQL/table/SET ROLE interface. Actor comes from getUser, never payload.
     * Unique request+operation receipt and CAS must be transactional, across instances. */
    execute(name:keyof typeof PHOTO_DB_FUNCTIONS,binding:PhotoBinding,actorId:string|null):Promise<"recorded"|"conflict">;
  };
  storage:{
    /** Real implementation needs scoped Storage auth, exact path + max bytes enforced
     * by provider, immutable create (upsert:false), not SDK policy checks alone.
     * No delete/update/list-all/copy/move or final signed-upload method exists here. */
    execute(input:{action:StorageAction;bucket:string;path:string;binding:PhotoBinding;upsert:false;readUrlTtl:60|null;maxBytes:4718592}):Promise<void>;
  };
}
export type CapabilityResult={status:"disabled"|"denied"|"recorded"|"conflict"|"uncertain"};
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
function valid(b:PhotoBinding){return !!b&&Object.keys(b).sort().join() === "activityId,digest,extension,photoId,requestId,revision"&&[b.activityId,b.photoId,b.requestId].every(x=>typeof x==='string'&&uuid.test(x))&&Number.isSafeInteger(b.revision)&&b.revision>=0&&b.revision<Number.MAX_SAFE_INTEGER&&/^[a-f0-9]{64}$/.test(b.digest)&&['jpg','png','webp'].includes(b.extension);}
export function createPhotoCapabilities(adapters?:CapabilityAdapters){
  const peers=new WeakMap<object,MachinePeer>();
  async function peer(context:unknown,purpose:MachinePurpose[]){
    if(!context||typeof context!=='object')return null;const known=peers.get(context);
    if(!known||known.role!==PHOTO_MACHINE_ROLES[known.purpose]||!purpose.includes(known.purpose)||!await adapters!.machine.verify(known))return null;
    return known;
  }
  return {
    /** Server-internal only; no HTTP binding. Returning this object to clients destroys
     * its WeakMap identity. This is an in-process boundary, NOT real DB/Storage auth. */
    async issueMachineContext():Promise<object|null>{
      if(!adapters)return null;
      try{const authenticated=await adapters.machine.authenticate();if(!authenticated||!['finalizer','permit_issuer','public_reader'].includes(authenticated.purpose)||!authenticated.subject||authenticated.role!==PHOTO_MACHINE_ROLES[authenticated.purpose]||!await adapters.machine.verify(authenticated))return null;
        const context=Object.freeze({});peers.set(context,{...authenticated});return context;
      }catch{return null;}
    },
    async database(name:string,binding:PhotoBinding,adminContext:unknown,machineContext?:unknown):Promise<CapabilityResult>{
      if(!adapters)return {status:"disabled"};
      if(!Object.hasOwn(PHOTO_DB_FUNCTIONS,name)||!valid(binding))return {status:"denied"};
      binding=Object.freeze({...binding});let started=false;
      try{
        const fn=name as keyof typeof PHOTO_DB_FUNCTIONS;const required=PHOTO_DB_FUNCTIONS[fn];
        const actor=required==='public_reader'?null:await adapters.admin(adminContext);
        if(required!=='public_reader'&&(!actor||!uuid.test(actor.actorId)))return {status:"denied"};
        if(required!=='administrator'&&!await peer(machineContext,[required]))return {status:"denied"};
        if(!await adapters.bindingAllowed(binding,name,required))return {status:"denied"};
        if(required!=='public_reader'&&(await adapters.admin(adminContext))?.actorId!==actor?.actorId)return {status:"denied"};
        if(required!=='administrator'&&!await peer(machineContext,[required]))return {status:"denied"};
        started=true;return {status:await adapters.db.execute(fn,binding,actor?.actorId??null)};
      }catch{return {status:started?"uncertain":"denied"};}
    },
    async storage(action:string,binding:PhotoBinding,adminContext:unknown,machineContext:unknown):Promise<CapabilityResult>{
      if(!adapters)return {status:"disabled"};if(!Object.hasOwn(operations,action)||!valid(binding))return {status:"denied"};binding=Object.freeze({...binding});let started=false;
      try{
        const operation=action as StorageAction,rule=operations[operation];const known=await peer(machineContext,rule.purpose);if(!known)return {status:"denied"};
        const actor=known.purpose==='public_reader'?null:await adapters.admin(adminContext);if(known.purpose!=='public_reader'&&(!actor||!uuid.test(actor.actorId)))return {status:"denied"};
        if(!await adapters.bindingAllowed(binding,action,known.purpose))return {status:"denied"};
        if(known.purpose!=='public_reader'&&(await adapters.admin(adminContext))?.actorId!==actor?.actorId)return {status:"denied"};
        if(!await peer(machineContext,[known.purpose]))return {status:"denied"};
        const path=rule.area==='temporary'?`${binding.activityId}/${binding.photoId}.${binding.extension}`:`${binding.activityId}/${binding.photoId}/${binding.digest}.${binding.extension}`;
        started=true;await adapters.storage.execute({action:operation,bucket:PHOTO_BUCKETS[rule.area],path,binding,upsert:false,readUrlTtl:operation==='sign_final_read'?60:null,maxBytes:4718592});
        // This acknowledgement is NOT upload termination/file verification/publication.
        return {status:"recorded"};
      }catch{return {status:started?"uncertain":"denied"};}
    },
  };
}
