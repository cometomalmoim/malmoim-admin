import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ReviewPreview } from "./review-preview";
import "../history.css";

export const metadata: Metadata = { title: "후기 UI 개발용 미리보기", robots: { index: false, follow: false } };
export default function ReviewPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <main id="public-main" className="history-page" tabIndex={-1}><ReviewPreview /></main>;
}
