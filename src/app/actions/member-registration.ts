"use server";
import { memberText } from "@/lib/member-messages";
import { parsePublicLocale } from "@/lib/public-locale";
import { createClient } from "@/lib/supabase/server";
import { memberRegistrationPolicy } from "@/lib/member-registration-policy";
import { registerMember, type RegistrationState } from "@/lib/member-registration";
import { readSignupForm } from "@/lib/signup-validation";
import {publishedMemberLegal} from "@/lib/member-legal";
import {registrationDocumentsReady} from "@/lib/member-registration-readiness";

export async function signup(form: FormData): Promise<RegistrationState> {
  const locale = parsePublicLocale(form.get("locale"));
  const t = (text: string) => memberText(locale, text);
  // Check before creating an Auth client/account; the UI cannot bypass this gate.
  if (!memberRegistrationPolicy||!registrationDocumentsReady(memberRegistrationPolicy,publishedMemberLegal)) return { status: "blocked",
    message: t("회원가입 설정과 저장 준비를 확인하지 못했습니다. 계정과 개인정보는 저장되지 않았습니다.") };
  try {
    return await registerMember(readSignupForm(form), await createClient(), memberRegistrationPolicy, locale,
      diagnostic => console.warn("[member-registration]", diagnostic));
  } catch { return { status: "error", message: t("회원가입 서비스에 연결하지 못했습니다. 가입은 완료되지 않았습니다.") }; }
}
