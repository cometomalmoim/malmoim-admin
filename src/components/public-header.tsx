"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { BrandLogo } from "./brand-logo";
import { localizedPublicPath } from "@/lib/public-locale";
import { getPublicPages, publicPath, type PublicLocale } from "@/lib/public-content";
export function PublicHeader({ locale = "ko", account }: { locale?: PublicLocale; account: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const en = locale === "en";
  const koreanPath = localizedPublicPath(pathname, "ko");
  const englishPath = localizedPublicPath(pathname, "en");
  return <header className="public-header">
    <Link className="public-logo" href={publicPath(locale)} aria-label={en ? "MALMOIM home" : "말모임 홈"} onClick={() => setOpen(false)}><BrandLogo compact /></Link>
    <button className="public-menu-toggle" type="button" aria-expanded={open} aria-controls="public-navigation" onClick={() => setOpen(!open)}>{en ? (open ? "Close menu" : "Menu") : `메뉴 ${open ? "닫기" : "열기"}`}</button>
    <nav id="public-navigation" className={open ? "public-navigation is-open" : "public-navigation"} aria-label={en ? "Main navigation" : "주 메뉴"} onKeyDown={event => { if (event.key === "Escape") { setOpen(false); document.querySelector<HTMLButtonElement>(".public-menu-toggle")?.focus(); } }}>
      {getPublicPages(locale).map(page => <Link key={page.slug} href={publicPath(locale,page.slug)} aria-current={pathname === publicPath(locale,page.slug) ? "page" : undefined} onClick={() => setOpen(false)}>{page.title}</Link>)}
    </nav>
    <div className="public-languages" role="group" aria-label={en ? "Choose language" : "언어 선택"}><Link href={koreanPath + "?lang=ko"} prefetch={false} hrefLang="ko" lang="ko" aria-current={!en ? "page" : undefined} onClick={()=>setOpen(false)}>한국어</Link><span aria-hidden="true">/</span><Link href={englishPath + "?lang=en"} prefetch={false} hrefLang="en" lang="en" aria-current={en ? "page" : undefined} onClick={()=>setOpen(false)}>English</Link></div>
    {account}
  </header>;
}
