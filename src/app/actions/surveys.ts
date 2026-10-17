"use server";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminAccess } from "@/lib/auth";
import { createSurvey, updateSurvey, submitSurveyResponse, deleteSurvey } from "@/lib/surveys";
import { surveyPeriod, surveyResponseInput } from "@/lib/survey-validation";

export type SurveyActionState = { message: string; ok: boolean };
export async function createSurveyAction(_previous: SurveyActionState, data: FormData): Promise<SurveyActionState> {
  if ((await getAdminAccess()).status !== "admin") return { ok: false, message: "관리자 권한을 확인해주세요." };
  const cohortValue = data.get("cohort_name");
  if (typeof cohortValue !== "string") return { ok: false, message: "기수 이름을 확인해주세요." };
  try {
    const opensAtValue = String(data.get("opens_at") ?? "");
    const closesAtValue = String(data.get("closes_at") ?? "");
    const period = surveyPeriod(opensAtValue, closesAtValue);
    const result = await createSurvey({ cohortName: cohortValue, token: randomBytes(32).toString("hex"), ...period });
    if (!result.ok) return { ok: false, message: result.reason === "duplicate_cohort" ? "이미 설문이 등록된 기수입니다." : result.reason === "invalid" ? "기수와 공개 기간을 확인해주세요." : "설문을 등록하지 못했습니다." };
    revalidatePath("/admin/surveys");
    return { ok: true, message: "기수 설문과 공유 링크를 만들었습니다." };
  } catch { return { ok: false, message: "공개 시작·종료 시각을 확인해주세요." }; }
}

export async function updateSurveyAction(_previous: SurveyActionState, data: FormData): Promise<SurveyActionState> {
  if ((await getAdminAccess()).status !== "admin") return { ok: false, message: "관리자 권한을 확인해주세요." };
  const id = String(data.get("id") ?? "");
  const status = String(data.get("status") ?? "");
  try {
    const period = surveyPeriod(String(data.get("opens_at") ?? ""), String(data.get("closes_at") ?? ""));
    const result = await updateSurvey(id, status, period.opensAt, period.closesAt);
    if (!result.ok) return { ok: false, message: "설문 설정을 저장하지 못했습니다. 입력값과 권한을 확인해주세요." };
    revalidatePath("/admin/surveys");
    return { ok: true, message: "설문 공개 상태와 기간을 저장했습니다." };
  } catch { return { ok: false, message: "공개 시작·종료 시각을 확인해주세요." }; }
}

export async function deleteSurveyAction(_previous: SurveyActionState, data: FormData): Promise<SurveyActionState> {
  if ((await getAdminAccess()).status !== "admin") return { ok: false, message: "관리자 권한을 확인해주세요." };
  const id = String(data.get("id") ?? "");
  const result = await deleteSurvey(id);
  if (!result.ok) return { ok: false, message: result.reason === "forbidden" ? "관리자 권한을 확인해주세요." : "설문을 삭제하지 못했습니다. DB 마이그레이션 적용 여부를 확인해주세요." };
  revalidatePath("/admin/surveys");
  redirect("/admin/surveys");
}

export async function submitSurveyResponseAction(token: string, _previous: SurveyActionState, data: FormData): Promise<SurveyActionState> {
  let input;
  try { input = surveyResponseInput(data); } catch { return { ok: false, message: data.get("group") === "international" ? "Please check the required questions and choices." : "필수 응답과 선택 항목을 확인해주세요." }; }
  const result = await submitSurveyResponse(token, input);
  if (result === "saved") return { ok: true, message: input.group === "korean" ? "응답을 제출했습니다. 참여해주셔서 감사합니다." : "Your response has been submitted. Thank you for taking part." };
  if (result === "closed") return { ok: false, message: input.group === "korean" ? "이 설문은 종료되었습니다." : "This survey is closed." };
  if (result === "busy") return { ok: false, message: input.group === "korean" ? "응답이 많아 잠시 후 다시 시도해주세요." : "There are many responses right now. Please try again shortly." };
  if (result === "invalid") return { ok: false, message: input.group === "korean" ? "응답 내용을 확인해주세요." : "Please check your answers." };
  return { ok: false, message: input.group === "korean" ? "응답을 저장하지 못했습니다. 잠시 후 다시 시도해주세요." : "We could not save your response. Please try again." };
}
