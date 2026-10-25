import type {Metadata} from "next";
import {MemberLegalPage} from "@/components/member-legal-page";
import {getPublishedMemberDocument} from "@/lib/member-legal";
export const metadata:Metadata={title:"개인정보 처리방침",description:"말모임 개인정보 처리방침",robots:{index:getPublishedMemberDocument("privacy")!==null,follow:true},alternates:{canonical:"/privacy",languages:{"ko-KR":"/privacy",en:"/en/privacy"}}};
export default function Page(){return <MemberLegalPage kind="privacy" locale="ko"/>;}
