import Link from "next/link";
import { MemberLoginForm } from "./member-login-form";
import { memberText } from "@/lib/member-messages";
import { localizedPublicPath } from "@/lib/public-locale";
import type { PublicLocale } from "@/lib/public-content";
import "@/app/(public)/auth/login/login.css";

export function MemberLoginPage({ locale }: { locale: PublicLocale }) {
  const t = (text: string) => memberText(locale, text);
  return <main id="public-main" className="member-login" lang={locale} tabIndex={-1}>
    <div className="member-login-layout">
      <aside className="member-login-brand" aria-labelledby="member-login-brand-title">
        <div className="member-login-brand-copy">
          <h2 id="member-login-brand-title">{t("언어로 만나는")}<br />{t("새로운 세계.")}</h2>
          <p className="member-login-tagline">Come to MALMOIM, Meet the world.</p>
          <p className="member-login-description">{t("말모임은 언어를 사랑하는 사람들이 모여")}<br />{t("더 넓은 세상을 만나는 공간입니다.")}</p>
        </div>
        <svg className="member-login-illustration" viewBox="0 0 480 270" fill="none" aria-hidden="true" focusable="false">
          <defs><clipPath id="member-login-globe-clip"><circle cx="192" cy="213" r="155" /></clipPath></defs>
          <circle cx="192" cy="213" r="155" fill="#a9d6d5" />
          <g clipPath="url(#member-login-globe-clip)" fill="#2b9ea5">
            <path d="M36 128 95 71l80-25 30 13c8 18-4 28-21 32-21 5-10 22-17 31-10 14-25-12-38-5-13 6-2 23-16 29-12 5-27-6-34 7-13 24 24 14 22 30-1 12 21 9 20 24-2 15-28 22-38 5l-5-21-30-14Z" />
            <path d="m249 93 27 10c12 6 12 18 27 13l30-11 35 53-15 100-46 24-14-34c-4-15-34-4-37-23-3-16 13-28 0-39-11-10-30 4-32-10-3-14 17-17 20-31 4-16-24-19-16-38 5-13 18-14 21-14Z" />
            <path d="M124 206c23-25 41-9 56-3 21 8 21 24 40 23 19-1 22 16 11 32l-22 35-58-10-10-28-26-14Z" />
          </g>
          <g stroke="#242a28" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m20 144 19 2m-8-35 20 15m-2-38 7 20" />
            <path d="M334 88c-41 29-93 77-80 104 17 35 123 2 153-25 25-23 9-48-10-39-24 11-8 35 10 40" />
          </g>
          <path d="M306 109c-23 18-45 42-51 64m13 26c18 10 50 6 73-1m55-22 8-6" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
          <path d="m343 54 20-14-20-10 6-6 28 7 18-13c12-8 22-4 13 7l-19 16 5 28-7 6-11-23-18 13-3 16-6 4-4-20-13-8 6-5Z" fill="#fbbc18" />
        </svg>
      </aside>
      <section className="member-login-panel" aria-labelledby="member-login-title">
        <h1 id="member-login-title">{t("로그인")}</h1>
        <p className="member-login-intro">{t("이메일로 말모임에 로그인하세요.")}</p>
        <MemberLoginForm locale={locale} />
        <p className="member-login-signup">{t("아직 계정이 없으신가요?")} <Link href={localizedPublicPath("/signup", locale)}>{t("회원가입")}<span aria-hidden="true">›</span></Link></p>
      </section>
    </div>
  </main>;
}
