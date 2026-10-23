import { activityPhotoPolicy } from "./photo-policy";
import "server-only";
import type { PhotoMime } from "./upload-coordinator";

export type EvidenceBinding = {
  requestId: string; activityId: string; actorId: string; photoId: string;
  ticket: string; dispatchId: string; slot: number;
  bucket: "history-activity-photos"; path: string;
  size: number; mime: PhotoMime; contentDigest: string;
};
export type CompletionState = {
  binding: EvidenceBinding; revision: number;
  phase: "awaiting_evidence" | "uncertain" | "completed";
  deleteRequested: boolean;
};
export type EvidenceKind = "storage_response" | "file_verified" | "ticket_closed";
export type VerifiedEvidence = {
  id: string; kind: EvidenceKind; binding: EvidenceBinding;
  /** Ordered durable observation sequence, not client clock timestamps. */
  sequence: number; issuer: "storage_observer" | "content_verifier" | "sql_receipt_verifier";
  previousId: string | null;
};
/** User authorization and machine authority are intentionally separate adapters.
 * Credentials/booleans/role strings in request payloads are never authenticators.
 * A production implementation needs a reviewed identity source; none exists here. */
export interface AdministratorVerifier { verify(context: unknown): Promise<{ actorId: string } | null> }
export interface ReporterVerifier { verify(context: unknown): Promise<{ subjectId: string; capability: "completion_report" } | null> }
export interface EvidenceVerifier {
  /** Resolve an opaque proof from a trusted issuer. Must verify provenance and facts:
   * stored+terminated response; downloaded bytes/digest/format/length; matching SQL
   * end receipt. A caller-supplied VerifiedEvidence object is never sufficient. */
  resolve(proof: unknown, reporterSubject: string): Promise<VerifiedEvidence | null>;
}
export interface CompletionLedger {
  read(requestId: string, slot: number): Promise<CompletionState | null>;
  /** Atomic revision/deletion/phase recheck + globally unique evidence consumption
   * + completion receipt. Conflict/replay must leave state and evidence unchanged.
   * A real implementation must persist across restarts; no production adapter exists. */
  commit(input: { expected: CompletionState; evidenceIds: string[]; reporterSubject: string }): Promise<boolean>;
}
export type CompletionAdapters = {
  administrator: AdministratorVerifier; reporter: ReporterVerifier;
  evidence: EvidenceVerifier; ledger: CompletionLedger;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export function validEvidenceBinding(b: EvidenceBinding): boolean {
  const extension = b.mime === "image/jpeg" ? "jpg" : b.mime === "image/png" ? "png" : b.mime === "image/webp" ? "webp" : null;
  return [b.requestId,b.activityId,b.actorId,b.photoId,b.ticket,b.dispatchId].every(id=>typeof id === "string" && uuid.test(id)) &&
    Number.isSafeInteger(b.slot) && b.slot >= 0 && b.slot < activityPhotoPolicy.maxFiles && b.bucket === "history-activity-photos" &&
    extension !== null && b.path === `${b.activityId}/${b.photoId}.${extension}` &&
    Number.isSafeInteger(b.size) && b.size > 0 && b.size <= activityPhotoPolicy.maxBytes && /^[a-f0-9]{64}$/.test(b.contentDigest);
}
export function sameEvidenceBinding(a: EvidenceBinding,b: EvidenceBinding): boolean {
  return (Object.keys(a) as (keyof EvidenceBinding)[]).length === 12 &&
    ["requestId","activityId","actorId","photoId","ticket","dispatchId","slot","bucket","path","size","mime","contentDigest"]
      .every(key=>a[key as keyof EvidenceBinding]===b[key as keyof EvidenceBinding]);
}
/** Validation-only domain boundary. Defaults disabled. Supplying mocks is not real
 * server authentication and does not activate the existing upload coordinator.
 * No API, DB, Storage, cleanup, timer or uncertain-state recovery is performed. */
export function createCompletionEvidenceValidator(adapters?: CompletionAdapters) {
  return {
    async report(input: { requestId: string; slot: number; adminContext: unknown; reporterContext: unknown; proofs: unknown[] }): Promise<"accepted" | "disabled" | "denied"> {
      if (!adapters) return "disabled";
      try {
        const admin = await adapters.administrator.verify(input.adminContext);
        const reporter = await adapters.reporter.verify(input.reporterContext);
        if (!admin || !reporter || reporter.capability !== "completion_report" || !reporter.subjectId) return "denied";
        const state = structuredClone(await adapters.ledger.read(input.requestId,input.slot));
        if (!state || !validEvidenceBinding(state.binding) || state.binding.requestId!==input.requestId || state.binding.slot!==input.slot ||
          state.binding.actorId!==admin.actorId || state.deleteRequested || state.phase!=="awaiting_evidence" ||
          !Number.isSafeInteger(state.revision) || state.revision<0 || input.proofs.length!==3) return "denied";
        const kinds: EvidenceKind[] = ["storage_response","file_verified","ticket_closed"];
        const issuers = ["storage_observer","content_verifier","sql_receipt_verifier"];
        const facts: VerifiedEvidence[] = [];
        for (let i=0;i<3;i++) {
          const fact = structuredClone(await adapters.evidence.resolve(input.proofs[i],reporter.subjectId));
          if (!fact || !uuid.test(fact.id) || fact.kind!==kinds[i] || fact.issuer!==issuers[i] ||
            !sameEvidenceBinding(state.binding,fact.binding) || !Number.isSafeInteger(fact.sequence) || fact.sequence<0 ||
            (i===0 ? fact.previousId!==null : fact.previousId!==facts[i-1].id || fact.sequence<=facts[i-1].sequence)) return "denied";
          facts.push(fact);
        }
        if (new Set(facts.map(f=>f.id)).size!==3) return "denied";
        // Recheck revocation after asynchronous evidence verification.
        const freshAdmin = await adapters.administrator.verify(input.adminContext);
        const freshReporter = await adapters.reporter.verify(input.reporterContext);
        if (freshAdmin?.actorId!==admin.actorId || freshReporter?.subjectId!==reporter.subjectId || freshReporter?.capability!=="completion_report") return "denied";
        return await adapters.ledger.commit({expected:state,evidenceIds:facts.map(f=>f.id),reporterSubject:reporter.subjectId}) ? "accepted" : "denied";
      } catch { return "denied"; } // no raw adapter errors/credentials exposed
    },
  };
}
