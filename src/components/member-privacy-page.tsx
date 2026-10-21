import Link from "next/link";
import {publishedMemberLegal} from "@/lib/member-legal";
import {localizedPublicPath} from "@/lib/public-locale";
import type {PublicLocale} from "@/lib/public-content";
import {MemberLegalContent} from "./member-legal-content";
import "./member-privacy.css";

export function MemberPrivacyPage({locale="ko"}:{locale?:PublicLocale}){
 const en=locale==="en",policy=publishedMemberLegal?.privacy;
 return <main id="public-main" className="member-privacy" lang={locale} tabIndex={-1}>
  <Link href={localizedPublicPath("/",locale)}>{en?"← Home":"← 홈으로"}</Link>
  <h1>{en?"Privacy Policy":"개인정보 처리방침"}</h1>
  <div className={!policy?"member-privacy-status":undefined}>
   <MemberLegalContent document={policy??null} locale={locale}/>
   {!policy&&<Link href={localizedPublicPath("/signup",locale)}>{en?"View registration information":"회원가입 안내 보기"}</Link>}
  </div>
 </main>;
}
