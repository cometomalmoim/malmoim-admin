import "server-only";
import { getAdminAccess } from "./auth";
import { createClient } from "./supabase/server";

export const suggestionStatuses = ["received", "reviewing", "completed"] as const;
export type SuggestionStatus = typeof suggestionStatuses[number];
export type SuggestionFilter = "all" | SuggestionStatus;
export type SuggestionRow = {
  id: string;
  title: string;
  content: string;
  is_anonymous: boolean;
  public_name: string | null;
  status: SuggestionStatus;
  staff_feedback: string;
  resolution: string;
  created_at: string;
  updated_at: string;
  last_modified_by: string | null;
  last_modified_at: string | null;
};
export type SuggestionStats = { all: number; received: number; reviewing: number; completed: number };
export type SuggestionListResult = { kind: "ready"; rows: SuggestionRow[]; stats: SuggestionStats; page: number; pageSize: number; filter: SuggestionFilter; error: false } | { kind: "error"; error: true };
export type SuggestionDetailResult = { kind: "ready"; suggestion: SuggestionRow; error: false } | { kind: "missing"; error: false } | { kind: "error"; error: true };
const pageSize = 25;

function logSuggestionDbFailure(operation: string, error: unknown) {
  const candidate = typeof error === "object" && error !== null ? error as { code?: unknown; status?: unknown } : {};
  const code = typeof candidate.code === "string" && /^[a-zA-Z0-9_-]{1,32}$/.test(candidate.code) ? candidate.code : "unknown";
  const status = typeof candidate.status === "number" && Number.isInteger(candidate.status) ? candidate.status : undefined;
  console.error("[suggestions] database operation failed", { operation, code, status });
}

function safePage(value: number) { return Number.isSafeInteger(value) && value > 0 ? Math.min(value, 100000) : 1; }
function safeFilter(value?: string): SuggestionFilter { return suggestionStatuses.includes(value as SuggestionStatus) ? value as SuggestionStatus : "all"; }

export async function getSuggestions(filterValue?: string, pageValue = 1): Promise<SuggestionListResult> {
  if ((await getAdminAccess()).status !== "admin") return { kind: "error", error: true };
  try {
    const client = await createClient();
    const filter = safeFilter(filterValue);
    const page = safePage(pageValue);
    const count = (status?: SuggestionStatus) => {
      let query = client.from("suggestions").select("id", { count: "exact", head: true });
      if (status) query = query.eq("status", status);
      return query;
    };
    const [all, received, reviewing, completed, list] = await Promise.all([
      count(), count("received"), count("reviewing"), count("completed"),
      (filter === "all" ? client.from("suggestions").select("id,title,content,is_anonymous,public_name,status,staff_feedback,resolution,created_at,updated_at,last_modified_by,last_modified_at") : client.from("suggestions").select("id,title,content,is_anonymous,public_name,status,staff_feedback,resolution,created_at,updated_at,last_modified_by,last_modified_at").eq("status", filter))
        .order("created_at", { ascending: false }).order("id", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1),
    ]);
    if (all.error || received.error || reviewing.error || completed.error || list.error) {
      if (all.error) logSuggestionDbFailure("list.count_all", all.error);
      if (received.error) logSuggestionDbFailure("list.count_received", received.error);
      if (reviewing.error) logSuggestionDbFailure("list.count_reviewing", reviewing.error);
      if (completed.error) logSuggestionDbFailure("list.count_completed", completed.error);
      if (list.error) logSuggestionDbFailure("list.rows", list.error);
      return { kind: "error", error: true };
    }
    return { kind: "ready", error: false, rows: list.data as SuggestionRow[], page, pageSize, filter, stats: { all: all.count ?? 0, received: received.count ?? 0, reviewing: reviewing.count ?? 0, completed: completed.count ?? 0 } };
  } catch (error) { logSuggestionDbFailure("list.unexpected", error); return { kind: "error", error: true }; }
}

export async function getSuggestion(id: string): Promise<SuggestionDetailResult> {
  if ((await getAdminAccess()).status !== "admin") return { kind: "error", error: true };
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return { kind: "missing", error: false };
  try {
    const client = await createClient();
    const result = await client.from("suggestions").select("id,title,content,is_anonymous,public_name,status,staff_feedback,resolution,created_at,updated_at,last_modified_by,last_modified_at").eq("id", id).maybeSingle();
    if (result.error) { logSuggestionDbFailure("detail.read", result.error); return { kind: "error", error: true }; }
    if (!result.data) return { kind: "missing", error: false };
    return { kind: "ready", error: false, suggestion: result.data as SuggestionRow };
  } catch (error) { logSuggestionDbFailure("detail.unexpected", error); return { kind: "error", error: true }; }
}

