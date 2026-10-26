import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { logReviewFailure } from "./review-diagnostics";
import type { ReviewAccess, ReviewPermission } from "./review-types";

/** No caller-supplied identity and no participant records leave this module. */
export async function checkReviewApproval(db: Pick<SupabaseClient, "rpc">): Promise<Exclude<ReviewPermission, "anonymous">> {
  try {
    const { data, error } = await db.rpc("history_can_create_review");
    if (error || typeof data !== "boolean") {
      logReviewFailure("eligibility", error);
      return "error";
    }
    return data ? "approved" : "unapproved";
  } catch { return "error"; }
}

export async function getReviewAccess(): Promise<ReviewAccess> {
  try {
    const db = await createClient();
    const { data: { user }, error } = await db.auth.getUser();
    if (error && error.name !== "AuthSessionMissingError") return { userId: null, permission: "error" };
    if (!user) return { userId: null, permission: "anonymous" };
    if (error) return { userId: null, permission: "error" };
    return { userId: user.id, permission: await checkReviewApproval(db) };
  } catch { return { userId: null, permission: "error" }; }
}
