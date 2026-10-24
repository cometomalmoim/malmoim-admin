"use client";
import Link from "next/link";
import {useRouter} from "next/navigation";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { getCallingCodeOptions, getForeignLanguageOptions, GENDERS, KOREAN_LEVELS, ENGLISH_LEVELS, FOREIGN_LEVELS, SIGNUP_RULES } from "@/lib/signup-options";
import { signup } from "@/app/actions/member-registration";
import { readSignupForm, validateSignup, adultBirthDateLimit,type SignupErrors } from "@/lib/signup-validation";
import {SignupLegalNotice} from "./signup-legal-notice";
import type {MemberLegalPublication,MemberLegalDocuments} from "@/lib/member-legal";
import { memberText } from "@/lib/member-messages";
import { localizedPublicPath } from "@/lib/public-locale";
import type { PublicLocale } from "@/lib/public-content";

function Field({ id, label, error, hint, required, children }: {
  id: string; label: string; error?: string; hint?: string; required?: boolean; children: ReactNode;
}) {
  return <div className="signup-field">
    <label htmlFor={id}>{label}{required && <span aria-hidden="true"> *</span>}</label>
    {children}
    {hint && <p id={id + "-hint"} className="signup-hint">{hint}</p>}
    {error && <p id={id + "-error"} className="signup-error">{error}</p>}
  </div>;
}

