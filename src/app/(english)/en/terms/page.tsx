import type {Metadata} from "next";
import {MemberLegalPage} from "@/components/member-legal-page";
import {getPublishedMemberDocument} from "@/lib/member-legal";
export const metadata:Metadata={title:"Terms of Service",description:"MALMOIM Terms of Service",robots:{index:getPublishedMemberDocument("terms")!==null,follow:true},alternates:{canonical:"/en/terms",languages:{"ko-KR":"/terms",en:"/en/terms"}}};
export default function Page(){return <MemberLegalPage kind="terms" locale="en"/>;}
