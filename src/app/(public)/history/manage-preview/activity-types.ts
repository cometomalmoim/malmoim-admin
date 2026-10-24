import type { HistoryPhoto } from "../history-data";
import { activityPhotoPolicy } from "@/lib/history-activities/photo-policy";
export { activityPhotoPolicy };
export const cohorts = [9, 8, 7, 6, 5, 4, 3, 2, 1] as const;
export const years = [2026, 2025] as const;
export type ActivityAsset = { id: string; url: string; name: string; alt: string; size: number };
export type Activity = {
  id: string; title: string; date: string; description: string;
  cover: ActivityAsset; additional: ActivityAsset[];
} & ({ category: "regular"; cohort: number } | { category: "special"; year: number });
export type ActivityFields = { category: "" | "regular" | "special"; cohort: string; year: string; title: string; date: string; description: string };
export function initialFields(activity?: Activity): ActivityFields {
  return { category: activity?.category ?? "", cohort: activity?.category === "regular" ? String(activity.cohort) : "", year: activity?.category === "special" ? String(activity.year) : "", title: activity?.title ?? "", date: activity?.date ?? "", description: activity?.description ?? "" };
}
// Future display adapter only. This preview never sends these objects to the public gallery.
// Replace local blob URLs with approved, durable photo URLs when integrating real data.
export function toHistoryPhoto(activity: Activity): HistoryPhoto {
  const base = { id: activity.id, title: activity.title, date: activity.date, description: activity.description, src: activity.cover.url, alt: activity.cover.alt, additionalPhotos: activity.additional.map((asset) => ({ src: asset.url, alt: asset.alt })) };
  return activity.category === "regular" ? { ...base, category: "regular", cohort: activity.cohort } : { ...base, category: "special" };
}
export function validateFields(fields: ActivityFields) {
  const errors: Record<string, string> = {};
  if (!fields.category) errors.category = "카테고리를 선택해주세요.";
  if (fields.category === "regular" && !cohorts.some((n) => String(n) === fields.cohort)) errors.cohort = "기수를 선택해주세요.";
  if (fields.category === "special" && !years.some((n) => String(n) === fields.year)) errors.year = "연도를 선택해주세요.";
  if (!fields.title.trim() || fields.title.length > 120) errors.title = "활동 제목을 120자 이내로 입력해주세요. 공백만 입력할 수 없어요.";
  if (!fields.description.trim() || fields.description.length > 2000) errors.description = "활동 설명을 2,000자 이내로 입력해주세요. 공백만 입력할 수 없어요.";
  const date = new Date(`${fields.date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fields.date) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== fields.date) errors.date = "올바른 활동 날짜를 입력해주세요.";
  else if (fields.category === "special" && fields.year && fields.date.slice(0, 4) !== fields.year) errors.date = "활동 날짜를 선택한 연도와 맞춰주세요.";
  return errors;
}
export function validatePhotoSelection(count: number, bytes: number) {
  if (count > activityPhotoPolicy.maxFiles) return "대표 사진은 1장, 추가 사진은 최대 9장(전체 10장)까지 선택해주세요.";
  if (bytes > activityPhotoPolicy.totalBytes) return "사진 전체 용량은 45MB 이하로 선택해주세요.";
  return "";
}
export async function validatePhotoFiles(files: File[]) {
  for (const file of files) {
    if (!file.size || file.size > activityPhotoPolicy.maxBytes) return "사진은 장당 4.5MB 이하로 선택해주세요. 빈 파일은 사용할 수 없어요.";
    const b = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const match = file.type === "image/jpeg" && b[0] === 255 && b[1] === 216 && b[2] === 255
      || file.type === "image/png" && [137,80,78,71,13,10,26,10].every((n, i) => b[i] === n)
      || file.type === "image/webp" && String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP";
    if (!match) return "실제 JPG·PNG·WebP 사진만 선택할 수 있어요.";
    try { const bitmap = await createImageBitmap(file); bitmap.close(); }
    catch { return "사진을 읽을 수 없어요. 손상되지 않은 JPG·PNG·WebP 파일을 선택해주세요."; }
  }
  return "";
}
