import type { PublicLocale } from "./public-content";
import { memberText } from "./member-messages";
import { COUNTRY_CODES, FOREIGN_LANGUAGES, GENDERS, KOREAN_LEVELS, ENGLISH_LEVELS, FOREIGN_LEVELS, SIGNUP_RULES, getTodayInKorea } from "./signup-options";

export type SignupInput = {
  email: string; password: string; passwordConfirmation: string;
  name: string; callingCode: string; phoneNumber: string; nationality: string;
  gender: string; birthDate: string; koreanLevel: string; englishLevel: string;
  foreignLanguages: { language: string; level: string }[];
  privacyConsent: boolean;
};
export type SignupErrors = Record<string, string>;
export type SignupProfile = {
  email: string; name: string; callingCode: string; phoneNumber: string;
  nationality: string; gender: string; birthDate: string; koreanLevel: string; englishLevel: string;
  foreignLanguages: { language: string; level: string }[];
};
export type SignupValidation = { errors: SignupErrors; profile: SignupProfile | null };

export function readSignupForm(form: FormData): SignupInput {
  const text = (name: string) => { const value = form.get(name); return typeof value === "string" ? value : ""; };
  const languages = form.getAll("foreignLanguage");
  const levels = form.getAll("foreignLevel");
  return {
    email: text("email"), password: text("password"), passwordConfirmation: text("passwordConfirmation"),
    name: text("name"), callingCode: text("callingCode") === "other" ? text("customCallingCode") : text("callingCode"),
    phoneNumber: text("phoneNumber"), nationality: text("nationality"), gender: text("gender"),
    birthDate: text("birthDate"), koreanLevel: text("koreanLevel"), englishLevel: text("englishLevel"), privacyConsent: form.get("privacyConsent") === "on",
    foreignLanguages: Array.from({ length: Math.max(languages.length, levels.length) }, (_, i) => ({
      language: typeof languages[i] === "string" ? languages[i] as string : "",
      level: typeof levels[i] === "string" ? levels[i] as string : "",
    })),
  };
}

// Shared pure validator: browser preview and future server registration must use the same rules.
export function validateSignup(input: SignupInput, { today = getTodayInKorea(), requireConsent = false, authenticated = false, minPasswordLength = SIGNUP_RULES.minPasswordLength as number, requiredFields = [] as string[], locale = "ko" as PublicLocale } = {}): SignupValidation {
  const errors: SignupErrors = {};
  const email = input.email.trim();
  const name = input.name.trim();
  const callingCode = input.callingCode.trim();
  const rawNumber = input.phoneNumber.replace(/[\s().-]/g, "");
  const phoneNumber = callingCode === "82" ? rawNumber.replace(/^0/, "") : rawNumber;
  const validLevel = (level: string) => KOREAN_LEVELS.some(option => option.value === level);
  if (!authenticated && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) errors.email = "이메일 형식을 확인해주세요.";
  if (!authenticated && (input.password.length < Math.max(SIGNUP_RULES.minPasswordLength, minPasswordLength) ||
      input.password.length > SIGNUP_RULES.maxPasswordLength || !/[A-Za-z]/.test(input.password) ||
      !/[0-9]/.test(input.password) || !/[\x21-\x2f\x3a-\x40\x5b-\x60\x7b-\x7e]/.test(input.password)))
    errors.password = "비밀번호는 최소 8자이며 영문·숫자·특수기호를 모두 포함해야 합니다.";
  if (!authenticated && (!input.passwordConfirmation || input.password !== input.passwordConfirmation))
    errors.passwordConfirmation = "비밀번호가 일치하지 않습니다.";
  if (name.length > 100 || /[\u0000-\u001f\u007f]/.test(name)) errors.name = "이름을 1~100자로 입력해주세요.";
  if (phoneNumber && !/^[1-9]\d{0,2}$/.test(callingCode)) errors.callingCode = "국가번호는 + 기호를 제외한 1~3자리 숫자로 입력해주세요.";
  if (phoneNumber && (!/^[\d\s().-]+$/.test(input.phoneNumber) || !/^\d+$/.test(phoneNumber) || phoneNumber.length < 4 ||
      (callingCode + phoneNumber).length < 7 || (callingCode + phoneNumber).length > 15))
    errors.phoneNumber = "전화번호를 확인해주세요. 국가번호 포함 7~15자리 숫자를 입력할 수 있습니다.";
  if (input.nationality && !COUNTRY_CODES.includes(input.nationality)) errors.nationality = "목록에서 국적을 선택해주세요.";
  if (input.gender && !GENDERS.some(option => option.value === input.gender)) errors.gender = "성별 응답을 선택해주세요.";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.birthDate);
  const date = match ? new Date(input.birthDate + "T00:00:00Z") : null;
  if (input.birthDate && (!date || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== input.birthDate ||
      input.birthDate < "0001-01-01" || input.birthDate > today)) errors.birthDate = "미래가 아닌 유효한 생년월일을 선택해주세요.";
  if (!validLevel(input.koreanLevel)) errors.koreanLevel = "한국어 실력을 선택해주세요.";
  if (!ENGLISH_LEVELS.some(option => option.value === input.englishLevel)) errors.englishLevel = "영어 실력을 선택해주세요.";
  if (input.foreignLanguages.length < SIGNUP_RULES.minForeignLanguages || input.foreignLanguages.length > SIGNUP_RULES.maxForeignLanguages)
    errors.foreignLanguages = "추가 외국어는 0~3개 등록할 수 있습니다.";
  const seen = new Set<string>();
  input.foreignLanguages.forEach((entry, i) => {
    if (!FOREIGN_LANGUAGES.some(([code]) => code === entry.language)) errors[`foreignLanguages.${i}.language`] = "목록에서 외국어를 선택해주세요.";
    else if (seen.has(entry.language)) errors[`foreignLanguages.${i}.language`] = "같은 언어를 중복 등록할 수 없습니다.";
    seen.add(entry.language);
    if (!FOREIGN_LEVELS.some(option => option.value === entry.level)) errors[`foreignLanguages.${i}.level`] = "이 언어의 실력을 선택해주세요.";
  });
  for (const field of requiredFields) {
    if (["name", "phoneNumber", "nationality", "gender", "birthDate"].includes(field) &&
        !String(input[field as keyof SignupInput] ?? "").trim()) errors[field] = "필수 입력 항목입니다.";
  }
  if (requireConsent && !input.privacyConsent) errors.privacyConsent = "확정된 개인정보 수집·이용 안내에 대한 동의가 필요합니다.";
  for (const key of Object.keys(errors)) errors[key] = memberText(locale, errors[key]);
  if (Object.keys(errors).length) return { errors, profile: null };
  return { errors, profile: { email, name, callingCode, phoneNumber, nationality: input.nationality,
    gender: input.gender, birthDate: input.birthDate, koreanLevel: input.koreanLevel, englishLevel: input.englishLevel,
    foreignLanguages: input.foreignLanguages.map(entry => ({ ...entry })) } };
}
