import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicPages, publicPath, type PublicLocale } from "@/lib/public-content";

export function PublicDetail({ slug, locale = "ko" }: { slug: string; locale?: PublicLocale }) {
  const pages = getPublicPages(locale);
  const page = pages.find(item => item.slug === slug);
  if (!page) notFound();
  const en = locale === "en";

  return (
    <main id="public-main" className="public-detail" lang={locale} tabIndex={-1}>
      <nav className="public-breadcrumb" aria-label={en ? "Breadcrumb" : "페이지 이동 경로"}>
        <Link className="public-text-link" href={publicPath(locale)}>{en ? "Home" : "홈"}</Link>
        <span aria-hidden="true">/</span><span aria-current="page">{page.title}</span>
      </nav>
      <div className="public-detail-heading">
        <span className="public-kicker">{page.title}</span>
        <h1>{page.intro}</h1>
        <p>{page.description}</p>
      </div>
      <section className={`public-detail-empty public-detail-empty--${slug}`} aria-labelledby="empty-title">
        <div className="public-detail-symbol" aria-hidden="true">↗</div>
        <div className="public-detail-message">
          <span className="public-tag">{en ? "Coming soon" : "준비 중"}</span>
          <h2 id="empty-title">{en ? "More details are on the way" : "조금만 기다려주세요"}</h2>
          <p>{page.empty}</p>
          <Link className="public-button" href={publicPath(locale)}>{en ? "Back to home" : "홈으로 돌아가기"}<span aria-hidden="true">↗</span></Link>
        </div>
      </section>
      <nav className="public-explore" aria-label={en ? "Explore MALMOIM" : "다른 안내 살펴보기"}>
        <h2>{en ? "Keep exploring" : "다른 안내도 살펴보세요"}</h2>
        <div>{pages.filter(item => item.slug !== slug).map(item => (
          <Link key={item.slug} href={publicPath(locale, item.slug)}>{item.title}<span aria-hidden="true">↗</span></Link>
        ))}</div>
      </nav>
    </main>
  );
}
