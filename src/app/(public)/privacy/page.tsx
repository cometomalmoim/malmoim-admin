import type {Metadata} from "next";
import {MemberPrivacyPage} from "@/components/member-privacy-page";
import {publishedMemberLegal} from "@/lib/member-legal";
export const metadata:Metadata={title:"개인정보 처리방침",description:"말모임 개인정보 처리방침 및 회원가입 안내",robots:{index:publishedMemberLegal!==null,follow:true},alternates:{canonical:"/privacy",languages:{"ko-KR":"/privacy",en:"/en/privacy"}}};
export default function Page(){return <MemberPrivacyPage locale="ko"/>;}
