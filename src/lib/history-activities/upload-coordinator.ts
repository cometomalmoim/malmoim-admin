import { activityPhotoPolicy } from "./photo-policy";
import "server-only";
import { createHash, randomUUID } from "node:crypto";

export const ACTIVITY_PHOTO_BUCKET = "history-activity-photos" as const;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export type PhotoMime = "image/jpeg" | "image/png" | "image/webp";
export type PhotoDescriptor = { size: number; mime: PhotoMime };
export type ActivitySnapshot = { revision: number; count: number; bytes: number; deletionPending: boolean };
export type UploadPhase = "claimed" | "reserved" | "starting" | "uploading" | "verifying" | "ending" | "succeeded" | "failed" | "uncertain" | "deletion_pending";
export type UploadIssue = "storage_rejected" | "invalid_file" | "needs_confirmation" | "deletion_requested";
export type Reservation = PhotoDescriptor & { photoId: string; path: string };
/** Evidence is server-adapter supplied, not browser assertions. Invoked is a durable local invocation marker written before the call;
 * a crash in between means even local entry and remote dispatch remain unproven. */
export type UploadAttempt = {
  dispatchId: string; dispatch: "intent_recorded" | "invoked";
  response: "unknown" | "stored" | "rejected";
  verification: "pending" | "valid" | "invalid"; endConfirmed: boolean;
};
/** Future trusted-server boundary. Authentication/credential mechanism is unresolved.
 * This shape conveys evidence, it is NOT authorization or proof of authenticity. */
export type ServerTerminationReport = { dispatchId: string; response: "stored" | "rejected"; verification: UploadAttempt["verification"] };
export type UploadRecord = {
  requestId: string; activityId: string; actorId: string; fingerprint: string;
  revision: number; phase: UploadPhase; issue?: UploadIssue; deleteRequested: boolean;
  reserveId: string; beginIds: string[]; endIds: string[];
  attempts: (UploadAttempt | null)[];
  photos: Reservation[]; tickets: (string | null)[]; completed: number;
};
/** Durable implementation MUST provide atomic, globally unique claims and CAS.
 * Persist before side effects, survive process loss, and return detached snapshots.
 * Never store sessions, file bytes, passwords or API credentials in this journal. */
export interface UploadJournal {
  claim(record: UploadRecord): Promise<boolean>;
  read(requestId: string): Promise<UploadRecord | null>;
  compareAndSwap(requestId: string, revision: number, next: UploadRecord): Promise<boolean>;
}
export interface UploadAdapters {
  admin: { requireAdmin(): Promise<{ actorId: string }> };
  journal: UploadJournal;
  activity: {
    snapshot(activityId: string): Promise<ActivitySnapshot>;
    reserve(input: { activityId: string; revision: number; operationId: string; files: PhotoDescriptor[] }): Promise<Reservation[]>;
    begin(input: { activityId: string; revision: number; operationId: string; photoId: string }): Promise<{ ticket: string }>;
    end(input: { activityId: string; revision: number; operationId: string; photoId: string; ticket: string; report: ServerTerminationReport }): Promise<void>;
  };
  storage: {
    /** Exactly one attempt, upsert=false. 'rejected' means verified remote termination,
     * NOT a timeout/abort/guessed HTTP status. Throws and 'unknown' remain uncertain.
     * Adapter must disable hidden retries and constrain network destination separately. */
    upload(input: { bucket: typeof ACTIVITY_PHOTO_BUCKET; path: string; bytes: Uint8Array; mime: PhotoMime; upsert: false }): Promise<"stored" | "rejected" | "unknown">;
    /** Check downloaded bytes, actual length, format/signature and decoding.
     * No browser-supplied verification boolean is trusted. */
    verify(input: { bucket: typeof ACTIVITY_PHOTO_BUCKET; photo: Reservation; bytes: Uint8Array }): Promise<boolean>;
  };
}
export type UploadView = { requestId: string; phase: UploadPhase | "disabled"; issue?: UploadIssue; needsReview: boolean };
export function validateActivityPhotoBatch(files: PhotoDescriptor[], budget: Pick<ActivitySnapshot, "count" | "bytes">) {
  if (!Number.isSafeInteger(budget.count) || budget.count < 0 || !Number.isSafeInteger(budget.bytes) || budget.bytes < 0 ||
    files.length < 1 || files.length + budget.count > activityPhotoPolicy.maxFiles || files.some(file =>
      !Number.isSafeInteger(file.size) || file.size < 1 || file.size > activityPhotoPolicy.maxBytes ||
      !activityPhotoPolicy.mimeTypes.some(mime => mime === file.mime)) ||
    files.reduce((sum, file) => sum + file.size, budget.bytes) > activityPhotoPolicy.totalBytes) throw new Error("Invalid activity photo limits");
}
function view(record: UploadRecord): UploadView {
  return { requestId: record.requestId, phase: record.phase, issue: record.issue,
    needsReview: !["succeeded", "failed"].includes(record.phase) };
}
/** Core only: no Supabase client, routes, environment flags, timers-as-leases or cleanup IO.
 * enabled defaults false and must stay false in actual application wiring.
 * A future coordinator journal adapter, server authentication, SQL activation and
 * tombstone scanner need separate review before connecting this to real storage. */
