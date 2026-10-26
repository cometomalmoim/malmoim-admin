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

export type ReviewPermission = "anonymous" | "approved" | "unapproved" | "error";
export type ReviewAccess = { userId: string | null; permission: ReviewPermission };
export const reviewApprovalNotice = "말모임에 참여한 회원만 후기를 작성할 수 있어요";
export const reviewApprovalError = "후기 작성 권한을 확인하지 못했어요. 잠시 후 다시 확인해주세요.";
