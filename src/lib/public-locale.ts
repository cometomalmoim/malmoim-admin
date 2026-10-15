import type { PublicLocale } from "./public-content";

export const PUBLIC_LOCALE_COOKIE = "malmoim_locale";
const publicPaths = new Set(["/", "/about", "/events", "/exchange", "/board", "/history", "/auth/login", "/signup"]);
export function parsePublicLocale(value: unknown): PublicLocale { return value === "en" ? "en" : "ko"; }
export function publicBasePath(pathname: string): string {
  return pathname.replace(/^\/en(?=\/|$)/, "") || "/";
}
export function isLocalizedPublicPath(pathname: string): boolean {
  return publicPaths.has(publicBasePath(pathname));
}
export function localizedPublicPath(pathname: string, locale: PublicLocale): string {
  const base = publicBasePath(pathname);
  return locale === "en" ? (base === "/" ? "/en" : "/en" + base) : base;
}
// Explicit language selection wins over the preference cookie. Only known public
// routes participate; admin and independent event routes are left alone.
export function publicLocaleDecision(pathname: string, preference?: string, selection?: string | null) {
  if (!isLocalizedPublicPath(pathname)) return null;
  const locale = selection === "en" || selection === "ko" ? selection :
    pathname === "/en" || pathname.startsWith("/en/") ? "en" : parsePublicLocale(preference);
  return { locale, pathname: localizedPublicPath(pathname, locale) };
}
