import type { PublicLocale } from "./public-content";

type LocalizedText = Record<PublicLocale, string>;
export type ActivityCategory = "study" | "event";
export type PublicActivity = {
  id: string;
  category: ActivityCategory;
  title: LocalizedText;
  description: LocalizedText;
  schedule: LocalizedText[];
  location: LocalizedText;
  address?: LocalizedText;
  price: LocalizedText;
  note: LocalizedText;
  image?: string;
  imageCaption: LocalizedText;
  href: string;
  // Editorial information only; this does not assert that applications are open.
  status: LocalizedText;
  // Concise list copy; full schedule, fees and other details remain above.
  summary?: { description: LocalizedText; schedule: LocalizedText; location?: LocalizedText };
};

// Add one bilingual object here to publish another card. No DB or intake state.
// The requested Saturday study time differs from the existing recruitment page.
export const publicActivities: PublicActivity[] = [
  {
    id: "season9",
    summary: {
      description: { ko: "언어로 연결되는 일곱 번의 만남", en: "Seven sessions connected through language" },
      schedule: { ko: "2026.11.12 / 11.14 시작 · 7주간", en: "Starts Nov 12 / Nov 14, 2026 · 7 weeks" },
    },
    category: "study",
    title: { ko: "말모임 9기", en: "MALMOIM Season 9" },
    description: {
      ko: "한국인과 외국인이 함께 영어와 한국어를 배우고, 다양한 문화를 교류하는 7주간의 언어교환 스터디",
      en: "Seven weeks of Korean–English language exchange and cultural connections with Korean and international friends.",
    },
    schedule: [
      { ko: "2026년 11월 12일부터 7주간 · 주 1회, 총 7회", en: "Seven weeks from November 12, 2026 · Weekly, 7 sessions" },
      { ko: "목요일반 · 11월 12일 시작 · 18:30–21:00", en: "Thursday group · Starts November 12 · 18:30–21:00" },
      { ko: "토요일반 · 11월 14일 시작 · 13:30–16:00", en: "Saturday group · Starts November 14 · 13:30–16:00" },
    ],
    location: { ko: "서울청년센터 은평", en: "Seoul Youth Center Eunpyeong" },
    price: { ko: "7주 전체(총 7회) 50,000원", en: "KRW 50,000 total for all 7 weeks (7 sessions)" },
    note: { ko: "신청 후 운영진 확인·선발을 거쳐 참가가 확정됩니다", en: "Participation is confirmed after organizer review and selection" },
    // Past activity photo avoids repeating the old Saturday time on the poster.
    image: "/season9/activity-01.jpg",
    imageCaption: { ko: "언어로 시작되는 일곱 번의 만남", en: "Seven sessions. New connections." },
    href: "/season9",
    status: { ko: "일정 안내", en: "Schedule announced" },
  },
  {
    id: "halloween-2026",
    summary: {
      description: { ko: "코스튬 하나, 새로운 이야기 하나", en: "One costume. A new story." },
      schedule: { ko: "2026.10.31 (토) · 19:00", en: "Oct 31, 2026 (Sat) · 19:00" },
      location: { ko: "연신내 하이브", en: "HIVE, Yeonsinnae" },
    },
    category: "event",
    title: { ko: "2026 말모임 할로윈 파티", en: "MALMOIM Halloween Party 2026" },
    description: {
      ko: "새로운 사람들과 함께하는 할로윈 소셜 파티. 네트워킹, 레크리에이션, 코스튬 콘테스트를 함께 즐겨요.",
      en: "Meet new people at a Halloween social party with networking, games, and a costume contest.",
    },
    schedule: [{ ko: "2026년 10월 31일 토요일 · 19:00–23:30", en: "Saturday, October 31, 2026 · 19:00–23:30" }],
    location: { ko: "연신내 하이브(HIVE)", en: "HIVE, Yeonsinnae" },
    address: { ko: "서울 은평구 연서로27길 16-16, 지하 1층", en: "B1, 16-16 Yeonseo-ro 27-gil, Eunpyeong-gu, Seoul" },
    price: { ko: "일반 참가 30,000원", en: "General admission KRW 30,000" },
    note: { ko: "코스튬 권장 · 간단한 소품으로도 함께해요", en: "Costumes encouraged · Simple accessories welcome" },
    // Friendly local vector artwork; no embedded prices or schedule text.
    image: "/events/halloween-2026/party-friends.svg",
    imageCaption: { ko: "코스튬 하나, 새로운 이야기 하나", en: "One costume. A new story." },
    href: "/2026halloweenparty",
    status: { ko: "일정 안내", en: "Schedule announced" },
  },
];
