import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCountryOptions, getTodayInKorea } from "@/lib/signup-options";
import { memberRegistrationPolicy } from "@/lib/member-registration-policy";
import {publishedMemberLegal,getPublishedMemberDocument} from "@/lib/member-legal";
import {registrationDocumentsReady} from "@/lib/member-registration-readiness";
import { SignupForm } from "./signup-form";
import { memberText } from "@/lib/member-messages";
import { localizedPublicPath } from "@/lib/public-locale";
import type { PublicLocale } from "@/lib/public-content";
import "@/app/(public)/signup/signup.css";

async function SignupContent({ locale }: { locale: PublicLocale }) {
  // The form needs today at request time, including when Auth setup fails before cookies().
  await connection();
  let accountEmail: string | null = null;
  const registrationEnabled=registrationDocumentsReady(memberRegistrationPolicy,publishedMemberLegal);
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (!error && user) accountEmail = user.email ?? "";
  } catch { /* Fail closed without logging account data or Auth errors. */ }
  return <SignupForm countries={getCountryOptions(locale)} today={getTodayInKorea()} locale={locale}
    accountEmail={accountEmail} registrationEnabled={registrationEnabled} legal={publishedMemberLegal}
    collectOptionalProfile={memberRegistrationPolicy?.collectOptionalProfile??false}
    documents={{privacy:getPublishedMemberDocument("privacy"),terms:getPublishedMemberDocument("terms")}}/>;
}
export function MemberSignupPage({ locale }: { locale: PublicLocale }) {
  const t = (text: string) => memberText(locale, text);
  return <main id="public-main" className="signup-page" lang={locale} tabIndex={-1}>
    <Link className="public-text-link" href={localizedPublicPath("/", locale)}>{t("← 홈으로")}</Link>
    <div className="signup-heading"><span className="public-kicker">JOIN MALMOIM</span>
      <h1>{t("회원가입")}</h1><p>{t("계정 정보부터 사용 가능한 언어까지, 한곳에서 준비하세요.")}</p></div>
    <Suspense fallback={<p role="status">{t("회원가입 화면을 준비하고 있습니다…")}</p>}><SignupContent locale={locale} /></Suspense>
  </main>;
}
