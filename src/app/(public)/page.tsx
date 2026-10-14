import Link from "next/link";
import type { Metadata } from "next";
import { BrandLogo } from "@/components/brand-logo";
import { publicPages } from "@/lib/public-content";
export const metadata: Metadata = { alternates: { canonical: "/" } };
export default function HomePage() {
  return <main id="public-main" tabIndex={-1}><section className="public-hero"><div><span className="public-kicker">HELLO, MALMOIM</span><h1>언어로 만나는<br /><span>새로운 세계.</span></h1><p>말모임의 이야기와 다양한 만남의 안내를<br className="desktop-break" /> 이곳에서 확인하세요.</p><Link className="public-button" href="/about">말모임 알아보기 <span aria-hidden="true">↗</span></Link></div><div className="public-hero-brand"><BrandLogo /><p>Come to MALMOIM, Meet the world.</p></div></section>
  <section className="public-section"><div className="public-section-heading"><span className="public-kicker">GET TO KNOW US</span><h2>말모임을 만나보세요</h2><p>처음 오셨나요? 말모임 소개와 참여 안내부터 살펴보세요.</p></div><div className="public-intro-card"><div><h3>어떤 만남이 기다리고 있을까요?</h3><p>자세한 소개와 참여 방법을 준비하고 있습니다.</p></div><Link className="public-text-link" href="/about">소개와 참여 안내 →</Link></div></section>
  <section className="public-section public-soft"><div className="public-section-heading"><span className="public-kicker">EXPLORE</span><h2>함께할 시간을 찾아보세요</h2><p>관심 있는 안내를 선택해 살펴보세요.</p></div><div className="public-cards">{publicPages.filter(p => p.slug === "events" || p.slug === "exchange").map((page, index) => <article className="public-card" key={page.slug}><span className="public-card-number">0{index + 1}</span><h3>{page.title}</h3><p>{page.description}</p><div className="public-empty">{page.empty}</div><Link className="public-text-link" href={`/${page.slug}`}>안내 살펴보기 →</Link></article>)}</div></section>
  <section className="public-section public-history"><div><span className="public-kicker">OUR STORIES</span><h2>지난 만남의 이야기</h2><p>공개할 활동 기록을 준비하고 있습니다.</p><Link className="public-text-link" href="/history">말모임 히스토리 →</Link></div><div className="public-history-note"><span aria-hidden="true">↗</span><p>기록이 준비되면<br />이곳에서 함께 만나보세요.</p></div></section></main>;
}
