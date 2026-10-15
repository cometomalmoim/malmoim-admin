import { localizedPublicPath } from "@/lib/public-locale";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ProfileMenu } from "./profile-menu";
import Link from "next/link";
import type { PublicLocale } from "@/lib/public-content";

export async function PublicAccount({ locale }: { locale: PublicLocale }) {
  // No shared cache: account data belongs to this request only.
  const store = await cookies();
  let email: string | null = null;
  if (store.getAll().some(cookie => /^sb-.*-auth-token(?:\.\d+)?$/.test(cookie.name))) {
    try {
      const supabase = await createClient();
      const { data: { user }, error } = await supabase.auth.getUser();
      if (!error && user) email = user.email ?? "";
    } catch { /* An unavailable session never grants access. */ }
  }
  return email !== null ? <ProfileMenu email={email} locale={locale} />
    : <Link className="public-login" href={localizedPublicPath("/auth/login", locale)}>{locale === "en" ? "Log in" : "로그인"}</Link>;
}
