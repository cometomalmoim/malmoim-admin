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
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  return response;
}
export const config = { matcher: ["/", "/admin/:path*", "/login", "/auth/login", "/signup", "/about", "/events", "/exchange", "/board", "/history"] };
