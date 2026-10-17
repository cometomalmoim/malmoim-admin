import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HistoryGallery } from "../history-content";
import type { HistoryPhoto } from "../history-data";
import "../history.css";
export const metadata: Metadata = { title: "사진 상세 갤러리 UI 미리보기", robots: { index: false, follow: false } };
const photos: HistoryPhoto[] = [
  { id: "gallery-demo-regular", category: "regular", cohort: 9, title: "[데모] 여러 사진 상세 보기", date: "2026-01-01", description: "[데모] 실제 활동·기수·날짜가 아닌 UI 예시입니다. 사진 자리는 브랜드 로고와 기본 아이콘입니다.", src: "/brand/malmoim-logo.png", alt: "[데모] 사진 자리 표시용 로고", additionalPhotos: [{ src: "/globe.svg", alt: "[데모] 두 번째 사진 자리 표시용 지구 아이콘" }] },
  { id: "gallery-demo-special", category: "special", title: "[데모] 단일 사진 상세 보기", date: "2025-01-01", description: "[데모] 사진 한 장인 경우의 화면 확인용 예시입니다.", src: "/brand/malmoim-logo.png", alt: "[데모] 사진 자리 표시용 로고" },
];
export default function GalleryPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <main id="public-main" className="history-page" tabIndex={-1}><div className="history-heading"><p className="history-label">DEVELOPMENT ONLY</p><h1>사진 상세 <span>UI 미리보기</span></h1><p>모든 항목은 [데모]입니다. 실제 활동 자료가 아니며 DB에 저장되지 않습니다.</p></div><HistoryGallery photos={photos} /></main>;
}
