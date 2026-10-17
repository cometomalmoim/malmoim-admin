import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActivityManager } from "./activity-manager";
import "./manage-preview.css";
export const metadata: Metadata = { title: "활동 사진 관리 UI 미리보기", robots: { index: false, follow: false } };
export default function ManagePreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <main id="public-main" className="activity-manager" tabIndex={-1}><ActivityManager /></main>;
}
