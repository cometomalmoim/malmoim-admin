import "server-only";
import { createClient } from "./supabase/server";

export type Access =
  | { status: "anonymous" }
  | { status: "denied" | "error" }
  | { status: "admin"; email: string };

// No shared cache: verify the user and allow-list on every access.
export async function getAdminAccess(): Promise<Access> {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return { status: "anonymous" };
    const result = await supabase.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
    if (result.error) return { status: "error" };
    if (!result.data) return { status: "denied" };
    return { status: "admin", email: user.email ?? "이메일 없음" };
  } catch { return { status: "error" }; }
}