function validText(value: string, min: number, max: number) { const normalized = value.trim(); return normalized.length >= min && normalized.length <= max ? normalized : null; }
export type SuggestionMutationResult = { ok: true; id: string } | { ok: false; reason: "forbidden" | "invalid" | "missing" | "complete_requires_resolution" | "error" };
async function adminClient() {
  if ((await getAdminAccess()).status !== "admin") return null;
  return createClient();
}

export async function createSuggestion(input: { title: string; content: string; mode: string; publicName: string }): Promise<SuggestionMutationResult> {
  try {
    const client = await adminClient();
    if (!client) return { ok: false, reason: "forbidden" };
    const title = validText(input.title, 1, 150);
    const content = validText(input.content, 1, 10000);
    const isAnonymous = input.mode === "anonymous";
    const publicName = isAnonymous ? null : validText(input.publicName, 1, 100);
    if (!title || !content || (!isAnonymous && !publicName) || !["anonymous", "named"].includes(input.mode)) return { ok: false, reason: "invalid" };
    const result = await client.from("suggestions").insert({ title, content, is_anonymous: isAnonymous, public_name: publicName }).select("id").single();
    if (result.error) { logSuggestionDbFailure("create", result.error); return { ok: false, reason: "error" }; }
    return { ok: true, id: result.data.id as string };
  } catch (error) { logSuggestionDbFailure("create.unexpected", error); return { ok: false, reason: "error" }; }
}

export async function updateSuggestionText(id: string, field: "staff_feedback" | "resolution", value: string): Promise<SuggestionMutationResult> {
  try {
    const client = await adminClient();
    if (!client) return { ok: false, reason: "forbidden" };
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return { ok: false, reason: "invalid" };
    const normalized = value.trim();
    if (normalized.length > 10000) return { ok: false, reason: "invalid" };
    const result = await client.from("suggestions").update({ [field]: normalized }).eq("id", id).select("id").maybeSingle();
    if (result.error) { logSuggestionDbFailure(`update.${field}`, result.error); return { ok: false, reason: "error" }; }
    if (!result.data) return { ok: false, reason: "missing" };
    return { ok: true, id };
  } catch (error) { logSuggestionDbFailure(`update.${field}.unexpected`, error); return { ok: false, reason: "error" }; }
}

export async function updateSuggestionDetails(id: string, input: { title: string; content: string }): Promise<SuggestionMutationResult> {
  try {
    const client = await adminClient();
    if (!client) return { ok: false, reason: "forbidden" };
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return { ok: false, reason: "invalid" };
    const title = validText(input.title, 1, 150);
    const content = validText(input.content, 1, 10000);
    if (!title || !content) return { ok: false, reason: "invalid" };
    const result = await client.from("suggestions").update({ title, content }).eq("id", id).select("id").maybeSingle();
    if (result.error) { logSuggestionDbFailure("update.details", result.error); return { ok: false, reason: "error" }; }
    if (!result.data) return { ok: false, reason: "missing" };
    return { ok: true, id };
  } catch (error) { logSuggestionDbFailure("update.details.unexpected", error); return { ok: false, reason: "error" }; }
}

export async function deleteSuggestion(id: string): Promise<SuggestionMutationResult> {
  try {
    const client = await adminClient();
    if (!client) return { ok: false, reason: "forbidden" };
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return { ok: false, reason: "invalid" };
    const result = await client.from("suggestions").delete().eq("id", id).select("id").maybeSingle();
    if (result.error) { logSuggestionDbFailure("delete", result.error); return { ok: false, reason: "error" }; }
    if (!result.data) return { ok: false, reason: "missing" };
    return { ok: true, id };
  } catch (error) { logSuggestionDbFailure("delete.unexpected", error); return { ok: false, reason: "error" }; }
}

export async function updateSuggestionStatus(id: string, statusValue: string): Promise<SuggestionMutationResult> {
  try {
    const client = await adminClient();
    if (!client) return { ok: false, reason: "forbidden" };
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) || !suggestionStatuses.includes(statusValue as SuggestionStatus)) return { ok: false, reason: "invalid" };
    if (statusValue === "completed") {
      const current = await client.from("suggestions").select("resolution").eq("id", id).maybeSingle();
      if (current.error) { logSuggestionDbFailure("status.read_resolution", current.error); return { ok: false, reason: "error" }; }
      if (!current.data) return { ok: false, reason: "missing" };
      if (!current.data.resolution?.trim()) return { ok: false, reason: "complete_requires_resolution" };
    }
    const result = await client.from("suggestions").update({ status: statusValue }).eq("id", id).select("id").maybeSingle();
    if (result.error) { logSuggestionDbFailure("status.update", result.error); return { ok: false, reason: "error" }; }
    if (!result.data) return { ok: false, reason: "missing" };
    return { ok: true, id };
  } catch (error) { logSuggestionDbFailure("status.unexpected", error); return { ok: false, reason: "error" }; }
}
