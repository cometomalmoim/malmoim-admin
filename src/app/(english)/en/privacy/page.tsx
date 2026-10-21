import type {Metadata} from "next";
import {MemberPrivacyPage} from "@/components/member-privacy-page";
import {publishedMemberLegal} from "@/lib/member-legal";
export const metadata:Metadata={title:"Privacy Policy",description:"MALMOIM privacy policy and member registration information",robots:{index:publishedMemberLegal!==null,follow:true},alternates:{canonical:"/en/privacy",languages:{"ko-KR":"/privacy",en:"/en/privacy"}}};
export default function Page(){return <MemberPrivacyPage locale="en"/>;}
