import type {Metadata} from "next";
import {MemberLegalPage} from "@/components/member-legal-page";
import {getPublishedMemberDocument} from "@/lib/member-legal";
export const metadata:Metadata={title:"Privacy Policy",description:"MALMOIM Privacy Policy",robots:{index:getPublishedMemberDocument("privacy")!==null,follow:true},alternates:{canonical:"/en/privacy",languages:{"ko-KR":"/privacy",en:"/en/privacy"}}};
export default function Page(){return <MemberLegalPage kind="privacy" locale="en"/>;}
