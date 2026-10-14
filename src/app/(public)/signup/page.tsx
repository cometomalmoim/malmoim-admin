import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCountryOptions, getTodayInKorea } from "@/lib/signup-options";
import { SignupForm } from "@/components/signup-form";
import "./signup.css";

export const metadata: Metadata = { title: "회원가입", robots: { index: false, follow: false } };

async function SignupContent() {
  let loggedIn = false;
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    loggedIn = !error && !!user;
  } catch { /* The preparation screen remains available; no registration is performed. */ }
  if (loggedIn) redirect("/");
  return <SignupForm countries={getCountryOptions()} today={getTodayInKorea()} />;
}

export default function SignupPage() {
  return <main id="public-main" className="signup-page" tabIndex={-1}>
    <Link className="public-text-link" href="/">← 홈으로</Link>
    <div className="signup-heading"><span className="public-kicker">JOIN MALMOIM</span>
      <h1>말모임과 함께 시작해요</h1><p>계정 정보부터 사용 가능한 언어까지, 한곳에서 준비하세요.</p></div>
    <aside className="signup-preparation" aria-label="회원가입 준비 상태">
      <strong>회원가입 준비 중</strong>
      <p>개인정보 안내와 저장 준비가 완료되기 전까지 실제 회원가입은 제공하지 않습니다. 아래 화면에서는 브라우저 안에서 입력 형식만 확인할 수 있습니다.</p>
    </aside>
    <Suspense fallback={<p role="status">회원가입 화면을 준비하고 있습니다…</p>}><SignupContent /></Suspense>
  </main>;
}
