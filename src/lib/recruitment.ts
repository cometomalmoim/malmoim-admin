import "server-only";
import { getAdminAccess } from "./auth";
import { createClient } from "./supabase/server";
export type RecruitmentEvent = { id: string; slug: string; title: string; status: string; applications_open: boolean; closes_at: string };
export type ApplicationRow = { id: string; name: string; contact: string; contact_type: string; preferred_class: string; status: string; created_at: string };
export type RecruitmentResult =
  | { kind: "error" }
  | { kind: "missing" }
  | { kind: "ready"; events: RecruitmentEvent[]; event?: RecruitmentEvent; rows: ApplicationRow[]; count: number; page: number };
export async function getRecruitment(slug?: string, page = 1): Promise<RecruitmentResult> {
  // Recheck inside the data access boundary, not only the page or layout.
  if ((await getAdminAccess()).status !== "admin") return { kind: "error" };
  try {
    const client = await createClient();
    const eventsResult = await client.from("recruitment_events").select("id,slug,title,status,applications_open,closes_at").order("created_at", { ascending: false });
    if (eventsResult.error) return { kind: "error" };
    const events = eventsResult.data as RecruitmentEvent[];
    if (!slug) return { kind: "ready", events, rows: [], count: 0, page: 1 };
    const event = events.find(e => e.slug === slug);
    if (!event) return { kind: "missing" };
    const safePage = Number.isSafeInteger(page) && page > 0 ? Math.min(page, 100000) : 1;
    const result = await client.from("event_applications").select("id,name,contact,contact_type,preferred_class,status,created_at", { count: "exact" }).eq("event_id", event.id).order("created_at", { ascending: false }).order("id", { ascending: false }).range((safePage - 1) * 25, safePage * 25 - 1);
    if (result.error) return { kind: "error" };
    return { kind: "ready", events, event, rows: result.data as ApplicationRow[], count: result.count ?? 0, page: safePage };
  } catch { return { kind: "error" }; }
}
