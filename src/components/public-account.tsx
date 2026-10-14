import "server-only";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ProfileMenu } from "./profile-menu";

async function getAccountEmail(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (!error && user) return user.email ?? "로그인한 사용자";
  } catch { /* Keep the public site accessible when authentication is unavailable. */ }
  return null;
}

export async function PublicAccount() {
  const email = await getAccountEmail();
  if (email !== null) {
    return <div className="public-account">
      <ProfileMenu email={email} />
    </div>;
  }
  return <div className="public-account">
    <Link href="/auth/login">로그인</Link>
  </div>;
}
