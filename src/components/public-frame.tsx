import Link from "next/link";
import "./public-shell-design.css";
import { PublicHeader } from "./public-header";
import { getPublicPages, publicPath, type PublicLocale } from "@/lib/public-content";
export function PublicFrame({ children, locale = "ko", account }: { children: React.ReactNode; locale?: PublicLocale; account?: React.ReactNode }) {
  const en = locale === "en";
  return <div className="public-site" lang={locale}><a className="public-skip" href="#public-main">{en ? "Skip to content" : "본문으로 바로가기"}</a><PublicHeader locale={locale} account={account}/>{children}<footer className="public-footer"><div><strong>{en ? "MALMOIM" : "말모임 MALMOIM"}</strong><p>Come to MALMOIM, Meet the world.</p></div><nav aria-label={en ? "Footer navigation" : "하단 메뉴"}>{getPublicPages(locale).map(page=><Link key={page.slug} href={publicPath(locale,page.slug)}>{page.title}</Link>)}</nav></footer></div>;
}
