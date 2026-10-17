import "server-only";
import { getAdminAccess } from "./auth";
import { createClient } from "./supabase/server";
import { createPublicClient } from "./supabase/public";
import { surveyAspectKeys, type SurveyAspect, type SurveyGroup, type SurveyResponseInput } from "./survey-validation";

export type SurveyStatus = "draft" | "open" | "closed";
export type SurveyRecord = { id: string; cohort_name: string; public_token: string; status: SurveyStatus; opens_at: string; closes_at: string; questionnaire_version: "v1"; created_at: string; updated_at: string };
export type SurveyResponse = { id: string; survey_id: string; respondent_group: SurveyGroup; satisfaction: number; liked_aspects: SurveyAspect[]; study_feedback: string; activity_feedback: string; other_feedback: string; submitted_at: string };
export type SurveyGroupStats = { count: number; average: number | null; aspects: Record<SurveyAspect, number> };
export type SurveyStats = { total: number; average: number | null; korean: SurveyGroupStats; international: SurveyGroupStats };
export type SurveyDashboard = { kind: "ready"; surveys: (SurveyRecord & { response_count: number })[]; selected: SurveyRecord | null; stats: SurveyStats | null; responses: SurveyResponse[]; responseCount: number; page: number; pageSize: number; group: "all" | SurveyGroup } | { kind: "error" };

const responseFields = "id,survey_id,respondent_group,satisfaction,liked_aspects,study_feedback,activity_feedback,other_feedback,submitted_at";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN = /^[0-9a-f]{64}$/;
const pageSize = 50;
const emptyAspects = () => Object.fromEntries(surveyAspectKeys.map(key => [key, 0])) as Record<SurveyAspect, number>;
function safePage(value: number) { return Number.isSafeInteger(value) && value > 0 ? Math.min(value, 100000) : 1; }
function isGroup(value?: string): value is SurveyGroup { return value === "korean" || value === "international"; }

