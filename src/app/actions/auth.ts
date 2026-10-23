"use server";
import { memberText } from "@/lib/member-messages";
import { parsePublicLocale, localizedPublicPath, boardReturnPath, historyReturnPath } from "@/lib/public-locale";
import { SupabaseConfigError } from "@/lib/supabase/config";
import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { message: string };
async function authenticate(formData: FormData, member = false): Promise<AuthState | null> {
  const email = formData.get("email");
  const password = formData.get("password");
  if (typeof email !== "string" || typeof password !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || !password || (member && email.trim().length > 254)) {
    return { message: "이메일과 비밀번호를 확인해주세요." };
  }
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      if (isAuthRetryableFetchError(error) || (error.status ?? 0) >= 500) return { message: member ? "로그인 서비스에 연결할 수 없습니다. 잠시 후 다시 시도해주세요." : "인증 서버에 연결하지 못했습니다. 네트워크와 Supabase 프로젝트 상태를 확인해주세요." };
      if ((error.status === 401 || error.status === 403) && error.code !== "email_not_confirmed") return { message: member ? "로그인 서비스에 연결할 수 없습니다. 잠시 후 다시 시도해주세요." : "Supabase 연결 설정을 확인해주세요. Project URL과 Publishable key가 같은 프로젝트의 값인지 확인해주세요." };
      if (error.code === "email_not_confirmed") return { message: member ? "이메일 인증을 완료한 후 다시 로그인해주세요." : "이메일 확인이 완료되지 않은 계정입니다. Supabase 계정 상태를 확인해주세요." };
      if (error.status === 429) return { message: "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요." };
      return { message: "로그인하지 못했습니다. 이메일과 비밀번호를 확인하고 다시 시도해주세요." };
    }
  } catch (error) {
    if (error instanceof SupabaseConfigError) return { message: member ? "로그인 서비스에 연결할 수 없습니다. 잠시 후 다시 시도해주세요." : "Supabase 연결 설정이 누락되었거나 올바르지 않습니다. .env.local의 Project URL과 Publishable key를 확인해주세요." };
    return { message: member ? "로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요." : "로그인 처리 중 오류가 발생했습니다. 연결 상태와 서버 설정을 확인해주세요." };
  }
  return null;
}
export async function login(_state: AuthState, formData: FormData): Promise<AuthState> {
  const failure = await authenticate(formData);
  if (failure) return failure;
  redirect("/admin");
}
export async function memberLogin(_state: AuthState, formData: FormData): Promise<AuthState> {
  const locale = parsePublicLocale(formData.get("locale"));
  const failure = await authenticate(formData, true);
  if (failure) return { ...failure, message: memberText(locale, failure.message) };
  redirect(historyReturnPath(formData.get("returnTo"), locale) ?? boardReturnPath(formData.get("returnTo"), locale) ?? localizedPublicPath("/", locale));
}
export async function logout(): Promise<AuthState> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) return { message: "로그아웃하지 못했습니다. 다시 시도해주세요." };
  } catch { return { message: "로그아웃하지 못했습니다. 다시 시도해주세요." }; }
  redirect("/login");
}

// Public logout shares the existing local Supabase session; admin logout stays unchanged.
export async function memberLogout(_state?: AuthState, formData?: FormData): Promise<AuthState> {
  const locale = parsePublicLocale(formData?.get("locale"));
  const message = memberText(locale, "로그아웃하지 못했습니다. 다시 시도해주세요.");
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) return { message };
  } catch { return { message }; }
  redirect(localizedPublicPath("/", locale));
}
