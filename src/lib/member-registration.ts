import type { PublicLocale } from "./public-content";
import { memberText } from "./member-messages";
import { validateSignup, type SignupInput, type SignupErrors } from "./signup-validation";

export type RegistrationState = {
  status: "blocked" | "invalid" | "error" | "confirmation" | "profile_pending" | "complete";
  message: string;
  errors?: SignupErrors;
};
export type RegistrationPolicy = { minPasswordLength: number; requiredFields: string[]; consentVersion: string };
type BackendError = { code?: string; status?: number };
type User = { id: string; email?: string };
export type RegistrationBackend = {
  auth: {
    getUser(): Promise<{ data: { user: User | null }; error: unknown }>;
    signUp(input: { email: string; password: string }): Promise<{
      data: { user: User | null; session: unknown | null }; error: BackendError | null;
    }>;
  };
  rpc(name: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: BackendError | null }>;
};

export async function registerMember(
  input: SignupInput, backend: RegistrationBackend, policy: RegistrationPolicy | null, locale: PublicLocale = "ko",
): Promise<RegistrationState> {
  const t = (text: string) => memberText(locale, text);
  if (!policy) return { status: "blocked", message: t("개인정보 정책과 저장 준비가 완료되지 않아 가입을 진행하지 않았습니다.") };
  let authCreated = false;
  try {
    const current = await backend.auth.getUser();
    if (current.error && !(typeof current.error === "object" && "name" in current.error && current.error.name === "AuthSessionMissingError")) return { status: "error", message: t("로그인 상태를 확인하지 못했습니다. 다시 로그인해주세요.") };
    const currentUser = current.error ? null : current.data.user;
    const checked = validateSignup(input, { authenticated: !!currentUser, requireConsent: true,
      minPasswordLength: policy.minPasswordLength, requiredFields: policy.requiredFields, locale });
    if (!checked.profile) return { status: "invalid", message: t("입력 내용을 확인해주세요."), errors: checked.errors };
    // The endpoint must include approved consent persistence, not just profile tables.
    const ready = await backend.rpc("member_registration_ready");
    if (ready.error || ready.data !== policy.consentVersion)
      return { status: "blocked", message: t("회원가입 저장 준비가 완료되지 않았습니다. 계정은 생성하지 않았습니다.") };
    let user = currentUser;
    if (!user) {
      const result = await backend.auth.signUp({ email: checked.profile.email, password: input.password });
      if (result.error) return { status: "error", message: result.error.code === "weak_password"
        ? t("비밀번호가 서비스 보안 정책에 맞지 않습니다. 비밀번호를 확인해주세요.")
        : result.error.status === 429 ? t("요청이 많습니다. 잠시 후 다시 시도해주세요.")
        : t("가입 요청을 처리하지 못했습니다. 입력 정보와 이메일 안내를 확인해주세요.") };
      if (!result.data.session || !result.data.user)
        return { status: "confirmation", message: t("가입 요청을 접수했습니다. 이메일 인증이 필요한 경우 받은 메일을 확인해주세요. 이미 가입한 이메일이라면 로그인해주세요. 프로필은 아직 저장되지 않았으며, 로그인 후 이 화면에서 다시 입력해 저장해야 합니다.") };
      authCreated = true;
      // Verify the identity that will authorize the profile RPC, not submitted IDs.
      const verified = await backend.auth.getUser();
      user = !verified.error ? verified.data.user : null;
      if (!user || user.id !== result.data.user.id)
        return { status: "profile_pending", message: t("계정 요청 후 로그인 상태를 확인하지 못했습니다. 가입은 완료되지 않았습니다. 로그인 후 이 화면에서 프로필 저장을 다시 시도해주세요.") };
    }
    const p = checked.profile;
    const saved = await backend.rpc("save_member_profile", {
      p_profile: { name: p.name || null, phone_country_code: p.phoneNumber ? p.callingCode : null,
        phone_number: p.phoneNumber || null, nationality_code: p.nationality || null, gender: p.gender || null,
        birth_date: p.birthDate || null, korean_proficiency: p.koreanLevel, english_proficiency: p.englishLevel },
      p_languages: p.foreignLanguages.map(entry => ({ language_code: entry.language, proficiency: entry.level })),
      p_consent_version: policy.consentVersion,
    });
    if (saved.error || saved.data !== user.id)
      return { status: "profile_pending", message: t("프로필 저장이 완료되지 않았습니다. 계정이 있다면 로그인 후 이 화면에서 다시 저장해주세요. 가입 완료 상태가 아닙니다.") };
    return { status: "complete", message: t("프로필과 언어 정보가 저장되었습니다. 홈페이지를 이용할 수 있습니다.") };
  } catch {
    return { status: authCreated ? "profile_pending" : "error",
      message: t("요청 결과를 확인하지 못했습니다. 가입 완료로 처리하지 않았습니다. 이메일 안내 또는 로그인 상태를 확인한 뒤 다시 시도해주세요.") };
  }
}
