import { activityPhotoPolicy } from "../photo-policy";
import type { EvidenceBinding } from "../upload-evidence";
import type { DirectUploadAuthority, DirectUploadPermit, DirectUploadRecord, BrowserStorageTransport } from "../direct-upload";

/** TEST ONLY. Models reusable bearer credentials intentionally; it does NOT emulate
 * one-time/revocable Storage tokens or prove any real provider's enforcement. */
export function createMemoryDirectUploadLab(now:()=>number=Date.now) {
  if(process.env.NODE_ENV!=="test")throw new Error("Direct upload lab is test-only");
  const admins=new WeakMap<object,string>(); const records=new Map<string,DirectUploadRecord>();
  const credentials=new WeakMap<object,DirectUploadPermit>(); const objects=new Map<string,Uint8Array>();
  let sequence=10;const id=()=>`${String(sequence++).padStart(8,'0')}-aaaa-4aaa-8aaa-aaaaaaaaaaaa`;
  const clone=<T>(v:T):T=>structuredClone(v);
  const equal=(a:EvidenceBinding,b:EvidenceBinding)=>JSON.stringify(a)===JSON.stringify(b);
  const actor=(context:unknown)=>context&&typeof context==='object'?admins.get(context):undefined;
  const authority:DirectUploadAuthority={
    async authorize(context){const actorId=actor(context);return actorId?{actorId}:null;},
    async reserve(actorId,m){
      const active=[...records.values()].filter(r=>r.binding.activityId===m.activityId);
      if(active.some(r=>r.deleteRequested)||active.length>=activityPhotoPolicy.maxFiles||
        active.reduce((n,r)=>n+r.binding.size,m.size)>activityPhotoPolicy.totalBytes)throw new Error("Capacity/deletion blocked");
      const photoId=id();const binding:EvidenceBinding={requestId:id(),activityId:m.activityId,actorId,photoId,ticket:id(),dispatchId:id(),slot:active.length,
        bucket:'history-activity-photos',path:`${m.activityId}/${photoId}.${m.mime==='image/jpeg'?'jpg':m.mime==='image/png'?'png':'webp'}`,
        size:m.size,mime:m.mime as EvidenceBinding['mime'],contentDigest:'a'.repeat(64)};
      // digest is placeholder mock data, never issued as verified evidence.
      records.set(binding.requestId,{binding:clone(binding),expiresAt:now()+7200000,phase:'issued',deleteRequested:false,cleanupRequired:false});return clone(binding);
    },
    async issue(binding){const record=records.get(binding.requestId);if(!record||!equal(binding,record.binding))throw new Error("Unknown binding");
      const credential=Object.freeze({});const permit={binding:clone(binding),expiresAt:record.expiresAt,credential};credentials.set(credential,permit);return permit;},
    async claim(context,binding){const record=records.get(binding.requestId);if(!record||actor(context)!==record.binding.actorId||!equal(binding,record.binding)||
      now()>=record.expiresAt||record.deleteRequested||record.phase!=='issued')return false;record.phase='dispatched';return true;},
    async uncertain(binding){const record=records.get(binding.requestId);if(!record||!equal(binding,record.binding))throw new Error("Unknown binding");record.phase='uncertain';},
  };
  const transport:BrowserStorageTransport={async send(permit,bytes){
    const signed=permit.credential&&typeof permit.credential==='object'?credentials.get(permit.credential):null;
    if(!signed||now()>=signed.expiresAt||!equal(signed.binding,permit.binding)||bytes.byteLength!==signed.binding.size)throw new Error("Invalid bearer scope");
    // Deliberately NO deletion check: a leaked pre-issued bearer may outlive app denial.
    if(objects.has(signed.binding.path))throw new Error("upsert=false conflict");
    objects.set(signed.binding.path,Uint8Array.from(bytes));
    const record=records.get(signed.binding.requestId);if(record?.deleteRequested)record.cleanupRequired=true;
  }};
  return {authority,transport,
    admin(actorId:string){const handle=Object.freeze({});admins.set(handle,actorId);return handle;},
    inspect(requestId:string){return clone(records.get(requestId)??null);},
    deleteIntent(requestId:string){const r=records.get(requestId);if(!r)throw new Error("Missing request");r.deleteRequested=true;r.cleanupRequired=true;},
    exists(path:string){return objects.has(path);},
    /** Model cleanup of this mock path only, to demonstrate leaked-token replay risk. */
    removeMockObject(path:string){objects.delete(path);},
  };
}
