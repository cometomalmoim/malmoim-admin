import type { Metadata } from "next";
import { MemberLoginPage } from "@/components/member-login-page";
export const metadata: Metadata = { title: "Log in", description: "Log in to MALMOIM with your email and password.", robots: { index: false, follow: false } };
export default function Page() { return <MemberLoginPage locale="en" />; }
