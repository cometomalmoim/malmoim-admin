import type { PublicLocale } from "./public-content";
import { memberText } from "./member-messages";
import { validateSignup, type SignupInput, type SignupErrors } from "./signup-validation";
import {registrationDatabaseReady} from "./member-registration-readiness";

export type RegistrationState = {
  status: "blocked" | "invalid" | "error" | "confirmation" | "profile_pending" | "complete";
  message: string;
  errors?: SignupErrors;
  canRetryProfile?: boolean;
};
export type RegistrationPolicy = {  minPasswordLength: number; requiredFields: string[]; consentVersion: string;termsVersion:string;privacyVersion:string;privacyConsentRequired:boolean;collectOptionalProfile?:boolean;persistBeforeConfirmation?:boolean };
type BackendError = { code?: string; status?: number };
type RegistrationStage = "readiness" | "nickname" | "prepare" | "auth_signup" | "profile_save";
export type RegistrationDiagnostic = { stage: RegistrationStage; code: string; status?: number };
// Only known codes reach server logs. Never log provider messages, payloads or identities.
const diagnosticCodes = new Set(["email_address_invalid", "email_address_not_authorized", "email_provider_disabled", "signup_disabled", "unexpected_failure", "weak_password", "user_already_exists", "email_exists", "over_email_send_rate_limit", "over_request_rate_limit", "23505", "23514", "42501", "22023", "P0003"]);
type User = { id: string; email?: string; identities?: unknown[] };
export type RegistrationBackend = {
  auth: {
    getUser(): Promise<{ data: { user: User | null }; error: unknown }>;
    signUp(input: { email: string; password: string;options?:{data:{malmoim_registration_token:string}} }): Promise<{
      data: { user: User | null; session: unknown | null }; error: BackendError | null;
    }>;
  };
  rpc(name: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: BackendError | null }>;
};