export function SignupForm({ countries, today, accountEmail = null, registrationEnabled = false, locale = "ko",legal=null,documents,collectOptionalProfile=true }: {
  countries: { code: string; label: string }[]; today: string; accountEmail?: string | null;
  registrationEnabled?: boolean; locale?: PublicLocale;legal?:MemberLegalPublication|null;documents?:MemberLegalDocuments;collectOptionalProfile?:boolean;
}) {
  const t = (text: string) => memberText(locale, text);
  const router=useRouter();
  const [complete,setComplete]=useState(false);
  const [confirmation,setConfirmation]=useState(false);
  const [authenticated,setAuthenticated]=useState(accountEmail!==null);
  const [errors, setErrors] = useState<SignupErrors>({});
  const [message, setMessage] = useState("");
  const [checking, setChecking] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmationVisible, setConfirmationVisible] = useState(false);
  const [callingCode, setCallingCode] = useState("82");
  const [rows, setRows] = useState<{ id: number; language: string; level: string }[]>([]);
  const nextId = useRef(0);
  const submitting = useRef(false);
  const described = (id: string, hint = false) => [hint ? id + "-hint" : "", errors[id] ? id + "-error" : ""].filter(Boolean).join(" ") || undefined;
  const levelOptions = (levels: readonly { value: string; label: string }[]) =>
    levels.map(option => <option value={option.value} key={option.value}>{t(option.label)}</option>);

  async function checkInput(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current||complete) return;
    const formElement=event.currentTarget;
    submitting.current = true;
    setChecking(true);
    setMessage("");
    try {
      const formData = new FormData(formElement);
      const result = validateSignup(readSignupForm(formData), { today, authenticated, locale,requireTerms:registrationEnabled,requireConsent:registrationEnabled&&legal?.collection.basis==="consent" });
      setErrors(result.errors);
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      if (Object.keys(result.errors).length) {
        setMessage(t("입력 내용을 확인해주세요. 정보는 전송되거나 저장되지 않았습니다."));
        requestAnimationFrame(() => document.querySelector<HTMLElement>(".signup-form [aria-invalid=true]")?.focus());
      } else {
        // When unavailable, send only the UI locale, never the personal fields.
        const payload = registrationEnabled ? formData : new FormData();
        payload.set("locale", locale);
        const state = await signup(payload);
        setMessage(state.message);
        setErrors(state.errors ?? {});
        if(state.status==="complete"||state.status==="confirmation"){
          for(const name of ["password","passwordConfirmation"]){const field=formElement.elements.namedItem(name);if(field instanceof HTMLInputElement)field.value="";}
          if(state.status==="complete")setComplete(true);else setConfirmation(true);
          router.refresh();
        }else if(state.status==="profile_pending"&&state.canRetryProfile){
          // Auth may have succeeded even when profile saving failed. A retry must
          // reuse that session instead of creating another account or requiring its password.
          setAuthenticated(true);router.refresh();
        }
      }
    } catch {
      setMessage(t("요청을 처리하지 못했습니다. 입력 내용을 유지했습니다. 다시 시도해주세요."));
    } finally {
      setChecking(false);
      submitting.current = false;
    }
  }

  if(complete)return <section className="signup-consent" aria-live="polite">
    <h2>{t("회원가입이 완료되었습니다.")}</h2><p>{message}</p>
    <Link className="public-text-link" href={localizedPublicPath("/",locale)}>{t("홈으로 돌아가기")}</Link>
  </section>;
  if(confirmation)return <section className="signup-consent" aria-live="polite">
    <h2>{t("이메일 인증을 확인해주세요.")}</h2><p>{message}</p>
    <Link className="public-text-link" href={localizedPublicPath("/auth/login",locale)}>{t("로그인")}</Link>
  </section>;
  return <form className="signup-form" noValidate onSubmit={checkInput} aria-busy={checking}>
    <input type="hidden" name="locale" value={locale} />
    <p className="signup-required-note">{t(collectOptionalProfile?"별표(*)가 있는 항목을 입력해 주세요. 추가 외국어는 선택입니다.":"별표(*)가 있는 필수 항목만 수집합니다.")}</p>
    <fieldset disabled={checking} className="signup-section">
      <legend><span>SECTION 01</span>{t("계정 정보")}</legend>
      <p className="signup-section-intro">{t("이메일을 로그인 ID로 사용합니다.")}</p>
      <Field id="nickname" label={t("닉네임")} error={errors.nickname} required hint={t("게시판과 커뮤니티 활동에서 표시되는 이름입니다.")}>
       <input id="nickname" name="nickname" autoComplete="nickname" required maxLength={40} placeholder={t("사용할 닉네임을 입력해 주세요.")} aria-required="true" aria-invalid={!!errors.nickname} aria-describedby={described("nickname",true)}/>
       <p className="signup-hint">{t("한글·영문·숫자·밑줄 2~20자. 닉네임 중복은 회원가입 저장 시 최종 확인합니다.")}</p>
      </Field>
      <Field id="email" label={t("이메일")} error={errors.email} required>
        <input id="email" name="email" type="email" autoComplete="email" defaultValue={accountEmail ?? ""}
          readOnly={accountEmail !== null} maxLength={254} aria-required="true" aria-invalid={!!errors.email} aria-describedby={described("email")} />
      </Field>
      {!authenticated && <div className="signup-grid">
        <Field id="password" label={t("비밀번호")} error={errors.password} required hint={t("최소 8자 · 영문, 숫자, 특수기호를 모두 포함해주세요.")}>
          <div className="password-field"><input id="password" name="password" type={passwordVisible ? "text" : "password"}
            autoComplete="new-password" minLength={SIGNUP_RULES.minPasswordLength} maxLength={SIGNUP_RULES.maxPasswordLength}
            aria-required="true" aria-invalid={!!errors.password} aria-describedby={described("password", true)} />
            <button type="button" aria-controls="password" aria-pressed={passwordVisible}
              aria-label={t(passwordVisible ? "비밀번호 숨기기" : "비밀번호 표시")}
              onClick={() => setPasswordVisible(value => !value)}>{t(passwordVisible ? "숨기기" : "보기")}</button>
          </div>
        </Field>
        <Field id="passwordConfirmation" label={t("비밀번호 확인")} error={errors.passwordConfirmation} required>
          <div className="password-field"><input id="passwordConfirmation" name="passwordConfirmation" type={confirmationVisible ? "text" : "password"}
            autoComplete="new-password" minLength={SIGNUP_RULES.minPasswordLength} maxLength={SIGNUP_RULES.maxPasswordLength}
            aria-required="true" aria-invalid={!!errors.passwordConfirmation} aria-describedby={described("passwordConfirmation")} />
            <button type="button" aria-controls="passwordConfirmation" aria-pressed={confirmationVisible}
              aria-label={t(confirmationVisible ? "비밀번호 확인 숨기기" : "비밀번호 확인 표시")}
              onClick={() => setConfirmationVisible(value => !value)}>{t(confirmationVisible ? "숨기기" : "보기")}</button>
          </div>
        </Field>
      </div>}
    </fieldset>
    <fieldset disabled={checking} className="signup-section">
      <legend><span>SECTION 02</span>{t("기본 정보")}</legend>
      {collectOptionalProfile&&<><p className="signup-section-intro">{t("전화번호 인증은 제공하지 않습니다. 기본 정보의 수집 범위는 운영 정책 확정 후 적용합니다.")}</p>
      <div className="signup-grid">
        <Field id="name" label={t("이름")} error={errors.name}>
          <input id="name" name="name" autoComplete="name" maxLength={100} aria-invalid={!!errors.name} aria-describedby={described("name")} />
        </Field>
        <Field id="nationality" label={t("국적")} error={errors.nationality}>
          <select id="nationality" name="nationality" defaultValue="" aria-invalid={!!errors.nationality} aria-describedby={described("nationality")}>
            <option value="">{t("국적 선택")}</option>{countries.map(country => <option key={country.code} value={country.code}>{country.label}</option>)}
          </select>
        </Field>
      </div>
      <div className="signup-grid">
        <Field id="callingCode" label={t("전화 국가번호")} error={errors.callingCode}>
          <select id="callingCode" name="callingCode" autoComplete="tel-country-code" value={callingCode}
            onChange={event => setCallingCode(event.target.value)} aria-invalid={!!errors.callingCode} aria-describedby={described("callingCode")}>
            {getCallingCodeOptions(locale).map(({ code, label }) => <option key={code} value={code}>{label} (+{code})</option>)}
            <option value="other">{t("다른 국가번호 직접 입력")}</option>
          </select>
          {callingCode === "other" && <><label className="signup-custom-code-label" htmlFor="customCallingCode">{t("국가번호 숫자")}</label>
            <input id="customCallingCode" name="customCallingCode" type="text" inputMode="numeric" maxLength={3} placeholder={t("예: 254")}
              aria-invalid={!!errors.callingCode} aria-describedby={described("callingCode")} /></>}
        </Field>
        <Field id="phoneNumber" label={t("전화번호")} error={errors.phoneNumber}
          hint={t("국가번호를 제외하고 입력해주세요. 한국 번호의 첫 0과 공백·괄호·하이픈은 저장 형식에서 제외합니다.")}>
          <input id="phoneNumber" name="phoneNumber" type="tel" autoComplete="tel-national" maxLength={30}
            aria-invalid={!!errors.phoneNumber} aria-describedby={described("phoneNumber", true)} />
        </Field>
      </div>
      </>}
      <div className="signup-grid">
        {collectOptionalProfile&&
        <Field id="gender" label={t("성별")} error={errors.gender}>
          <select id="gender" name="gender" defaultValue="" aria-invalid={!!errors.gender} aria-describedby={described("gender")}>
            <option value="">{t("응답 선택")}</option>{GENDERS.map(option => <option key={option.value} value={option.value}>{t(option.label)}</option>)}
          </select>
        </Field>}
        <Field id="birthDate" label={t("생년월일")} error={errors.birthDate} required hint={t("만 19세 이상만 가입할 수 있습니다. 입력한 날짜 확인은 본인·연령 인증을 의미하지 않습니다.")}>
          <input id="birthDate" name="birthDate" type="date" autoComplete="bday" required aria-required="true" min="0001-01-01" max={adultBirthDateLimit(today)}
            aria-invalid={!!errors.birthDate} aria-describedby={described("birthDate",true)} />
        </Field>
      </div>
    </fieldset>
    <fieldset disabled={checking} className="signup-section">
      <legend><span>SECTION 03</span>{t("언어 정보")}</legend>
      <Field id="koreanLevel" label={t("한국어 실력")} error={errors.koreanLevel} required>
        <select id="koreanLevel" name="koreanLevel" defaultValue="" aria-required="true" aria-invalid={!!errors.koreanLevel} aria-describedby={described("koreanLevel")}>
          <option value="">{t("실력 선택")}</option>{levelOptions(KOREAN_LEVELS)}
        </select>
      </Field>
      <Field id="englishLevel" label={t("영어 실력")} error={errors.englishLevel} required>
        <select id="englishLevel" name="englishLevel" defaultValue="" aria-required="true" aria-invalid={!!errors.englishLevel} aria-describedby={described("englishLevel")}>
          <option value="">{t("실력 선택")}</option>{levelOptions(ENGLISH_LEVELS)}
        </select>
      </Field>
      {collectOptionalProfile&&<><div className="signup-language-heading"><h2>{t("추가 외국어")}</h2><span aria-live="polite">{rows.length}/{SIGNUP_RULES.maxForeignLanguages}</span></div>
      <p className="signup-hint">{t("추가 외국어는 선택 사항이며 최대 3개까지 등록할 수 있습니다. 한국어와 영어는 위에서 별도로 선택해주세요.")}</p>
      {errors.foreignLanguages && <p className="signup-error" role="alert">{errors.foreignLanguages}</p>}
      {rows.length > 0 && <div className="signup-languages">
        {rows.map((row, index) => {
          const languageError = errors["foreignLanguages." + index + ".language"];
          const levelError = errors["foreignLanguages." + index + ".level"];
          return <div className="signup-language-row" key={row.id}>
            <div className="signup-grid">
              <Field id={"language-" + row.id} label={t("외국어") + " " + (index + 1)} error={languageError} required>
                <select id={"language-" + row.id} name="foreignLanguage" value={row.language} aria-required="true"
                  aria-invalid={!!languageError} aria-describedby={languageError ? "language-" + row.id + "-error" : undefined}
                  onChange={event => { setRows(current => current.map(item => item.id === row.id ? { ...item, language: event.target.value } : item)); setErrors({}); }}>
                  <option value="">{t("언어 선택")}</option>{getForeignLanguageOptions(locale).map(({ code, label }) =>
                    <option key={code} value={code} disabled={rows.some(other => other.id !== row.id && other.language === code)}>{label}</option>)}
                </select>
              </Field>
              <Field id={"level-" + row.id} label={t("외국어") + " " + (index + 1) + " " + t("실력")} error={levelError} required>
                <select id={"level-" + row.id} name="foreignLevel" value={row.level} aria-required="true"
                  aria-invalid={!!levelError} aria-describedby={levelError ? "level-" + row.id + "-error" : undefined}
                  onChange={event => { setRows(current => current.map(item => item.id === row.id ? { ...item, level: event.target.value } : item)); setErrors({}); }}>
                  <option value="">{t("실력 선택")}</option>{levelOptions(FOREIGN_LEVELS)}
                </select>
              </Field>
            </div>
            <button type="button" className="signup-remove" aria-label={t("삭제") + " " + t("외국어") + " " + (index + 1)}
              onClick={() => { setRows(current => current.filter(item => item.id !== row.id)); setErrors({}); }}>{t("삭제")}</button>
          </div>;
        })}
      </div>}
      <button type="button" className="signup-add" disabled={rows.length >= SIGNUP_RULES.maxForeignLanguages}
        onClick={() => { const id = nextId.current++; setRows(current => current.length < SIGNUP_RULES.maxForeignLanguages ?
          [...current, { id, language: "", level: "" }] : current); setErrors({}); }}>{t("+ 외국어 추가")}</button></>}
    </fieldset>
    <SignupLegalNotice legal={legal} documents={documents} enabled={registrationEnabled} pending={checking} locale={locale} errors={errors}/>
    <div className="signup-submit">
      <button type="submit" className="primary" disabled={checking}>{t(checking ? "확인 중…" : registrationEnabled?(authenticated?"회원 정보 저장":"회원가입"):"입력 내용 확인")}</button>
      {message && <p className="notice" role="status">{message}</p>}
      <Link className="preview-link" href={localizedPublicPath("/auth/login", locale)}>{t("이미 계정이 있나요? 로그인")}</Link>
    </div>
  </form>;
}