export async function getSurveyDashboard(selectedId?: string, groupValue?: string, pageValue = 1): Promise<SurveyDashboard> {
  if ((await getAdminAccess()).status !== "admin") return { kind: "error" };
  try {
    const client = await createClient();
    const surveyResult = await client.from("participant_surveys").select("id,cohort_name,public_token,status,opens_at,closes_at,questionnaire_version,created_at,updated_at").order("created_at", { ascending: false });
    if (surveyResult.error) return { kind: "error" };
    const surveys = (surveyResult.data ?? []) as SurveyRecord[];
    const counts = await Promise.all(surveys.map(async survey => {
      const result = await client.from("participant_survey_responses").select("id", { count: "exact", head: true }).eq("survey_id", survey.id);
      if (result.error) throw result.error;
      return { ...survey, response_count: result.count ?? 0 };
    }));
    const selected = surveys.find(survey => survey.id === selectedId) ?? surveys[0] ?? null;
    if (!selected) return { kind: "ready", surveys: counts, selected: null, stats: null, responses: [], responseCount: 0, page: 1, pageSize, group: isGroup(groupValue) ? groupValue : "all" };
    const statsResult = await client.rpc("admin_participant_survey_stats", { p_survey_id: selected.id });
    if (statsResult.error || !statsResult.data) return { kind: "error" };
    const rawStats = statsResult.data as { total: number; average: number | null; korean: { count: number; average: number | null; aspects: Partial<Record<SurveyAspect, number>> }; international: { count: number; average: number | null; aspects: Partial<Record<SurveyAspect, number>> } };
    const stats: SurveyStats = {
      total: Number(rawStats.total), average: rawStats.average === null ? null : Number(rawStats.average),
      korean: { count: Number(rawStats.korean.count), average: rawStats.korean.average === null ? null : Number(rawStats.korean.average), aspects: { ...emptyAspects(), ...rawStats.korean.aspects } },
      international: { count: Number(rawStats.international.count), average: rawStats.international.average === null ? null : Number(rawStats.international.average), aspects: { ...emptyAspects(), ...rawStats.international.aspects } },
    };
    const page = safePage(pageValue);
    let responseQuery = client.from("participant_survey_responses").select(responseFields, { count: "exact" }).eq("survey_id", selected.id);
    const group = isGroup(groupValue) ? groupValue : "all";
    if (group !== "all") responseQuery = responseQuery.eq("respondent_group", group);
    const responseResult = await responseQuery.order("submitted_at", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
    if (responseResult.error) return { kind: "error" };
    return { kind: "ready", surveys: counts, selected, stats, responses: (responseResult.data ?? []) as SurveyResponse[], responseCount: responseResult.count ?? 0, page, pageSize, group };
  } catch { return { kind: "error" }; }
}

export async function getPublicSurveyState(token: string): Promise<{ exists: boolean; state: "open" | "not_open" | "closed" }> {
  if (!TOKEN.test(token)) return { exists: false, state: "closed" };
  try {
    const client = createPublicClient();
    const result = await client.rpc("participant_survey_public_state", { p_token: token });
    if (result.error || !result.data || typeof result.data !== "object") return { exists: false, state: "closed" };
    const value = result.data as { exists?: unknown; state?: unknown };
    const state = value.state === "open" || value.state === "not_open" || value.state === "closed" ? value.state : "closed";
    return { exists: value.exists === true, state };
  } catch { return { exists: false, state: "closed" }; }
}

export type SurveySaveResult = { ok: true } | { ok: false; reason: "forbidden" | "invalid" | "duplicate_cohort" | "error" };

export async function createSurvey(input: { cohortName: string; token: string; opensAt: string; closesAt: string }): Promise<SurveySaveResult> {
  if ((await getAdminAccess()).status !== "admin") return { ok: false, reason: "forbidden" };
  const cohortName = input.cohortName.trim();
  if (cohortName.length < 1 || cohortName.length > 80 || !TOKEN.test(input.token) || !Number.isFinite(Date.parse(input.opensAt)) || !Number.isFinite(Date.parse(input.closesAt)) || Date.parse(input.closesAt) <= Date.parse(input.opensAt)) return { ok: false, reason: "invalid" };
  try {
    const client = await createClient();
    const result = await client.from("participant_surveys").insert({ cohort_name: cohortName, public_token: input.token, status: "draft", opens_at: input.opensAt, closes_at: input.closesAt, questionnaire_version: "v1" });
    if (result.error) return { ok: false, reason: result.error.code === "23505" ? "duplicate_cohort" : "error" };
    return { ok: true };
  } catch { return { ok: false, reason: "error" }; }
}

export async function updateSurvey(id: string, status: string, opensAt: string, closesAt: string): Promise<SurveySaveResult> {
  if ((await getAdminAccess()).status !== "admin") return { ok: false, reason: "forbidden" };
  if (!UUID.test(id) || !["draft", "open", "closed"].includes(status) || !Number.isFinite(Date.parse(opensAt)) || !Number.isFinite(Date.parse(closesAt)) || Date.parse(closesAt) <= Date.parse(opensAt)) return { ok: false, reason: "invalid" };
  try {
    const client = await createClient();
    const result = await client.from("participant_surveys").update({ status, opens_at: opensAt, closes_at: closesAt }).eq("id", id).select("id").maybeSingle();
    if (result.error) return { ok: false, reason: "error" };
    return result.data ? { ok: true } : { ok: false, reason: "error" };
  } catch { return { ok: false, reason: "error" }; }
}

export type SurveyDeleteResult = { ok: true } | { ok: false; reason: "forbidden" | "invalid" | "error" };

export async function deleteSurvey(id: string): Promise<SurveyDeleteResult> {
  if ((await getAdminAccess()).status !== "admin") return { ok: false, reason: "forbidden" };
  if (!UUID.test(id)) return { ok: false, reason: "invalid" };
  try {
    const client = await createClient();
    const result = await client.rpc("delete_participant_survey", { p_survey_id: id });
    if (result.error || result.data !== "deleted") return { ok: false, reason: "error" };
    return { ok: true };
  } catch { return { ok: false, reason: "error" }; }
}

export async function submitSurveyResponse(token: string, input: SurveyResponseInput): Promise<"saved" | "closed" | "invalid" | "busy" | "error"> {
  if (!TOKEN.test(token)) return "closed";
  try {
    const client = createPublicClient();
    const result = await client.rpc("submit_participant_survey", {
      p_token: token, p_group: input.group, p_satisfaction: input.satisfaction, p_liked_aspects: input.likedAspects,
      p_study_feedback: input.studyFeedback, p_activity_feedback: input.activityFeedback, p_other_feedback: input.otherFeedback,
    });
    if (result.error) return "error";
    if (result.data === "saved" || result.data === "closed" || result.data === "invalid" || result.data === "busy") return result.data;
    return "error";
  } catch { return "error"; }
}
