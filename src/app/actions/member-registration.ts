"use server";
import { memberText } from "@/lib/member-messages";
import { parsePublicLocale } from "@/lib/public-locale";
import { createClient } from "@/lib/supabase/server";
import { memberRegistrationPolicy } from "@/lib/member-registration-policy";
import { registerMember, type RegistrationState } from "@/lib/member-registration";
import { readSignupForm } from "@/lib/signup-validation";
import {publishedMemberLegal} from "@/lib/member-legal";

export async function signup(form: FormData): Promise<RegistrationState> {
  const locale = parsePublicLocale(form.get("locale"));
  const t = (text: string) => memberText(locale, text);
  // Check before creating an Auth client/account; the UI cannot bypass this gate.
  if (!memberRegistrationPolicy||!publishedMemberLegal||memberRegistrationPolicy.termsVersion!==publishedMemberLegal.terms.version||memberRegistrationPolicy.privacyVersion!==publishedMemberLegal.privacy.version||memberRegistrationPolicy.consentVersion!==publishedMemberLegal.collection.version||memberRegistrationPolicy.privacyConsentRequired!==(publishedMemberLegal.collection.basis==="consent")) return { status: "blocked",
    message: t("입력 형식을 확인했습니다. 개인정보 정책과 DB 저장 준비가 완료되기 전에는 실제 회원가입을 진행하지 않습니다. 계정과 개인정보는 저장되지 않았습니다.") };
  try {
    return await registerMember(readSignupForm(form), await createClient(), memberRegistrationPolicy, locale);
  } catch { return { status: "error", message: t("회원가입 서비스에 연결하지 못했습니다. 가입은 완료되지 않았습니다.") }; }
}
