import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PublicAccount } from "@/components/public-account";
import { PublicHeader } from "@/components/public-header";
import { publicPages } from "@/lib/public-content";
import "./public.css";
export const metadata: Metadata = {
  metadataBase: new URL("https://malmoim.com"),
  title: { default: "말모임 MALMOIM", template: "%s | 말모임 MALMOIM" },
  description: "말모임 소개, 스터디·이벤트, 1:1 언어교환과 지난 활동 안내를 만나보세요.",
  robots: { index: true, follow: true },
  openGraph: { title: "말모임 MALMOIM", description: "말모임의 소개와 참여 안내를 만나보세요.", locale: "ko_KR", type: "website", siteName: "말모임 MALMOIM" },
};
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <div className="public-site"><a className="public-skip" href="#public-main">본문으로 바로가기</a><PublicHeader account={<Suspense fallback={<div className="public-account" role="status">로그인 상태 확인 중…</div>}><PublicAccount /></Suspense>} />{children}<footer className="public-footer"><div><strong>말모임 MALMOIM</strong><p>Come to MALMOIM, Meet the world.</p></div><nav aria-label="하단 메뉴">{publicPages.map((page) => <Link key={page.slug} href={`/${page.slug}`}>{page.title}</Link>)}</nav></footer></div>;
}
