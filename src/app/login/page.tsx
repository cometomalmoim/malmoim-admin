import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { LoginForm } from "@/components/login-form";
export default function LoginPage() { return <main className="login-page"><section className="login-card" aria-labelledby="login-title"><BrandLogo /><div className="intro"><span className="eyebrow">운영 관리 공간</span><h1 id="login-title">말모임 Admin</h1><p>함께 만나는 즐거움, 더 편리하게 관리하세요.</p></div><LoginForm />{process.env.NODE_ENV === "development" && <Link className="preview-link" href="/preview/admin">어드민 디자인 미리보기 ↗</Link>}</section><p className="footer">MALMOIM · 운영자를 위한 공간</p></main>; }
