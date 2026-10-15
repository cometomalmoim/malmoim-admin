import type { Metadata } from "next";
import { MemberLoginPage } from "@/components/member-login-page";
export const metadata: Metadata = { title: "로그인", description: "이메일과 비밀번호로 말모임에 로그인하세요.", robots: { index: false, follow: false } };
export default function Page() { return <MemberLoginPage locale="ko" />; }
