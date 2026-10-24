import { PUBLIC_LOCALE_COOKIE, publicLocaleDecision } from "@/lib/public-locale";
import { isAdminRoot } from "@/lib/domain-routing";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/") {
    if (isAdminRoot(request.headers.get("host"), request.nextUrl.pathname)) {
      const destination = request.nextUrl.clone();
      destination.pathname = "/login";
      const response = NextResponse.redirect(destination);
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    }
  }
  const selection = request.method === "GET" ? request.nextUrl.searchParams.get("lang") : null;
  // Background route prefetches must never overwrite an explicit language choice.
  const rememberLocale = selection === "en" || selection === "ko";
  const localeDecision = request.method === "GET" ? publicLocaleDecision(
    request.nextUrl.pathname, request.cookies.get(PUBLIC_LOCALE_COOKIE)?.value, selection,
  ) : null;
  const localeCookieOptions = { path: "/", sameSite: "lax" as const, httpOnly: true,
    secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 365 };
  if (localeDecision && (localeDecision.pathname !== request.nextUrl.pathname || selection === "en" || selection === "ko")) {
    const destination = request.nextUrl.clone();
    destination.pathname = localeDecision.pathname;
    destination.searchParams.delete("lang");
    const response = NextResponse.redirect(destination);
    if (rememberLocale) response.cookies.set(PUBLIC_LOCALE_COOKIE, localeDecision.locale, localeCookieOptions);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
  let response = NextResponse.next({ request });
  try {
    const { url, key } = getSupabaseConfig();
    const supabase = createServerClient(url, key, {
      cookieOptions: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" },
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(values) {
          values.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });
    try { await supabase.auth.getClaims(); } catch { /* Page checks fail closed. */ }
  } catch { /* Invalid configuration never grants access; page checks fail closed. */ }
  if (localeDecision && rememberLocale) response.cookies.set(PUBLIC_LOCALE_COOKIE, localeDecision.locale, localeCookieOptions);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  return response;
}
// Only routes using the shared public header plus the existing admin boundaries.
export const config = { matcher: ["/", "/about", "/events", "/exchange", "/board/:path*", "/history", "/privacy", "/terms", "/en/:path*", "/signup", "/auth/login", "/login", "/admin/:path*"] };
