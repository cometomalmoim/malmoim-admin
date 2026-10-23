import { activityPhotoPolicy } from "../photo-policy";
import "server-only";
import { JOURNAL_BUCKET, type RecoverableUploadJournal, type UploadConfirmation, type UploadJournalEntry } from "../upload-journal";
import type { UploadRecord } from "../upload-coordinator";

/** TEST ONLY: shared heap simulates durable storage between worker instances.
 * NOT process/disk persistence; never instantiate in the application or production.
 * No database, network, timers, credential access or automatic retry implementation. */
export function createMemoryUploadJournalBackend() {
  if (process.env.NODE_ENV !== "test") throw new Error("Memory upload journal is test-only");
  const entries = new Map<string, UploadJournalEntry>();
  return {
    connect(bucket: typeof JOURNAL_BUCKET = JOURNAL_BUCKET, now: () => number = Date.now): RecoverableUploadJournal {
      if (bucket !== JOURNAL_BUCKET) throw new Error("Invalid journal bucket");
      const clone = <T>(value: T): T => structuredClone(value);
      const timestamp = () => { const value = now(); if (!Number.isSafeInteger(value) || value < 0) throw new Error("Invalid journal time"); return value; };
      const immutable = (record: UploadRecord) => JSON.stringify([record.requestId, record.actorId, record.activityId,
        record.fingerprint, record.reserveId, record.beginIds, record.endIds]);
      const valid = (record: UploadRecord) => {
        if (!Number.isSafeInteger(record.revision) || record.revision < 0 ||
          !Number.isSafeInteger(record.completed) || record.completed < 0 || record.completed > record.beginIds.length ||
          record.beginIds.length < 1 || record.beginIds.length > activityPhotoPolicy.maxFiles || record.endIds.length !== record.beginIds.length ||
          record.attempts.length !== record.beginIds.length || record.tickets.length !== record.beginIds.length || record.photos.length > record.beginIds.length ||
          record.photos.some(photo => !photo.path.startsWith(`${record.activityId}/${photo.photoId}.`) ||
            photo.path.includes("..") || photo.size < 1 || photo.size > activityPhotoPolicy.maxBytes) ||
          record.photos.reduce((sum, photo) => sum + photo.size, 0) > activityPhotoPolicy.totalBytes)
          throw new Error("Invalid journal record");
        if (record.attempts.some((attempt, i) => attempt && (!record.tickets[i] ||
          !["intent_recorded", "invoked"].includes(attempt.dispatch) ||
          !["unknown", "stored", "rejected"].includes(attempt.response) ||
          !["pending", "valid", "invalid"].includes(attempt.verification) ||
          (attempt.response !== "unknown" && attempt.dispatch !== "invoked") ||
          (attempt.verification !== "pending" && attempt.response !== "stored") ||
          (attempt.endConfirmed && attempt.response === "unknown")))) throw new Error("Invalid upload evidence");
        if (record.phase === "failed" && !record.attempts.some(attempt => attempt?.endConfirmed &&
          (attempt.response === "rejected" || (attempt.response === "stored" && attempt.verification === "invalid"))))
          throw new Error("Failure evidence required");
        const completed = record.attempts.filter(attempt => attempt?.response === "stored" && attempt.verification === "valid" && attempt.endConfirmed).length;
        if (record.completed > completed || (record.phase === "succeeded" && (completed !== record.beginIds.length || record.completed !== completed)))
          throw new Error("Completion evidence required");
      };
      // No await between comparison and write: atomic within this test backend only.
      return {
        async claim(record) {
          valid(record);
          if (entries.has(record.requestId)) return false;
          if (record.revision !== 0 || record.phase !== "claimed" || record.deleteRequested || record.attempts.some(Boolean) || record.photos.length > 0 || record.tickets.some(Boolean) || record.completed !== 0) throw new Error("Invalid initial claim");
          const time = timestamp();
          entries.set(record.requestId, clone({ schemaVersion: 1, bucket, record,
            createdAt: time, updatedAt: time, lastConfirmedAt: null, confirmation: null }));
          return true;
        },
        async read(id) { const entry = entries.get(id); return entry ? clone(entry.record) : null; },
        async compareAndSwap(id, revision, next) {
          const entry = entries.get(id);
          if (!entry || entry.record.revision !== revision) return false;
          valid(next);
          if (next.revision !== revision + 1 || immutable(next) !== immutable(entry.record) ||
            (entry.record.deleteRequested && (!next.deleteRequested || !["deletion_pending", "uncertain"].includes(next.phase))) ||
            next.completed < entry.record.completed || entry.record.tickets.some((ticket, index) => ticket && next.tickets[index] !== ticket) ||
            (entry.record.photos.length > 0 && JSON.stringify(next.photos) !== JSON.stringify(entry.record.photos)))
            throw new Error("Invalid journal transition");
          if (entry.record.attempts.some((old, index) => old && (!next.attempts[index] ||
            old.dispatchId !== next.attempts[index]?.dispatchId ||
            (old.dispatch === "invoked" && next.attempts[index]?.dispatch !== "invoked") ||
            (old.response !== "unknown" && old.response !== next.attempts[index]?.response) ||
            (old.verification !== "pending" && old.verification !== next.attempts[index]?.verification) ||
            (old.endConfirmed && !next.attempts[index]?.endConfirmed)))) throw new Error("Evidence regression");
          const time = Math.max(entry.updatedAt, timestamp());
          const verifiedIndex = next.attempts.findIndex((attempt, index) => attempt?.response === "stored" && attempt.verification === "valid" &&
            entry.record.attempts[index]?.verification !== "valid");
          entries.set(id, clone({ ...entry, record: next, updatedAt: time,
            lastConfirmedAt: verifiedIndex >= 0 ? time : entry.lastConfirmedAt,
            confirmation: verifiedIndex >= 0 ? {kind: "file_verified" as const, photoIndex: verifiedIndex} : entry.confirmation }));
          return true;
        },
        async inspectEntry(id) { const entry = entries.get(id); return entry ? clone(entry) : null; },
        async confirm(id, revision, proof: UploadConfirmation) {
          const entry = entries.get(id);
          if (!entry || entry.record.revision !== revision) return false;
          if (!["reservation", "ticket_issued", "storage_terminated", "file_verified", "ticket_closed"].includes(proof.kind) ||
            (proof.photoIndex !== null && (!Number.isSafeInteger(proof.photoIndex) || proof.photoIndex < 0 || proof.photoIndex >= entry.record.beginIds.length)))
            throw new Error("Invalid confirmation");
          const attempt = proof.photoIndex === null ? null : entry.record.attempts[proof.photoIndex];
          const supported = proof.kind === "reservation" ? entry.record.photos.length === entry.record.beginIds.length :
            proof.kind === "ticket_issued" ? proof.photoIndex !== null && !!entry.record.tickets[proof.photoIndex] :
            proof.kind === "storage_terminated" ? attempt?.response !== undefined && attempt.response !== "unknown" :
            proof.kind === "file_verified" ? attempt?.response === "stored" && attempt.verification === "valid" : !!attempt?.endConfirmed;
          if (!supported) throw new Error("Confirmation evidence required");
          const time = Math.max(entry.updatedAt, timestamp());
          entries.set(id, clone({ ...entry, record: { ...entry.record, revision: revision + 1 },
            updatedAt: time, lastConfirmedAt: time, confirmation: proof }));
          return true;
        },
        async listForRecovery() {
          return clone([...entries.values()].filter(entry => entry.record.deleteRequested || !["succeeded", "failed"].includes(entry.record.phase)));
        },
      };
    },
  };
}
