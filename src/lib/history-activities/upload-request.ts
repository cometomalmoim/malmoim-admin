import { activityPhotoPolicy, activityUploadBodyBytes } from "./photo-policy";
import "server-only";
import type { Access } from "../auth";
import type { UploadAdapters } from "./upload-coordinator";
import type { RecoverableUploadJournal } from "./upload-journal";
import type { CompletionAdapters } from "./upload-evidence";

/** Future composition boundary only; no implementation, activation flag or injected
 * uploader is accepted by this disabled endpoint. These must all be reviewed first. */
export interface FutureActivityUploadServices {
  coordinator: UploadAdapters;
  journal: RecoverableUploadJournal;
  completion: CompletionAdapters;
}
const MAX_FILE = activityPhotoPolicy.maxBytes;
const MAX_BODY = activityUploadBodyBytes;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const reply = (code: string, message: string, status: number) => Response.json({ code, message }, {
  status, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
});
/** multipart/form-data: exactly request_id, activity_id, file; one JPEG/PNG/WebP.
 * IDs are untrusted requested identities, never permission, ticket or proof.
 * Aggregate 10-photo/45MiB capacity and actual image decoding remain UNVERIFIED.
 * Body read is bounded independently of Content-Length. No journal/storage IO. */
export function createDisabledActivityUploadHandler(authorize: () => Promise<Access>) {
  return async (request: Request): Promise<Response> => {
    try {
      if (request.headers.get("origin") !== new URL(request.url).origin)
        return reply("INVALID_ORIGIN", "요청 출처를 확인해주세요.", 403);
      const access = await authorize();
      if (access.status === "anonymous") return reply("LOGIN_REQUIRED", "로그인이 필요합니다.", 401);
      if (access.status === "error") return reply("AUTH_UNAVAILABLE", "관리자 권한을 확인할 수 없습니다.", 503);
      if (access.status !== "admin") return reply("ADMIN_REQUIRED", "관리자 권한이 필요합니다.", 403);
      const contentType = request.headers.get("content-type") ?? "";
      if (!/^multipart\/form-data\s*;/i.test(contentType)) return reply("INVALID_REQUEST", "사진 한 장을 선택해주세요.", 400);
      const length = request.headers.get("content-length");
      if (length !== null && (!/^\d+$/.test(length) || !Number.isSafeInteger(Number(length))))
        return reply("INVALID_REQUEST", "요청 형식을 확인해주세요.", 400);
      if (length !== null && Number(length) > MAX_BODY) return reply("BODY_TOO_LARGE", "현재 전송 경로의 요청 용량을 초과했습니다. 업로드는 아직 지원되지 않습니다.", 413);
      if (!request.body) return reply("INVALID_REQUEST", "사진 한 장을 선택해주세요.", 400);
      const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let total = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read(); if (done) break;
          total += value.byteLength;
          if (total > MAX_BODY) { await reader.cancel(); return reply("BODY_TOO_LARGE", "현재 전송 경로의 요청 용량을 초과했습니다. 업로드는 아직 지원되지 않습니다.", 413); }
          chunks.push(value);
        }
      } finally { reader.releaseLock(); }
      const bytes = new Uint8Array(total); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      let form: FormData;
      try { form = await new Response(bytes, { headers: { "Content-Type": contentType } }).formData(); }
      catch { return reply("INVALID_REQUEST", "요청 형식을 확인해주세요.", 400); }
      const keys = [...form.keys()];
      if (keys.length !== 3 || !["request_id", "activity_id", "file"].every(key => form.getAll(key).length === 1) ||
        keys.some(key => !["request_id", "activity_id", "file"].includes(key)))
        return reply("INVALID_REQUEST", "허용되지 않은 요청 항목입니다.", 400);
      if (![form.get("request_id"), form.get("activity_id")].every(value => typeof value === "string" && uuid.test(value)))
        return reply("INVALID_REQUEST", "활동과 요청 정보를 확인해주세요.", 400);
      const file = form.get("file");
      if (!(file instanceof File) || file.size < 1) return reply("INVALID_FILE", "사진 한 장을 선택해주세요.", 400);
      if (file.size > MAX_FILE) return reply("TOO_LARGE", "사진은 최대 4.5MB까지 선택할 수 있습니다.", 413);
      if (!activityPhotoPolicy.mimeTypes.some(mime => mime === file.type)) return reply("INVALID_FILE", "JPG·PNG·WebP 사진만 선택할 수 있습니다.", 400);
      // MIME is merely request validation, NOT actual file/content verification.
      return reply("UPLOAD_DISABLED", "활동 사진 업로드는 아직 준비 중입니다. 파일은 저장되지 않았습니다.", 503);
    } catch { return reply("REQUEST_UNAVAILABLE", "요청을 처리할 수 없습니다. 잠시 후 다시 시도해주세요.", 503); }
  };
}
