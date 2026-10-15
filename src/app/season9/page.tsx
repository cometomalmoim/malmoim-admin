import type { Metadata } from "next";
import { SeasonLanding } from "@/components/season9/season-landing";
export const metadata: Metadata = { title: "말모임 9기 모집", description: "6번의 만남으로 이어지는 언어·문화 교류. 말모임 9기 목요일반과 토요일반 안내.", alternates: { canonical: "/season9", languages: { ko: "/season9", en: "/season9/en" } } };
export default function Page() { return <SeasonLanding locale="ko" />; }
