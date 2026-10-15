"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { BrandLogo } from "./brand-logo";
import { getPublicPages, publicPath, type PublicLocale } from "@/lib/public-content";

export function PublicHeader({ locale = "ko", account }: { locale?: PublicLocale; account?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const en = locale === "en";
  const koreanPath = pathname.replace(/^\/en(?=\/|$)/, "") || "/";
  const translatedPage = getPublicPages("ko").some(page => koreanPath === publicPath("ko", page.slug));
  const englishPath = translatedPage ? `/en${koreanPath}` : "/en";
  return <header className="public-header">
    <Link className="public-logo" href={publicPath(locale)} aria-label={en ? "MALMOIM home" : "말모임 홈"} onClick={() => setOpen(false)}><BrandLogo compact /></Link>
    <button className="public-menu-toggle" type="button" aria-label={en ? (open ? "Close menu" : "Open menu") : (open ? "메뉴 닫기" : "메뉴 열기")} aria-expanded={open} aria-controls="public-navigation" onClick={() => setOpen(!open)}>{en ? "Menu" : "메뉴"}</button>
    <nav id="public-navigation" className={open ? "public-navigation is-open" : "public-navigation"} aria-label={en ? "Main navigation" : "주 메뉴"}
      onClick={event => { if (event.target instanceof Element && event.target.closest("a")) setOpen(false); }}
      onKeyDown={event => { if (event.key === "Escape") { setOpen(false); document.querySelector<HTMLButtonElement>(".public-menu-toggle")?.focus(); } }}>
      {getPublicPages(locale).map(page => <Link key={page.slug} href={publicPath(locale, page.slug)} aria-current={pathname === publicPath(locale, page.slug) ? "page" : undefined} onClick={() => setOpen(false)}>{page.title}</Link>)}
    </nav>
    <div className="public-languages" role="group" aria-label={en ? "Choose language" : "언어 선택"}><Link href={koreanPath} hrefLang="ko" lang="ko" aria-current={!en ? "page" : undefined} onClick={() => setOpen(false)}>한국어</Link><span aria-hidden="true">/</span><Link href={englishPath} hrefLang="en" lang="en" aria-current={en ? "page" : undefined} onClick={() => setOpen(false)}>English</Link></div>
    {account ?? <Link className="public-login" href="/login" onClick={() => setOpen(false)}>{en ? "Log in" : "로그인"}</Link>}
  </header>;
}
