import type { Metadata } from "next";
import { MemberSignupPage } from "@/components/member-signup-page";
export const metadata: Metadata = { title: "Sign up", robots: { index: false, follow: false } };
export default function Page() { return <MemberSignupPage locale="en" />; }
