import type { Metadata } from "next";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = {
  title: "로그인",
  robots: { index: false, follow: false },
};

export default function MemberLoginPage() {
  return <main id="public-main" className="public-login" tabIndex={-1}>
    <section className="login-card" aria-labelledby="member-login-title">
      <BrandLogo />
      <div className="intro">
        <span className="eyebrow">말모임에 오신 것을 환영합니다</span>
        <h1 id="member-login-title">로그인</h1>
        <p>이메일과 비밀번호로 로그인해주세요.</p>
      </div>
      <LoginForm audience="member" />
      <Link className="preview-link" href="/signup">아직 계정이 없나요? 회원가입</Link>
      <Link className="preview-link" href="/">홈으로 돌아가기</Link>
    </section>
  </main>;
}
