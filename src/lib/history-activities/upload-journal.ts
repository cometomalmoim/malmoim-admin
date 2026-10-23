import "server-only";
import type { UploadJournal, UploadRecord } from "./upload-coordinator";

export const JOURNAL_BUCKET = "history-activity-photos" as const;
export type UploadConfirmation = {
  /** An authenticated adapter acknowledgement, never a timeout or local abort. */
  kind: "reservation" | "ticket_issued" | "storage_terminated" | "file_verified" | "ticket_closed";
  photoIndex: number | null;
};
export type UploadJournalEntry = {
  schemaVersion: 1;
  bucket: typeof JOURNAL_BUCKET;
  record: UploadRecord;
  createdAt: number;
  updatedAt: number;
  lastConfirmedAt: number | null;
  confirmation: UploadConfirmation | null;
};
/** Server-only durable adapter contract. Each write MUST commit before returning.
 * claim: unique requestId across workers; never replace an existing claim.
 * CAS: atomically match revision and write revision+1, or return false without writes.
 * Never expire/reclaim a request because of time, worker loss, timeout or disconnect.
 * Preserve stable operation IDs, issued tickets and deletion intent across restarts.
 * Read/list return detached snapshots. Recovery is inspection, NOT permission to retry IO. Persisted dispatch intent is never
 * replay permission; local invocation does not prove actual remote receipt.
 * Authorization must be checked by the coordinator again before every external operation.
 * Store no credentials, sessions or file bytes. Scope every operation to this bucket.
 *
 * SQL mapping: photo upload_ticket/upload_in_flight are remote facts, not journal phases.
 * commands(actor,request_id) receipts do NOT provide this global job claim/CAS contract.
 * cleanup_observed_at is an absence observation, NOT lastConfirmedAt.
 * succeeded means coordinator transport completed, NOT SQL ready/published.
 * deleteRequested/deletion_pending persist scanner intent; retain tombstones in SQL.
 * A real journal table/transaction adapter and scanner remain separate, unimplemented work.
 */
export interface RecoverableUploadJournal extends UploadJournal {
  inspectEntry(requestId: string): Promise<UploadJournalEntry | null>;
  /** Explicit acknowledgement only; bumps the SAME revision as regular CAS.
   * Caller must reconcile conflicts, never continue IO using a stale revision.
   * Proof must match persisted ticket/response/verification facts; enum alone is insufficient. */
  confirm(requestId: string, revision: number, proof: UploadConfirmation): Promise<boolean>;
  /** Include incomplete/uncertain/deletion intent regardless of age. No automatic upload.
   * Production implementations must provide a consistent bounded pagination strategy. */
  listForRecovery(): Promise<UploadJournalEntry[]>;
}
