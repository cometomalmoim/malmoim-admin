import type { Metadata } from "next";
import { SeasonLanding } from "@/components/season9/season-landing";
export const metadata: Metadata = { title: "Join MALMOIM Season 9", description: "Six sessions of language and cultural exchange. Explore MALMOIM Season 9 Thursday and Saturday groups.", alternates: { canonical: "/season9/en", languages: { ko: "/season9", en: "/season9/en" } } };
export default function Page() { return <SeasonLanding locale="en" />; }
