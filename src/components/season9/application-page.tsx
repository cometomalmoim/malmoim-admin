import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { InstantApplication } from "./instant-application";
import type { SeasonLocale } from "@/lib/season9";
export function ApplicationPage({ locale }: { locale: SeasonLocale }) {
 const en = locale === "en";
 return <div className="s9-site s9-apply-site" lang={locale}><a className="s9-skip" href="#application-main">{en ? "Skip to content" : "본문 바로가기"}</a><header className="s9-header"><Link href={en ? "/season9/en" : "/season9"} className="s9-logo" aria-label={en ? "Back to Season 9" : "9기 모집 안내로"}><BrandLogo compact/></Link><Link className="s9-return" href={en ? "/season9/en" : "/season9"}>{en ? "← Program details" : "← 모집 안내"}</Link></header><main id="application-main" className="s9-apply-main"><span className="s9-kicker">MALMOIM · SEASON 09</span><h1>{en ? "Season 9 application" : "말모임 9기 신청"}</h1><p>{en ? "Explore the application in five short steps. No registration required." : "회원가입 없이, 짧은 5단계로 신청서를 확인하세요."}</p><InstantApplication locale={locale}/></main></div>;
}
