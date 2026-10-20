"use client";
import { useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { memberText } from "@/lib/member-messages";
import type { PublicLocale } from "@/lib/public-content";
import { memberLogin } from "@/app/actions/auth";

export function MemberLoginForm({ locale = "ko" }: { locale?: PublicLocale }) {
  const searchParams = useSearchParams();
  const t = (text: string) => memberText(locale, text);
  const [state, action, pending] = useActionState(memberLogin, { message: "" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [edited, setEdited] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const emailInput = useRef<HTMLInputElement>(null);
  const passwordInput = useRef<HTMLInputElement>(null);
  const feedback = useRef<HTMLParagraphElement>(null);
  const message = edited ? "" : state.message;

  useEffect(() => {
    if (message && !pending) feedback.current?.focus();
  }, [message, pending]);

  function validate(event: FormEvent<HTMLFormElement>) {
    if (pending) { event.preventDefault(); return; }
    const next: typeof errors = {};
    if (!email.trim()) next.email = t("이메일을 입력해주세요.");
    else if (email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      next.email = t("올바른 이메일 주소를 입력해주세요.");
    if (!password) next.password = t("비밀번호를 입력해주세요.");
    setErrors(next);
    if (Object.keys(next).length) {
      event.preventDefault();
      (next.email ? emailInput : passwordInput).current?.focus();
      return;
    }
    setEdited(false);
  }

  return <form action={action} onSubmit={validate} noValidate aria-busy={pending} className="member-login-form">
    <input type="hidden" name="locale" value={locale} />
    <input type="hidden" name="returnTo" value={searchParams.get("returnTo") ?? ""} />
    <div className="member-login-field">
      <label htmlFor="member-email">{t("이메일")}</label>
      <div className="member-login-input-control">
        <svg className="member-login-field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></svg>
        <input ref={emailInput} id="member-email" name="email" type="email" autoComplete="username"
          autoCapitalize="none" spellCheck={false} inputMode="email" placeholder="name@example.com"
          value={email} onChange={event => { setEmail(event.target.value); setEdited(true); }}
          required maxLength={254} readOnly={pending} aria-invalid={!!errors.email}
          aria-describedby={errors.email ? "member-email-error" : undefined} />
      </div>
      {errors.email && <p className="member-login-field-error" id="member-email-error">{errors.email}</p>}
    </div>
    <div className="member-login-field">
      <label htmlFor="member-password">{t("비밀번호")}</label>
      <div className="member-login-input-control member-login-password-control">
        <svg className="member-login-field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" /></svg>
        <input ref={passwordInput} id="member-password" name="password" type={visible ? "text" : "password"}
          autoComplete="current-password" placeholder={t("비밀번호를 입력해주세요")}
          value={password} onChange={event => { setPassword(event.target.value); setEdited(true); }}
          required readOnly={pending} aria-invalid={!!errors.password}
          aria-describedby={errors.password ? "member-password-error" : undefined} />
        <button type="button" aria-controls="member-password" aria-pressed={visible}
          aria-label={t(visible ? "비밀번호 숨기기" : "비밀번호 표시")}
          disabled={pending} onClick={() => setVisible(value => !value)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
            {visible ? <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></> : <><path d="m3 3 18 18M10.6 5.1 12 5c6.5 0 10 7 10 7a19 19 0 0 1-3.1 4.1M6.1 6.1A20 20 0 0 0 2 12s3.5 7 10 7a11 11 0 0 0 5.9-1.9M10 10a3 3 0 0 0 4 4" /></>}
          </svg>
        </button>
      </div>
      {errors.password && <p className="member-login-field-error" id="member-password-error">{errors.password}</p>}
    </div>
    {message && <p ref={feedback} className="member-login-feedback" role="alert" tabIndex={-1}>{message}</p>}
    <button className="member-login-submit" type="submit" disabled={pending}>{t(pending ? "로그인 중…" : "로그인")}</button>
  </form>;
}
