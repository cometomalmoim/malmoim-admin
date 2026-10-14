import type { Metadata } from "next";
import { ApplicationPage } from "@/components/season9/application-page";
export const metadata: Metadata = { title: "Apply for MALMOIM Season 9", robots: { index: false, follow: false } };
export default function Page() { return <ApplicationPage locale="en"/>; }
