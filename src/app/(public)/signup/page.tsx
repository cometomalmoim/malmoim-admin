import type { Metadata } from "next";
import { MemberSignupPage } from "@/components/member-signup-page";
export const metadata: Metadata = { title: "회원가입", robots: { index: false, follow: false } };
export default function Page() { return <MemberSignupPage locale="ko" />; }
