export const reviewCategories = { regular: "정규 세션", special: "특별 활동", other: "기타" } as const;
export type ReviewCategory = keyof typeof reviewCategories;
export type ReviewFilter = ReviewCategory | "all";
export type Review = {
  id: string; author_id: string; display_name: string; title: string;
  category: ReviewCategory; content: string; created_at: string; updated_at: string;
  // Preserve path indexes when an individual photo cannot be signed.
  photo_paths: string[]; photos: (string | null)[];
};
export type ReviewPage = { reviews: Review[]; more: boolean; error: string };
export type ReviewResult = { ok: boolean; message: string };
// Original selections stay in the browser; only processed files reach Storage.
export const ORIGINAL_PHOTO_LIMIT = 5 * 1024 * 1024;
export const PHOTO_LIMIT = 1024 * 1024;
export const PHOTO_MAX_EDGE = 1600;
export const MAX_PHOTOS = 3;
export function reviewDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}
