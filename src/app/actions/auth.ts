"use server";
import { SupabaseConfigError } from "@/lib/supabase/config";
import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { message: string };
async function signIn(formData: FormData, destination: "/admin" | "/"): Promise<AuthState> {
  const email = formData.get("email");
  const password = formData.get("password");
  if (typeof email !== "string" || typeof password !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || !password) {
    return { message: "이메일과 비밀번호를 확인해주세요." };
  }
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      if (isAuthRetryableFetchError(error) || (error.status ?? 0) >= 500) return { message: "인증 서버에 연결하지 못했습니다. 네트워크와 Supabase 프로젝트 상태를 확인해주세요." };
      if ((error.status === 401 || error.status === 403) && error.code !== "email_not_confirmed") return { message: "Supabase 연결 설정을 확인해주세요. Project URL과 Publishable key가 같은 프로젝트의 값인지 확인해주세요." };
      if (error.code === "email_not_confirmed") return { message: "이메일 확인이 완료되지 않은 계정입니다. Supabase 계정 상태를 확인해주세요." };
      if (error.status === 429) return { message: "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요." };
      return { message: "로그인하지 못했습니다. 이메일과 비밀번호를 확인하고 다시 시도해주세요." };
    }
  } catch (error) {
    if (error instanceof SupabaseConfigError) return { message: "Supabase 연결 설정이 누락되었거나 올바르지 않습니다. .env.local의 Project URL과 Publishable key를 확인해주세요." };
    return { message: "로그인 처리 중 오류가 발생했습니다. 연결 상태와 서버 설정을 확인해주세요." };
  }
  redirect(destination);
}
export async function login(_state: AuthState, formData: FormData): Promise<AuthState> {
  return signIn(formData, "/admin");
}
export async function memberLogin(_state: AuthState, formData: FormData): Promise<AuthState> {
  return signIn(formData, "/");
}
async function signOut(destination: "/login" | "/"): Promise<AuthState> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) return { message: "로그아웃하지 못했습니다. 다시 시도해주세요." };
  } catch { return { message: "로그아웃하지 못했습니다. 다시 시도해주세요." }; }
  redirect(destination);
}
export async function logout(): Promise<AuthState> {
  return signOut("/login");
}
export async function memberLogout(): Promise<AuthState> {
  return signOut("/");
}
