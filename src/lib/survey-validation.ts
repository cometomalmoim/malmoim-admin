export const surveyGroups = ["korean", "international"] as const;
export type SurveyGroup = typeof surveyGroups[number];

export const surveyAspectKeys = [
  "language_growth",
  "varied_activities",
  "comfortable_environment",
  "diverse_people",
  "atmosphere_and_organization",
  "mutual_learning",
  "none",
] as const;
export type SurveyAspect = typeof surveyAspectKeys[number];

export type SurveyResponseInput = {
  group: SurveyGroup;
  satisfaction: number;
  likedAspects: SurveyAspect[];
  studyFeedback: string;
  activityFeedback: string;
  otherFeedback: string;
};

function text(value: FormDataEntryValue | null, max: number): string {
  if (typeof value !== "string") throw new Error("invalid");
  const normalized = value.trim();
  if (normalized.length > max) throw new Error("invalid");
  return normalized;
}

export function surveyResponseInput(data: FormData): SurveyResponseInput {
  const groupValue = data.get("group");
  const satisfactionValue = data.get("satisfaction");
  const likedValues = data.getAll("liked_aspects");
  if (typeof groupValue !== "string" || !surveyGroups.includes(groupValue as SurveyGroup)) throw new Error("invalid");
  if (typeof satisfactionValue !== "string" || !/^[1-5]$/.test(satisfactionValue)) throw new Error("invalid");
  if (likedValues.length < 1 || likedValues.length > surveyAspectKeys.length || likedValues.some(value => typeof value !== "string" || !surveyAspectKeys.includes(value as SurveyAspect))) throw new Error("invalid");
  const likedAspects = likedValues as SurveyAspect[];
  if (new Set(likedAspects).size !== likedAspects.length || (likedAspects.includes("none") && likedAspects.length !== 1)) throw new Error("invalid");
  return {
    group: groupValue as SurveyGroup,
    satisfaction: Number(satisfactionValue),
    likedAspects,
    studyFeedback: text(data.get("study_feedback"), 3000),
    activityFeedback: text(data.get("activity_feedback"), 3000),
    otherFeedback: text(data.get("other_feedback"), 3000),
  };
}

export function surveyPeriod(openValue: string, closeValue: string): { opensAt: string; closesAt: string } {
  const parseKst = (value: string) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
    if (!match) return null;
    const [, year, month, day, hour, minute] = match;
    const parts = [year, month, day, hour, minute].map(Number);
    const local = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], parts[3], parts[4]));
    if (local.getUTCFullYear() !== parts[0] || local.getUTCMonth() !== parts[1] - 1 || local.getUTCDate() !== parts[2] || local.getUTCHours() !== parts[3] || local.getUTCMinutes() !== parts[4]) return null;
    return new Date(local.getTime() - 9 * 60 * 60 * 1000);
  };
  const opensAtDate = parseKst(openValue);
  const closesAtDate = parseKst(closeValue);
  if (!opensAtDate || !closesAtDate || closesAtDate <= opensAtDate) throw new Error("invalid");
  return { opensAt: opensAtDate.toISOString(), closesAt: closesAtDate.toISOString() };
}

export function koreaDateTimeLocal(value: string): string {
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const part = (type: string) => parts.find(item => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}
