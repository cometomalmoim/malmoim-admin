import type { Metadata } from "next";
import { Suspense } from "react";
import { PublicAccount } from "@/components/public-account";
import { PublicFrame } from "@/components/public-frame";
import "./public.css";
export const metadata: Metadata = {
  metadataBase: new URL("https://malmoim.com"),
  title: { default: "말모임 MALMOIM", template: "%s | 말모임 MALMOIM" },
  description: "말모임 소개, 스터디·이벤트, 1:1 언어교환과 지난 활동 안내를 만나보세요.",
  robots: { index: true, follow: true },
  openGraph: { title: "말모임 MALMOIM", description: "말모임의 소개와 참여 안내를 만나보세요.", locale: "ko_KR", type: "website", siteName: "말모임 MALMOIM" },
};
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <PublicFrame account={<Suspense fallback={<div className="public-account" role="status">로그인 상태 확인 중…</div>}><PublicAccount /></Suspense>}>{children}</PublicFrame>;
}
