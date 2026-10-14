import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { publicPages } from "@/lib/public-content";
export function generateStaticParams() { return publicPages.map(({ slug }) => ({ slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = publicPages.find(p => p.slug === slug);
  if (!page) notFound();
  return { title: page.title, description: page.description, alternates: { canonical: `/${slug}` }, openGraph: { title: `${page.title} | 말모임 MALMOIM`, description: page.description } };
}
export default async function PublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = publicPages.find(p => p.slug === slug);
  if (!page) notFound();
  return <main id="public-main" className="public-detail" tabIndex={-1}><Link className="public-text-link" href="/">← 홈으로</Link><div className="public-detail-heading"><span className="public-kicker">{page.title}</span><h1>{page.intro}</h1><p>{page.description}</p></div><section className="public-detail-empty" aria-labelledby="empty-title"><span className="public-tag">준비 중</span><h2 id="empty-title">조금만 기다려주세요</h2><p>{page.empty}</p><Link className="public-button" href="/">홈으로 돌아가기</Link></section></main>;
}
