import "server-only";
import { createClient } from "@/lib/supabase/server";
import { logReviewFailure } from "./review-diagnostics";
import type { Review, ReviewFilter, ReviewPage } from "./review-types";
export const REVIEW_BUCKET = "history-review-photos";
export async function readReviews(filter: ReviewFilter = "all", offset = 0): Promise<ReviewPage> {
  try {
    const db = await createClient();
    let query = db.from("history_reviews").select("id,author_id,display_name,title,category,content,created_at,updated_at,photo_paths").order("created_at", { ascending: false }).order("id", { ascending: false }).range(offset, offset + 6);
    if (filter !== "all") query = query.eq("category", filter);
    const { data, error } = await query;
    if (error) throw error;
    const reviews = await Promise.all((data ?? []).slice(0, 6).map(async (row) => {
      const paths = row.photo_paths as string[];
      if (!paths.length) return { ...row, photos: [] } as Review;
      const photos: Review["photos"] = paths.map(() => null);
      try {
        const signed = await db.storage.from(REVIEW_BUCKET).createSignedUrls(paths, 3600);
        if (!signed.error) paths.forEach((path, index) => {
          const photo = signed.data?.find((item) => item.path === path);
          if (!photo?.error && photo?.signedUrl) photos[index] = photo.signedUrl;
        });
      } catch { /* Keep the review text available when Storage is unavailable. */ }
      return { ...row, photos } as Review;
    }));
    return { reviews, more: (data?.length ?? 0) > 6, error: "" };
  } catch (error) {
    logReviewFailure("list", error);
    return { reviews: [], more: false, error: "후기 저장소에 연결하지 못했어요. 잠시 후 다시 불러와 주세요. 문제가 계속되면 운영팀에 알려주세요." };
  }
}
export async function reviewUser() {
  try {
    const db = await createClient();
    const { data: { user }, error } = await db.auth.getUser();
    return error ? null : user?.id ?? null;
  } catch { return null; }
}
