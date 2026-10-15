import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { InstantApplication } from "./instant-application";
export function ApplicationPage() {
 return <div className="s9-site s9-apply-site" lang="ko"><a className="s9-skip" href="#application-main">본문 바로가기 / Skip to content</a><header className="s9-header"><Link href="/season9" className="s9-logo" aria-label="9기 모집 안내 / Season 9 details"><BrandLogo compact/></Link><nav className="s9-apply-languages" aria-label="모집 안내 언어 / Program languages"><Link href="/season9">모집 안내</Link><Link href="/season9/en" lang="en">Program details</Link></nav></header><main id="application-main" className="s9-apply-main"><span className="s9-kicker">MALMOIM · SEASON 09</span><h1>말모임 9기 신청<br/><span lang="en">Season 9 application</span></h1><p>회원가입 없이 짧은 5단계로 신청서를 확인하세요.<br/><span lang="en">Explore the application in five short steps. No registration required.</span></p><InstantApplication/></main></div>;
}
