"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import { CALLING_CODES, FOREIGN_LANGUAGES, GENDERS, KOREAN_LANGUAGE_LEVELS, FOREIGN_LANGUAGE_LEVELS, SIGNUP_RULES } from "@/lib/signup-options";
import { readSignupForm, validateSignup, type SignupErrors } from "@/lib/signup-validation";

const subscribeToHydration = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

function Field({ id, label, error, hint, children }: {
  id: string; label: string; error?: string; hint?: string; children: ReactNode;
}) {
  return <div className="signup-field">
    <label htmlFor={id}>{label} <span className="signup-required" aria-label="필수">*</span></label>
    {children}
    {hint && <p id={id + "-hint"} className="signup-hint">{hint}</p>}
    {error && <p id={id + "-error"} className="signup-error">{error}</p>}
  </div>;
}

export function SignupForm({ countries, today }: {
  countries: { code: string; label: string }[]; today: string;
}) {
  const hydrated = useSyncExternalStore(subscribeToHydration, clientReady, serverReady);
  const [errors, setErrors] = useState<SignupErrors>({});
  const [message, setMessage] = useState("");
  const [checking, setChecking] = useState(false);
  const [visible, setVisible] = useState(false);
  const [callingCode, setCallingCode] = useState("82");
  const [rows, setRows] = useState([{ id: 0, language: "", level: "" }]);
  const nextId = useRef(1);
  const submitting = useRef(false);
  const described = (id: string, hint = false) => [hint ? id + "-hint" : "", errors[id] ? id + "-error" : ""].filter(Boolean).join(" ") || undefined;

  useEffect(() => {
    if (!checking && Object.keys(errors).length) {
      document.querySelector<HTMLElement>(".signup-form [aria-invalid=true]")?.focus();
    }
  }, [checking, errors]);

  async function checkInput(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setChecking(true);
    setMessage("");
    try {
      const result = validateSignup(readSignupForm(new FormData(event.currentTarget)), { today, requireConsent: false });
      setErrors(result.errors);
      // This preview intentionally never transmits form fields, stores data, or calls Auth.
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      if (Object.keys(result.errors).length) {
        setMessage("입력 내용을 확인해주세요. 정보는 전송되거나 저장되지 않았습니다.");
      } else {
        setMessage("입력 형식을 확인했습니다. 회원가입은 아직 완료되지 않았습니다. 개인정보 안내와 저장 준비가 완료된 후 가입할 수 있습니다.");
      }
    } finally {
      setChecking(false);
      submitting.current = false;
    }
  }

  const koreanLevelOptions = <>{KOREAN_LANGUAGE_LEVELS.map(option => <option value={option.value} key={option.value}>{option.label}</option>)}</>;

  const foreignLevelOptions = <>{FOREIGN_LANGUAGE_LEVELS.map(option => <option value={option.value} key={option.value}>{option.label}</option>)}</>;

  return <form className="signup-form" method="post" noValidate onChange={() => setMessage("")} onSubmit={checkInput} aria-busy={checking}>
    <noscript><p className="notice">입력 형식 확인에는 JavaScript가 필요합니다. 이 화면에서는 계정을 생성하거나 정보를 저장하지 않습니다.</p></noscript>
    <p className="signup-required-note"><span aria-hidden="true">*</span> 필수 입력 항목</p>
    <fieldset disabled={!hydrated || checking} className="signup-section">
      <legend><span>SECTION 01</span>계정 정보 <small>Account Information</small></legend>
      <p className="signup-section-intro">이메일을 로그인 ID로 사용합니다.</p>
      <Field id="email" label="이메일" error={errors.email}>
        <input id="email" name="email" type="email" autoComplete="email" maxLength={254} required aria-invalid={!!errors.email} aria-describedby={described("email")} />
      </Field>
      <div className="signup-grid">
        <Field id="password" label="비밀번호" error={errors.password} hint="화면 검증 기준은 8~128자입니다. 실제 가입 전 프로젝트 비밀번호 정책 확인이 필요합니다.">
          <div className="password-field"><input id="password" name="password" type={visible ? "text" : "password"}
            autoComplete="new-password" minLength={SIGNUP_RULES.minPasswordLength} maxLength={SIGNUP_RULES.maxPasswordLength}
            required aria-invalid={!!errors.password} aria-describedby={described("password", true)} />
            <button type="button" aria-controls="password passwordConfirmation" aria-pressed={visible} onClick={() => setVisible(value => !value)}>{visible ? "숨기기" : "보기"}</button>
          </div>
        </Field>
        <Field id="passwordConfirmation" label="비밀번호 확인" error={errors.passwordConfirmation}>
          <input id="passwordConfirmation" name="passwordConfirmation" type={visible ? "text" : "password"}
            autoComplete="new-password" required maxLength={SIGNUP_RULES.maxPasswordLength} aria-invalid={!!errors.passwordConfirmation} aria-describedby={described("passwordConfirmation")} />
        </Field>
      </div>
    </fieldset>

    <fieldset disabled={!hydrated || checking} className="signup-section">
      <legend><span>SECTION 02</span>개인정보 <small>Personal Information</small></legend>
      <p className="signup-section-intro">공개 프로필이나 게시판에 표시하지 않는 가입 정보입니다.</p>
      <div className="signup-grid">
        <Field id="name" label="이름" error={errors.name}>
          <input id="name" name="name" autoComplete="name" maxLength={100} required aria-invalid={!!errors.name} aria-describedby={described("name")} />
        </Field>
        <Field id="nationality" label="국적" error={errors.nationality}>
          <select id="nationality" name="nationality" required defaultValue="" aria-invalid={!!errors.nationality} aria-describedby={described("nationality")}>
            <option value="">국적 선택</option>{countries.map(country => <option key={country.code} value={country.code}>{country.label}</option>)}
          </select>
        </Field>
      </div>
      <div className="signup-grid">
        <Field id="callingCode" label="전화 국가번호" error={errors.callingCode}>
          <select id="callingCode" name="callingCode" autoComplete="tel-country-code" value={callingCode}
            onChange={event => setCallingCode(event.target.value)} aria-invalid={!!errors.callingCode}
            aria-describedby={described("callingCode")} required>
            {CALLING_CODES.map(([code, label]) => <option key={code} value={code}>{label} (+{code})</option>)}
            <option value="other">다른 국가번호 직접 입력</option>
          </select>
          {callingCode === "other" && <><label className="signup-custom-code-label" htmlFor="customCallingCode">국가번호 숫자</label>
            <input id="customCallingCode" name="customCallingCode" type="text" inputMode="numeric" maxLength={3} placeholder="예: 254" required
              aria-invalid={!!errors.callingCode} aria-describedby={described("callingCode")} /></>}
        </Field>
        <Field id="phoneNumber" label="전화번호" error={errors.phoneNumber} hint="국가번호를 제외하고 입력해주세요. 공백·괄호·하이픈을 사용할 수 있습니다.">
          <input id="phoneNumber" name="phoneNumber" type="tel" autoComplete="tel-national" maxLength={30} required
            aria-invalid={!!errors.phoneNumber} aria-describedby={described("phoneNumber", true)} />
        </Field>
      </div>
      <div className="signup-grid">
        <Field id="gender" label="성별" error={errors.gender}>
          <select id="gender" name="gender" defaultValue="" required aria-invalid={!!errors.gender} aria-describedby={described("gender")}>
            <option value="">응답 선택</option>{GENDERS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </Field>
        <Field id="birthDate" label="생년월일" error={errors.birthDate}>
          <input id="birthDate" name="birthDate" type="date" autoComplete="bday" min="0001-01-01" max={today} required aria-invalid={!!errors.birthDate} aria-describedby={described("birthDate")} />
        </Field>
      </div>
    </fieldset>

    <fieldset disabled={!hydrated || checking} className="signup-section">
      <legend><span>SECTION 03</span>언어 정보 <small>Language Information</small></legend>
      <Field id="koreanLevel" label="한국어 실력" error={errors.koreanLevel}>
        <select id="koreanLevel" name="koreanLevel" required defaultValue="" aria-invalid={!!errors.koreanLevel} aria-describedby={described("koreanLevel")}>
          <option value="">실력 선택</option>{koreanLevelOptions}
        </select>
      </Field>
      <div className="signup-language-heading"><h2>사용 가능한 외국어 <span className="signup-required" aria-label="필수">*</span></h2>
        <span aria-live="polite">{rows.length}/{SIGNUP_RULES.maxForeignLanguages}</span></div>
      <p className="signup-hint">외국어는 {SIGNUP_RULES.minForeignLanguages}~{SIGNUP_RULES.maxForeignLanguages}개 선택해주세요. 한국어는 위에서 별도로 관리합니다.</p>
      {errors.foreignLanguages && <p className="signup-error" role="alert">{errors.foreignLanguages}</p>}
      <div className="signup-languages">
        {rows.map((row, index) => {
          const languageError = errors[`foreignLanguages.${index}.language`];
          const levelError = errors[`foreignLanguages.${index}.level`];
          return <div className="signup-language-row" key={row.id}>
            <div className="signup-grid">
              <Field id={`language-${row.id}`} label={`외국어 ${index + 1}`} error={languageError}>
                <select id={`language-${row.id}`} name="foreignLanguage" value={row.language} required
                  aria-invalid={!!languageError} aria-describedby={languageError ? `language-${row.id}-error` : undefined}
                  onChange={event => { setRows(current => current.map(item => item.id === row.id ? { ...item, language: event.target.value } : item)); setErrors({}); }}>
                  <option value="">언어 선택</option>{FOREIGN_LANGUAGES.map(([code, label]) =>
                    <option key={code} value={code} disabled={rows.some(other => other.id !== row.id && other.language === code)}>{label}</option>)}
                </select>
              </Field>
              <Field id={`level-${row.id}`} label={`외국어 ${index + 1} 실력`} error={levelError}>
                <select id={`level-${row.id}`} name="foreignLevel" value={row.level} required
                  aria-invalid={!!levelError} aria-describedby={levelError ? `level-${row.id}-error` : undefined}
                  onChange={event => { setRows(current => current.map(item => item.id === row.id ? { ...item, level: event.target.value } : item)); setErrors({}); }}>
                  <option value="">실력 선택</option>{foreignLevelOptions}
                </select>
              </Field>
            </div>
            <button type="button" className="signup-remove" aria-label={`외국어 ${index + 1} 삭제`}
              onClick={() => { setRows(current => current.filter(item => item.id !== row.id)); setErrors({}); }}>삭제</button>
          </div>;
        })}
      </div>
      <button type="button" className="signup-add" disabled={rows.length >= SIGNUP_RULES.maxForeignLanguages}
        onClick={() => { const id = nextId.current++; setRows(current => current.length >= SIGNUP_RULES.maxForeignLanguages ? current : [...current, { id, language: "", level: "" }]); setErrors({}); }}>+ 외국어 추가</button>
    </fieldset>

    <section className="signup-consent" aria-labelledby="signup-consent-title">
      <h2 id="signup-consent-title">개인정보 수집·이용 안내</h2>
      <dl><div><dt>수집 목적</dt><dd>확정 대기</dd></div><div><dt>보관 기간</dt><dd>확정 대기</dd></div></dl>
      <p className="signup-hint">안내 문구와 필수·선택 동의 범위를 확인 중입니다. 확정 전에는 동의를 받거나 정보를 저장하지 않습니다.</p>
      <label className="signup-consent-label"><input type="checkbox" name="privacyConsent" disabled />개인정보 수집·이용 동의 — 문구 확정 대기</label>
      <span className="signup-policy-pending">개인정보 처리방침 링크 · 준비 중</span>
    </section>
    <div className="signup-submit">
      <p>현재는 입력 형식만 확인할 수 있습니다. 계정이 생성되거나 정보가 저장되지 않습니다.</p>
      <button type="submit" className="primary" disabled={!hydrated || checking}>{checking ? "확인 중…" : "입력 내용 확인"}</button>
      {message && <p className="notice" role="status">{message}</p>}
      <Link className="preview-link" href="/auth/login">이미 계정이 있나요? 로그인</Link>
    </div>
  </form>;
}
