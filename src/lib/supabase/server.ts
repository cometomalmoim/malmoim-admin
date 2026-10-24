import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import WebSocket from "ws";
import type {WebSocketLikeConstructor} from "@supabase/supabase-js";
import { getSupabaseConfig } from "./config";

export async function createClient() {
  const { url, key } = getSupabaseConfig();
  const store = await cookies();
  return createServerClient(url, key, {
    // Supabase initializes Realtime even for Auth-only clients. Node 20 has no
    // native WebSocket; an explicit transport keeps existing server Auth working.
    // ws implements the browser-compatible runtime API, but its Node event and
    // constructor overload declarations differ from Supabase's DOM-like types.
    realtime: { transport: WebSocket as unknown as WebSocketLikeConstructor },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
    cookieOptions: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" },
    cookies: {
      getAll: () => store.getAll(),
      setAll(values) {
        try { values.forEach(({ name, value, options }) => store.set(name, value, options)); }
        catch { /* Server Components cannot write cookies; Proxy refreshes them. */ }
      },
    },
  });
}