export async function registerMember(
  input: SignupInput, backend: RegistrationBackend, policy: RegistrationPolicy | null, locale: PublicLocale = "ko",
  onFailure?: (diagnostic: RegistrationDiagnostic) => void,
): Promise<RegistrationState> {
  const t = (text: string) => memberText(locale, text);
  const report = (stage: RegistrationStage, error: BackendError | null) => {
    if (!error) return;
    const diagnostic: RegistrationDiagnostic = { stage, code: error.code && diagnosticCodes.has(error.code) ? error.code : "unclassified" };
    if (typeof error.status === "number" && Number.isInteger(error.status) && error.status >= 400 && error.status <= 599)
      diagnostic.status = error.status;
    try { onFailure?.(diagnostic); } catch { /* Diagnostics must not change signup results. */ }
  };
  if (!policy||!policy.termsVersion||!policy.privacyVersion||!policy.consentVersion) return { status: "blocked", message: t("개인정보 정책과 저장 준비가 완료되지 않아 가입을 진행하지 않았습니다.") };
  if(policy.collectOptionalProfile===false&&(input.name.trim()||input.phoneNumber.trim()||input.nationality||input.gender||input.foreignLanguages.length))
    return {status:"invalid",message:t("현재 가입에서는 선택 개인정보를 수집하지 않습니다. 페이지를 새로 열어주세요.")};
  let authCreated = false;
  try {
    const current = await backend.auth.getUser();
    if (current.error && !(typeof current.error === "object" && "name" in current.error && current.error.name === "AuthSessionMissingError")) return { status: "error", message: t("로그인 상태를 확인하지 못했습니다. 다시 로그인해주세요.") };
    const currentUser = current.error ? null : current.data.user;
    const checked = validateSignup(input, { authenticated: !!currentUser, requireConsent: policy.privacyConsentRequired,requireTerms:true,
      minPasswordLength: policy.minPasswordLength, requiredFields: policy.requiredFields, locale });
    if (!checked.profile) return { status: "invalid", message: t("입력 내용을 확인해주세요."), errors: checked.errors };
    if(input.termsVersion!==policy.termsVersion||input.privacyVersion!==policy.privacyVersion||input.collectionVersion!==policy.consentVersion)return {status:"invalid",message:t("안내 문서가 변경되었습니다. 페이지를 새로 열어 확인해주세요.")};
    // The endpoint must include approved consent persistence, not just profile tables.
    const ready = await backend.rpc("member_registration_v2_ready");
    report("readiness", ready.error);
    if (ready.error || !registrationDatabaseReady(ready.data,policy))
      return { status: "blocked", message: t("회원가입 저장 준비가 완료되지 않았습니다. 계정은 생성하지 않았습니다.") };
    const available=await backend.rpc("member_nickname_available",{p_nickname:checked.profile.nickname});
    report("nickname", available.error);
    if(available.error||typeof available.data!=="boolean")return {status:"blocked",message:t("닉네임 중복 검사를 완료하지 못했습니다. 가입을 진행하지 않았습니다.")};
    if(available.data!==true)return {status:"invalid",message:t("입력 내용을 확인해주세요."),errors:{nickname:t("이미 사용 중인 닉네임입니다. 다른 닉네임을 입력해주세요.")}};
    const p = checked.profile;
    const saveInput={
      p_nickname:p.nickname,p_terms_version:policy.termsVersion,p_privacy_version:policy.privacyVersion,
      p_terms_accepted:input.termsConsent,p_collection_accepted:input.privacyConsent,
      p_profile: { name: p.name || null, phone_country_code: p.phoneNumber ? p.callingCode : null,
        phone_number: p.phoneNumber || null, nationality_code: p.nationality || null, gender: p.gender || null,
        birth_date: p.birthDate || null, korean_proficiency: p.koreanLevel, english_proficiency: p.englishLevel },
      p_languages: p.foreignLanguages.map(entry => ({ language_code: entry.language, proficiency: entry.level })),
      p_consent_version: policy.consentVersion,
    };
    let user = currentUser;
    if (!user) {
      let token:string|undefined;
      if(policy.persistBeforeConfirmation){
        const prepared=await backend.rpc("prepare_member_registration",{...saveInput,p_email:p.email});
        report("prepare", prepared.error);
        if(prepared.error||typeof prepared.data!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(prepared.data))
          return {status:"blocked",message:t("회원가입 저장 준비가 완료되지 않았습니다. 계정은 생성하지 않았습니다.")};
        token=prepared.data;
      }
      // Only an opaque, one-use reference reaches Auth metadata/JWTs. Personal
      // profile fields stay in the private database request table.
      const result = await backend.auth.signUp({ email: p.email, password: input.password,
        ...(token?{options:{data:{malmoim_registration_token:token}}}:{}) });
      report("auth_signup", result.error);
      if (result.error?.code === "email_address_invalid") {
        const message = t("인증 서비스에서 이 이메일 주소를 사용할 수 없습니다. 실제로 메일을 받을 수 있는 다른 이메일 주소를 입력해주세요.");
        return { status: "invalid", message, errors: { email: message } };
      }
      if (result.error?.code === "email_address_not_authorized")
        return { status: "error", message: t("인증 메일 발송 설정으로 인해 가입을 진행하지 못했습니다. 운영팀에 문의해주세요.") };
      // Auth owns the unique email constraint. Never expose auth.users via a public lookup RPC.
      if(result.error?.code==="user_already_exists"||result.error?.code==="email_exists"||
         (!result.error&&result.data.user?.identities?.length===0))
        return {status:"invalid",message:t("입력 내용을 확인해주세요."),errors:{email:t("이미 가입된 이메일입니다. 로그인해주세요.")}};
      if (result.error) return { status: "error", message: result.error.code === "weak_password"
        ? t("비밀번호가 서비스 보안 정책에 맞지 않습니다. 비밀번호를 확인해주세요.")
        : result.error.status === 429 ? t("요청이 많습니다. 잠시 후 다시 시도해주세요.")
        : t("가입 요청을 처리하지 못했습니다. 입력 정보와 이메일 안내를 확인해주세요.") };
      if (!result.data.session || !result.data.user)
        return { status: "confirmation", message: token&&result.data.user?t("계정과 회원 정보가 저장되었습니다. 받은 이메일에서 인증을 완료한 후 로그인해주세요. 회원 정보를 다시 입력할 필요는 없습니다."):t("가입 요청을 접수했습니다. 이메일 인증이 필요한 경우 받은 메일을 확인해주세요. 이미 가입한 이메일이라면 로그인해주세요. 프로필은 아직 저장되지 않았으며, 로그인 후 이 화면에서 다시 입력해 저장해야 합니다.") };
      authCreated = true;
      // Verify the identity that will authorize the profile RPC, not submitted IDs.
      const verified = await backend.auth.getUser();
      user = !verified.error ? verified.data.user : null;
      if (!user || user.id !== result.data.user.id)
        return { status: "profile_pending", message: t("계정 요청 후 로그인 상태를 확인하지 못했습니다. 가입은 완료되지 않았습니다. 로그인 후 이 화면에서 프로필 저장을 다시 시도해주세요.") };
    }
    const saved = await backend.rpc("save_member_registration_v2",saveInput);
    report("profile_save", saved.error);
    if(saved.error?.code==="23505")return {status:"profile_pending",canRetryProfile:true,message:t("이미 사용 중인 닉네임입니다. 다른 닉네임을 입력해주세요."),errors:{nickname:t("이미 사용 중인 닉네임입니다. 다른 닉네임을 입력해주세요.")}};
    if (saved.error || saved.data !== user.id)
      return { status: "profile_pending", canRetryProfile:true,message: t("프로필 저장이 완료되지 않았습니다. 계정이 있다면 로그인 후 이 화면에서 다시 저장해주세요. 가입 완료 상태가 아닙니다.") };
    return { status: "complete", message: t("프로필과 언어 정보가 저장되었습니다. 홈페이지를 이용할 수 있습니다.") };
  } catch {
    return { status: authCreated ? "profile_pending" : "error",
      message: t("요청 결과를 확인하지 못했습니다. 가입 완료로 처리하지 않았습니다. 이메일 안내 또는 로그인 상태를 확인한 뒤 다시 시도해주세요.") };
  }
}
