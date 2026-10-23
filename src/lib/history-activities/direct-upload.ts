import { activityPhotoPolicy } from "./photo-policy";
import type { EvidenceBinding } from "./upload-evidence";

/** Browser-to-Next request: metadata ONLY. It is untrusted, not verified file evidence. */
export type DirectUploadMetadata = { activityId: string; size: number; mime: string };
export type DirectUploadPermit = {
  binding: EvidenceBinding;
  expiresAt: number;
  /** Secret bearer material; never log, persist in journal, or include in errors.
   * Opaque mock handle today; future adapter may hold signed URL/token in memory. */
  credential: unknown;
};
export type DirectUploadRecord = {
  binding: EvidenceBinding; expiresAt: number;
  phase: "issued" | "dispatched" | "uncertain";
  deleteRequested: boolean; cleanupRequired: boolean;
};
export interface DirectUploadAuthority {
  authorize(context: unknown): Promise<{ actorId: string } | null>;
  /** Atomic reservation: counts ALL active/reserved photos under activity lock,
   * enforces shared 10/4.5MiB/45MiB policy, stable server IDs/path/ticket/dispatch,
   * and persists intent before any bearer credential is minted. No file bytes. */
  reserve(actorId: string, metadata: DirectUploadMetadata): Promise<EvidenceBinding>;
  /** Signing must target ONLY the binding path/bucket, upsert=false.
   * Actual Supabase signed upload credentials last 2 hours; no invented short TTL
   * or single-use/revocation guarantee. Persist provider expiry before release. */
  issue(binding: EvidenceBinding): Promise<DirectUploadPermit>;
  /** Atomic owner+expiry+deletion+version check and one local dispatch claim.
   * This limits cooperating clients only; it cannot revoke leaked Storage tokens. */
  claim(context: unknown, binding: EvidenceBinding): Promise<boolean>;
  uncertain(binding: EvidenceBinding): Promise<void>;
}
export interface BrowserStorageTransport {
  /** Upload bytes directly to the prevalidated Storage origin/path, never Next.js.
   * No fallback URL, redirects, automatic retry, or caller-selected bucket/path.
   * Response is a browser observation, NOT server completion evidence. */
  send(permit: DirectUploadPermit, bytes: Uint8Array): Promise<void>;
}
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
export function validDirectMetadata(value: unknown): value is DirectUploadMetadata {
  if (!value || typeof value!=="object") return false;
  const m=value as DirectUploadMetadata;
  return Object.keys(value).sort().join(',')==='activityId,mime,size' && uuid.test(m.activityId) &&
    Number.isSafeInteger(m.size) && m.size>0 && m.size<=activityPhotoPolicy.maxBytes && activityPhotoPolicy.mimeTypes.some(type=>type===m.mime);
}
/** Unwired transport experiment. Default has no authority and cannot mint permits.
 * No coordinator/evidence completion mapping is provided: direct upload does not
 * give the server its own Storage termination response. Browser success, existence,
 * token expiry and even byte verification alone cannot safely close the old ticket.
 * A separately trusted remote termination source + scanner must be designed first. */
export function createDirectUploadContract(authority?: DirectUploadAuthority) {
  return {
    async prepare(context: unknown, metadata: unknown): Promise<DirectUploadPermit | null> {
      if (!authority || !validDirectMetadata(metadata)) return null;
      try {
        const admin=await authority.authorize(context); if(!admin)return null;
        const binding=await authority.reserve(admin.actorId,metadata);
        return await authority.issue(binding);
      } catch { return null; }
    },
    async claim(context:unknown,permit:DirectUploadPermit):Promise<boolean>{
      if(!authority)return false;
      try{return await authority.claim(context,permit.binding);}catch{return false;}
    },
    /** No user-controlled result boolean or proof is accepted. Always uncertain. */
    async notify(context:unknown,permit:DirectUploadPermit):Promise<"uncertain"|"disabled"|"denied">{
      if(!authority)return "disabled";
      const admin=await authority.authorize(context);
      if(admin?.actorId!==permit.binding.actorId)return "denied";
      await authority.uncertain(permit.binding);return "uncertain";
    },
  };
}
/** Byte payload is provided only to Storage transport. Next control gets metadata,
 * permit identity and a notification, with no bytes. All outcomes stay uncertain. */
export async function simulateBrowserDirectUpload(
  control: { claim(context:unknown,permit:DirectUploadPermit):Promise<boolean>; notify(context:unknown,permit:DirectUploadPermit):Promise<unknown> },
  context:unknown,permit:DirectUploadPermit,bytes:Uint8Array,transport:BrowserStorageTransport,
):Promise<"blocked"|"uncertain">{
  if(bytes.byteLength!==permit.binding.size || bytes.byteLength>activityPhotoPolicy.maxBytes || !await control.claim(context,permit))return "blocked";
  try{await transport.send(permit,bytes);}catch{/* browser errors and success are equally untrusted */}
  await control.notify(context,permit);return "uncertain";
}
