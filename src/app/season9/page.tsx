import type { Metadata } from "next";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import "./language-selection.css";

export const metadata: Metadata = {
  title: "말모임 9기 모집 · MALMOIM Season 9",
  description: "모집 안내 언어를 선택해주세요. Choose your language for MALMOIM Season 9.",
  alternates: { canonical: "/season9" },
};

export default function Page() {
  return (
    <main className="s9-language" id="main-content">
      <div className="s9-language-card">
        <div className="s9-language-logo"><BrandLogo compact /></div>
        <p className="s9-language-kicker">MALMOIM · SEASON 09</p>
        <h1><span lang="ko">말모임 9기 모집 안내</span><span lang="en">Discover MALMOIM Season 9</span></h1>
        <p className="s9-language-intro"><span lang="ko">모집 안내 언어를 선택해주세요.</span><span lang="en">Choose your language.</span></p>
        <nav className="s9-language-choices" aria-label="안내 언어 / Program language">
          <Link href="/season9/ko" lang="ko"><strong>한국어</strong><span>한국어 모집 안내 보기 <span aria-hidden="true">→</span></span></Link>
          <Link href="/season9/en" lang="en"><strong>English</strong><span>View program details <span aria-hidden="true">→</span></span></Link>
        </nav>
        <nav className="s9-language-details" aria-label="모집 안내 / Program details">
          <Link href="/season9/ko" lang="ko">모집 안내</Link>
          <Link href="/season9/en" lang="en">Program details</Link>
        </nav>
      </div>
    </main>
  );
}
