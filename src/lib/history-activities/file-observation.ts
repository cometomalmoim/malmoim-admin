import "server-only";
import { validEvidenceBinding, sameEvidenceBinding, type EvidenceBinding } from "./upload-evidence";

export type FileTrackingRecord = {
  binding: EvidenceBinding; revision: number;
  deleteRequested: boolean; tombstone: boolean; permitExpiresAt: number;
  needsRecheck: boolean;
};
/** Independent server observation. Browser callbacks never supply this value.
 * A real adapter must download/verify bytes, decode format, compute digest, and
 * read provider metadata. A plain metadata HEAD/exists response is insufficient.
 * generation must detect replacement/ABA, not merely reuse an ETag of equal bytes. */
export type StorageFileSnapshot = {
  binding: EvidenceBinding; generation: string; observedAt: number;
  file: null | {
    downloadedSize: number; decodedMime: string; digest: string; decodable: boolean;
    metadataSize: number; metadataMime: string;
    archived: boolean; deleteMarker: boolean; incomplete: boolean;
  };
};
export type FileObservation = {
  binding: EvidenceBinding; checkedAt: number; generation: string;
  status: "content_matches" | "absent" | "mismatch";
  /** Content observations NEVER authenticate Storage termination or close tickets. */
  termination: "unproven";
};
export interface FileObservationAdapters {
  /** Reviewed server capability required; default has no implementation. */
  authorize(context: unknown): Promise<{ subject: string; capability: "observe_activity_files" } | null>;
  records: {
    get(requestId: string, slot: number): Promise<FileTrackingRecord | null>;
    /** Only persisted exact paths, including permanent deletion tombstones.
     * Production pagination/durability remains unimplemented. No bucket listing. */
    tracked(): Promise<FileTrackingRecord[]>;
    /** Atomic journal version/deletion recheck and append-only observation.
     * Preserve ticket, deletion intent, tombstones and pending/uncertain upload.
     * A real DB cannot atomically lock Storage: any generation recheck here is
     * advisory and never sufficient to mark ready/completed or safely forget paths. */
    append(expected: FileTrackingRecord, observation: FileObservation): Promise<boolean>;
  };
  /** Adapter must impose bounded read/decode deadlines and resource limits;
   * timeout/cancellation must throw, never return absence. No real adapter exists. */
  storage: { inspect(binding: EvidenceBinding): Promise<StorageFileSnapshot> };
  now(): number;
}
export type ObservationResult = "disabled" | "denied" | "unknown" | "changed" | "recorded";
/** No completion, end_upload, ready transition, delete or evidence issuer exists.
 * Even two consistent samples only describe an interval; writes can occur later,
 * during valid permits, after expiry (in-flight), and after cleanup. Keep tracking. */
export function createFileObserver(adapters?: FileObservationAdapters) {
  async function inspect(context:unknown,requestId:string,slot:number):Promise<ObservationResult>{
    if(!adapters)return "disabled";
    try{
      const authority=await adapters.authorize(context);
      if(!authority || authority.capability!=="observe_activity_files" || !authority.subject)return "denied";
      const record=structuredClone(await adapters.records.get(requestId,slot));
      if(!record || !validEvidenceBinding(record.binding) || record.binding.requestId!==requestId || record.binding.slot!==slot)return "denied";
      const first=structuredClone(await adapters.storage.inspect(record.binding));
      const second=structuredClone(await adapters.storage.inspect(record.binding));
      const time=adapters.now();
      for(const snapshot of [first,second]){
        if(!sameEvidenceBinding(record.binding,snapshot.binding) || !snapshot.generation ||
          !Number.isSafeInteger(snapshot.observedAt) || !Number.isSafeInteger(time) || snapshot.observedAt>time || time-snapshot.observedAt>5000)return "unknown";
      }
      if(second.observedAt<first.observedAt || first.generation!==second.generation || JSON.stringify(first.file)!==JSON.stringify(second.file))return "changed";
      const file=second.file;
      const matches=file && file.decodable && !file.archived && !file.deleteMarker && !file.incomplete &&
        file.downloadedSize===record.binding.size && file.metadataSize===record.binding.size &&
        file.decodedMime===record.binding.mime && file.metadataMime===record.binding.mime && file.digest===record.binding.contentDigest;
      const observation:FileObservation={binding:record.binding,checkedAt:time,generation:second.generation,
        status:file===null?"absent":matches?"content_matches":"mismatch",termination:"unproven"};
      const fresh=await adapters.authorize(context);
      if(fresh?.subject!==authority.subject || fresh.capability!=="observe_activity_files")return "denied";
      return await adapters.records.append(record,observation)?"recorded":"changed";
    }catch{return "unknown";} // timeout/auth/network errors are never 'absent'
  }
  return {inspect,
    /** Tracking scanner only: no deletion method is accepted by these adapters. */
    async scan(context:unknown):Promise<ObservationResult[]>{
      if(!adapters)return ["disabled"];
      try{
        const access=await adapters.authorize(context);if(!access||access.capability!=="observe_activity_files")return ["denied"];
        const tracked=await adapters.records.tracked();const results:ObservationResult[]=[];
        for(const record of tracked)results.push(await inspect(context,record.binding.requestId,record.binding.slot));
        return results;
      }catch{return ["unknown"];}
    },
  };
}
