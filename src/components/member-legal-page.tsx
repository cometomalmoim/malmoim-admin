import Link from "next/link";
import {getPublishedMemberDocument,type MemberLegalKind} from "@/lib/member-legal";
import {localizedPublicPath} from "@/lib/public-locale";
import type {PublicLocale} from "@/lib/public-content";
import {MemberLegalContent} from "./member-legal-content";
import "./member-privacy.css";

export function MemberLegalPage({locale="ko",kind}:{locale?:PublicLocale;kind:MemberLegalKind}){
 const en=locale==="en",policy=getPublishedMemberDocument(kind);
 const title=policy?.title?.[locale]??(kind==="privacy"?(en?"Privacy Policy":"개인정보 처리방침"):(en?"Terms of Service":"서비스 이용약관"));
 return <main id="public-main" className="member-privacy" lang={locale} tabIndex={-1}>
  <Link href={localizedPublicPath("/",locale)}>{en?"← Home":"← 홈으로"}</Link>
  <h1>{title}</h1>
  <div className={!policy?"member-privacy-status":undefined}>
   <MemberLegalContent document={policy??null} locale={locale} kind={kind}/>
   {!policy&&<Link href={localizedPublicPath("/signup",locale)}>{en?"View registration information":"회원가입 안내 보기"}</Link>}
  </div>
 </main>;
}
