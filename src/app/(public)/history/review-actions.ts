"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { readReviews, REVIEW_BUCKET } from "./review-store";
import { MAX_PHOTOS, PHOTO_LIMIT, reviewCategories, type ReviewFilter, type ReviewResult } from "./review-types";
import { reviewPhotoExtension } from "./review-photo-format";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function loadReviews(filter: ReviewFilter, offset: number) {
  if (!(filter === "all" || Object.hasOwn(reviewCategories, filter)) || !Number.isSafeInteger(offset) || offset < 0) return { reviews: [], more: false, error: "잘못된 조회 요청입니다." };
  return readReviews(filter, offset);
}
export async function saveReview(form: FormData): Promise<ReviewResult> {
  const title = String(form.get("title") ?? "").trim();
  const content = String(form.get("content") ?? "").trim();
  const category = String(form.get("category") ?? "");
  const existingId = String(form.get("id") ?? "");
  if (!title || title.length > 120 || !content || content.length > 10000 || !Object.hasOwn(reviewCategories, category) || (existingId && !uuid.test(existingId))) return { ok: false, message: "제목(120자 이내), 카테고리, 내용(10,000자 이내)을 확인해주세요." };
  const attachments = form.getAll("photos");
  if (attachments.length > MAX_PHOTOS || attachments.some((file) => !(file instanceof File) || !file.size || file.size > PHOTO_LIMIT)) return { ok: false, message: "사진은 최대 3장, 자동 처리 후 장당 1MB 이하로 첨부해주세요. 빈 파일은 첨부할 수 없어요." };
  const files = attachments as File[];
  try {
    const db = await createClient();
    const { data: { user }, error: authError } = await db.auth.getUser();
    if (authError || !user) return { ok: false, message: "로그인이 필요해요. 로그인한 뒤 다시 시도해주세요." };
    let previous: string[] = [];
    if (existingId) {
      const { data, error } = await db.from("history_reviews").select("photo_paths").eq("id", existingId).eq("author_id", user.id).single();
      if (error || !data) return { ok: false, message: "본인의 후기만 수정할 수 있습니다. 삭제 여부도 확인해주세요." };
      previous = data.photo_paths;
    }
    const removed = form.getAll("removePhoto").map(String);
    const kept = previous.filter((p) => !removed.includes(p));
    if (kept.length + files.length > MAX_PHOTOS) return { ok: false, message: "기존 사진을 포함해 최대 3장까지 등록할 수 있습니다." };
    const validated = await Promise.all(files.map(async (file) => {
      const bytes = new Uint8Array(await file.arrayBuffer());
      return { file, extension: reviewPhotoExtension(bytes, file.type) };
    }));
    if (validated.some((f) => !f.extension)) return { ok: false, message: "실제 JPG, PNG, WebP 사진만 첨부할 수 있습니다." };
    const id = existingId || crypto.randomUUID();
    const uploaded: string[] = [];
    try {
      for (const { file, extension } of validated) {
        const path = `${user.id}/${id}/${crypto.randomUUID()}.${extension}`;
        const { error } = await db.storage.from(REVIEW_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
        if (error) throw error;
        uploaded.push(path);
      }
      const values = { title, content, category, photo_paths: [...kept, ...uploaded] };
      const result = existingId
        ? await db.from("history_reviews").update(values).eq("id", id).eq("author_id", user.id).select("id").single()
        : await db.from("history_reviews").insert({ ...values, id, author_id: user.id, display_name: typeof user.user_metadata?.display_name === "string" ? user.user_metadata.display_name.trim().slice(0, 60) || "익명" : "익명" }).select("id").single();
      if (result.error || !result.data) throw result.error ?? new Error("Save failed");
    } catch {
      if (uploaded.length) await db.storage.from(REVIEW_BUCKET).remove(uploaded);
      return { ok: false, message: "저장을 완료하지 못했어요. 입력 내용은 유지됩니다. 잠시 후 다시 시도해주세요. 문제가 계속되면 운영팀에 알려주세요." };
    }
    const discarded = previous.filter((p) => !kept.includes(p));
    const cleanup = discarded.length ? await db.storage.from(REVIEW_BUCKET).remove(discarded) : null;
    revalidatePath("/history");
    return { ok: true, message: cleanup?.error ? "후기를 저장했습니다. 제외한 사진 파일 정리는 관리자 확인이 필요합니다." : "후기를 저장했습니다." };
  } catch { return { ok: false, message: "저장 중 연결 오류가 발생했습니다. 목록에서 저장 여부를 확인한 후 다시 시도해주세요." }; }
}
export async function deleteReview(id: string): Promise<ReviewResult> {
  if (!uuid.test(id)) return { ok: false, message: "잘못된 후기입니다." };
  try {
    const db = await createClient();
    const { data: { user }, error: authError } = await db.auth.getUser();
    if (authError || !user) return { ok: false, message: "로그인이 필요해요. 로그인한 뒤 다시 시도해주세요." };
    const { data, error } = await db.from("history_reviews").delete().eq("id", id).eq("author_id", user.id).select("photo_paths").single();
    if (error || !data) return { ok: false, message: "후기를 삭제하지 못했어요. 본인이 작성한 글인지 확인하고 다시 시도해주세요." };
    const cleanup = data.photo_paths.length ? await db.storage.from(REVIEW_BUCKET).remove(data.photo_paths) : null;
    revalidatePath("/history");
    return { ok: true, message: cleanup?.error ? "후기를 삭제했습니다. 사진 파일 정리는 관리자 확인이 필요합니다." : "후기를 삭제했습니다." };
  } catch { return { ok: false, message: "삭제 중 연결 오류가 발생했습니다. 목록에서 삭제 여부를 확인해주세요." }; }
}
