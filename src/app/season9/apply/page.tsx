import type { Metadata } from "next";
import { ApplicationPage } from "@/components/season9/application-page";
export const metadata: Metadata = { title: "말모임 9기 신청", robots: { index: false, follow: false } };
export default function Page() { return <ApplicationPage locale="ko"/>; }
