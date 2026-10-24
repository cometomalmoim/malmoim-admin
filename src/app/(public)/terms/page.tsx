import type {Metadata} from "next";
import {MemberLegalPage} from "@/components/member-legal-page";
import {getPublishedMemberDocument} from "@/lib/member-legal";
export const metadata:Metadata={title:"서비스 이용약관",description:"말모임 서비스 이용약관",robots:{index:getPublishedMemberDocument("terms")!==null,follow:true},alternates:{canonical:"/terms",languages:{"ko-KR":"/terms",en:"/en/terms"}}};
export default function Page(){return <MemberLegalPage kind="terms" locale="ko"/>;}