export function createUploadCoordinator(adapters: UploadAdapters, options: { enabled?: boolean; timeoutMs?: number } = {}) {
  const timeoutMs = options.timeoutMs ?? 30_000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 300_000) throw new Error("Invalid wait deadline");
  async function authorize(actorId?: string) {
    let admin: { actorId: string };
    try { admin = await adapters.admin.requireAdmin(); }
    catch { throw new Error("Administrator required"); }
    if (!uuid.test(admin.actorId) || (actorId && admin.actorId !== actorId)) throw new Error("Administrator required");
    return admin;
  }
  async function read(id: string) {
    const record = await adapters.journal.read(id);
    if (!record) throw new Error("Upload record unavailable");
    return record;
  }
  async function change(id: string, update: (record: UploadRecord) => UploadRecord) {
    for (let attempts = 0; attempts < 8; attempts++) {
      const record = await read(id);
      const next = { ...update(record), revision: record.revision + 1 };
      if (await adapters.journal.compareAndSwap(id, record.revision, next)) return next;
    }
    throw new Error("Upload journal contention");
  }
  async function context(record: UploadRecord) {
    await authorize(record.actorId);
    const state = await adapters.activity.snapshot(record.activityId);
    if (!Number.isSafeInteger(state.revision) || state.revision < 1) throw new Error("Invalid activity revision");
    return state;
  }
  async function phase(id: string, next: UploadPhase, issue?: UploadIssue) {
    return change(id, record => ({ ...record,
      phase: record.deleteRequested && next !== "uncertain" ? "deletion_pending" : next,
      issue: record.deleteRequested && next !== "uncertain" ? "deletion_requested" : issue }));
  }
  async function waitForUpload(run: () => ReturnType<UploadAdapters["storage"]["upload"]>, signal?: AbortSignal) {
    // A local wait ends; the remote request is NOT cancelled or declared terminated.
    if (signal?.aborted) return "unknown" as const;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let abort: (() => void) | undefined;
    const deadline = new Promise<"unknown">(resolve => {
      timer = setTimeout(() => resolve("unknown"), timeoutMs);
      abort = () => resolve("unknown"); signal?.addEventListener("abort", abort, { once: true });
    });
    try {
      const result = await Promise.race([Promise.resolve().then(run).catch(() => "unknown" as const), deadline]);
      return ["stored", "rejected", "unknown"].includes(result) ? result : "unknown";
    } finally {
      if (timer) clearTimeout(timer);
      if (abort) signal?.removeEventListener("abort", abort);
    }
  }
  return {
    async upload(input: { requestId: string; activityId: string; files: { bytes: Uint8Array; mime: PhotoMime }[]; signal?: AbortSignal }): Promise<UploadView> {
      if (!options.enabled) return { requestId: input.requestId, phase: "disabled", needsReview: false };
      if (!uuid.test(input.requestId) || !uuid.test(input.activityId)) throw new Error("Invalid upload identity");
      const admin = await authorize();
      if (input.files.some(file => !(file.bytes instanceof Uint8Array))) throw new Error("Invalid photo bytes");
      validateActivityPhotoBatch(input.files.map(file => ({ size: file.bytes.byteLength, mime: file.mime })), { count: 0, bytes: 0 });
      // Own immutable byte snapshots: a caller cannot mutate bytes after fingerprinting.
      const files = input.files.map(file => ({ bytes: Uint8Array.from(file.bytes), mime: file.mime }));
      const descriptors = files.map(file => ({ size: file.bytes.byteLength, mime: file.mime }));
      validateActivityPhotoBatch(descriptors, { count: 0, bytes: 0 });
      const fingerprint = createHash("sha256").update(JSON.stringify({ activityId: input.activityId,
        files: files.map(file => ({ size: file.bytes.byteLength, mime: file.mime, digest: createHash("sha256").update(file.bytes).digest("hex") })) })).digest("hex");
      const existing = await adapters.journal.read(input.requestId);
      if (existing) {
        if (existing.actorId !== admin.actorId || existing.fingerprint !== fingerprint) throw new Error("Upload request ID conflict");
        return view(existing); // Never reissue even reserve/begin after an uncertain response.
      }
      const initial: UploadRecord = { ...admin, requestId: input.requestId, activityId: input.activityId, fingerprint,
        revision: 0, phase: "claimed", deleteRequested: false, reserveId: randomUUID(),
        beginIds: files.map(() => randomUUID()), endIds: files.map(() => randomUUID()), attempts: files.map(() => null), photos: [], tickets: files.map(() => null), completed: 0 };
      if (!await adapters.journal.claim(initial)) {
        const winner = await read(input.requestId);
        if (winner.actorId !== admin.actorId || winner.fingerprint !== fingerprint) throw new Error("Upload request ID conflict");
        return view(winner);
      }
      try {
        const budget = await context(initial);
        if (budget.deletionPending) return view(await phase(input.requestId, "deletion_pending", "deletion_requested"));
        validateActivityPhotoBatch(descriptors, budget);
        const photos = await adapters.activity.reserve({ activityId: input.activityId, revision: budget.revision, operationId: initial.reserveId, files: descriptors });
        if (photos.length !== files.length || new Set(photos.map(photo => photo.photoId)).size !== photos.length || photos.some((photo, i) => {
          const ext = photo.mime === "image/jpeg" ? "jpg" : photo.mime === "image/png" ? "png" : "webp";
          return !uuid.test(photo.photoId) || photo.path !== `${input.activityId}/${photo.photoId}.${ext}` || photo.size !== descriptors[i].size || photo.mime !== descriptors[i].mime;
        })) throw new Error("Invalid server reservation");
        await change(input.requestId, record => ({ ...record, photos, phase: "reserved" }));
        for (let i = 0; i < photos.length; i++) {
          let record = await read(input.requestId);
          const state = await context(record);
          if (record.deleteRequested || state.deletionPending) return view(await phase(input.requestId, "deletion_pending", "deletion_requested"));
          await phase(input.requestId, "starting");
          const { ticket } = await adapters.activity.begin({ activityId: input.activityId, revision: state.revision, operationId: initial.beginIds[i], photoId: photos[i].photoId });
          if (!uuid.test(ticket)) throw new Error("Invalid server ticket");
          record = await change(input.requestId, current => ({ ...current, tickets: current.tickets.map((value, j) => j === i ? ticket : value), phase: "uploading" }));
          const before = await context(record);
          record = await read(input.requestId);
          if (record.deleteRequested || before.deletionPending) return view(await phase(input.requestId, "uncertain", "needs_confirmation"));
          // Commit intent once, using the exact version observed. Never replay this CAS
          // after contention: a different worker may already own the dispatch.
          if (input.signal?.aborted) return view(await phase(input.requestId, "uncertain", "needs_confirmation"));
          if (record.attempts[i]) throw new Error("Dispatch already recorded");
          const attempt: UploadAttempt = { dispatchId: randomUUID(), dispatch: "intent_recorded", response: "unknown", verification: "pending", endConfirmed: false };
          const intended = { ...record, revision: record.revision + 1, attempts: record.attempts.map((value, j) => j === i ? attempt : value) };
          if (!await adapters.journal.compareAndSwap(input.requestId, record.revision, intended)) throw new Error("Dispatch version conflict");
          // Recheck authority/deletion after the intent commit. Intent alone never proves IO.
          const dispatchContext = await context(intended);
          const dispatchRecord = await read(input.requestId);
          if (dispatchRecord.deleteRequested || dispatchContext.deletionPending || input.signal?.aborted)
            return view(await phase(input.requestId, "uncertain", "needs_confirmation"));
          const result = await waitForUpload(async () => {
            const invoked = { ...dispatchRecord, revision: dispatchRecord.revision + 1,
              attempts: dispatchRecord.attempts.map((value, j) => j === i && value ? { ...value, dispatch: "invoked" as const } : value) };
            if (!await adapters.journal.compareAndSwap(input.requestId, dispatchRecord.revision, invoked)) throw new Error("Dispatch version conflict");
            return adapters.storage.upload({ bucket: ACTIVITY_PHOTO_BUCKET, path: photos[i].path, bytes: files[i].bytes, mime: files[i].mime, upsert: false });
          }, input.signal);
          if (result === "unknown") return view(await phase(input.requestId, "uncertain", "needs_confirmation"));
          await authorize(initial.actorId);
          await change(input.requestId, current => ({ ...current, phase: current.deleteRequested ? "deletion_pending" : "verifying",
            attempts: current.attempts.map((value, j) => j === i && value ? { ...value, response: result } : value) }));
          const valid = result === "stored" ? await adapters.storage.verify({ bucket: ACTIVITY_PHOTO_BUCKET, photo: photos[i], bytes: files[i].bytes }) : false;
          await change(input.requestId, current => ({ ...current,
            attempts: current.attempts.map((value, j) => j === i && value ? { ...value, verification: valid ? "valid" : result === "stored" ? "invalid" : "pending" } : value) }));
          record = await read(input.requestId);
          const latest = await context(record); // Authorization/revision checked again, including after revocation/deletion.
          await phase(input.requestId, "ending");
          await adapters.activity.end({ activityId: input.activityId, revision: latest.revision, operationId: initial.endIds[i], photoId: photos[i].photoId, ticket, report: { dispatchId: attempt.dispatchId, response: result, verification: valid ? "valid" : result === "stored" ? "invalid" : "pending" } });
          await change(input.requestId, current => ({ ...current, attempts: current.attempts.map((value, j) => j === i && value ? { ...value, endConfirmed: true } : value) }));
          if (record.deleteRequested || latest.deletionPending) return view(await phase(input.requestId, "deletion_pending", "deletion_requested"));
          if (!valid) return view(await phase(input.requestId, "failed", result === "rejected" ? "storage_rejected" : "invalid_file"));
          await change(input.requestId, current => ({ ...current, completed: i + 1 }));
        }
        return view(await phase(input.requestId, "succeeded")); // Upload attempts only; NOT finalized or published.
      } catch {
        // Includes lost RPC responses, verification failures and revoked authority.
        // No raw errors are persisted/returned; no automatic end_upload or retry.
        try { return view(await phase(input.requestId, "uncertain", "needs_confirmation")); }
        catch { return { requestId: input.requestId, phase: "uncertain", issue: "needs_confirmation", needsReview: true }; }
      }
    },
    async inspect(requestId: string): Promise<UploadView> {
      const record = await read(requestId); await authorize(record.actorId);
      return view(record); // Recovery is observation, never a lease expiry or remote completion claim.
    },
    async noteDeletion(requestId: string): Promise<UploadView> {
      const record = await read(requestId); await authorize(record.actorId);
      return view(await change(requestId, current => ({ ...current, deleteRequested: true,
        phase: "deletion_pending", issue: "deletion_requested" })));
      // Journal signal only. Real SQL begin_delete belongs to a future deletion coordinator.
    },
  };
}
