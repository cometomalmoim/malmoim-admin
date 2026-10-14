"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { BrandLogo } from "./brand-logo";
import { publicPages } from "@/lib/public-content";
export function PublicHeader({ account }: { account: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  return <header className="public-header">
    <Link className="public-logo" href="/" aria-label="말모임 홈" onClick={() => setOpen(false)}><BrandLogo compact /></Link>
    <button className="public-menu-toggle" aria-label={open ? "메뉴 닫기" : "메뉴 열기"} type="button" aria-expanded={open} aria-controls="public-navigation" onClick={() => setOpen(!open)}>메뉴</button>
    <nav onClick={(event) => { if (event.target instanceof Element && event.target.closest("a")) setOpen(false); }} id="public-navigation" className={open ? "public-navigation is-open" : "public-navigation"} aria-label="주 메뉴" onKeyDown={(event) => { if (event.key === "Escape") { setOpen(false); document.querySelector<HTMLButtonElement>(".public-menu-toggle")?.focus(); } }}>
      {publicPages.map((page) => <Link key={page.slug} href={`/${page.slug}`} aria-current={pathname === `/${page.slug}` ? "page" : undefined} onClick={() => setOpen(false)}>{page.title}</Link>)}
    </nav>
    {account}
  </header>;
}
