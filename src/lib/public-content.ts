export const publicPages = [
  { slug: "about", title: "말모임 소개", intro: "언어를 통해 만나는 새로운 세계", description: "말모임의 소개와 참여 안내를 확인하는 공간입니다.", empty: "자세한 소개와 참여 방법을 준비하고 있습니다." },
  { slug: "events", title: "스터디·이벤트", intro: "함께 배우고, 함께 만나는 시간", description: "스터디와 이벤트 안내를 모아 전해드립니다.", empty: "말모임 9기 스터디와 2026 할로윈 파티를 만나보세요. 일정과 자세한 참여 안내를 확인할 수 있습니다." },
  { slug: "daily", title: "일일참여 신청하기", intro: "하루의 대화로 만나는 말모임", description: "말모임 9기 목·토 모임에 하루씩 참여해보세요. 1회 12,000원, 홈페이지에서 직접 신청할 수 있습니다.", empty: "" },
  { slug: "exchange", title: "1:1 언어교환", intro: "서로의 언어로 이어지는 대화", description: "희망 언어와 가능한 시간에 맞춰 운영진이 언어교환 파트너를 찾아드립니다.", empty: "참여 방법과 운영 안내를 준비하고 있습니다." },
  { slug: "board", title: "게시판", intro: "말모임의 이야기를 나누는 공간", description: "공지와 함께 나눌 이야기를 확인할 수 있는 공간입니다.", empty: "아직 공개된 게시글이 없습니다. 게시판 안내를 준비하고 있습니다." },
  { slug: "history", title: "말모임 히스토리", intro: "지나온 만남을 기억하는 곳", description: "말모임의 지난 활동을 소개하는 공간입니다.", empty: "공개할 활동 기록을 준비하고 있습니다." },
] as const;

export type PublicLocale = "ko" | "en";
export const publicEnglishPages = [
  { slug: "about", title: "About MALMOIM", intro: "Discover a new world through language", description: "Get to know MALMOIM and learn how to take part.", empty: "Our introduction and participation guide are coming soon." },
  { slug: "events", title: "Studies & Events", intro: "Learn together. Meet each other.", description: "Explore information about our study groups and events.", empty: "Discover MALMOIM Season 9 and our Halloween Party 2026. Explore schedules and details on how to take part." },
  { slug: "daily", title: "Join a Session", intro: "One day. New connections.", description: "Join a Thursday or Saturday Season 9 gathering for KRW 12,000 per session. Apply directly on our website.", empty: "" },
  { slug: "exchange", title: "1:1 Language Exchange", intro: "Connect through each other’s languages", description: "Request a language partner based on your languages, schedule and meeting preferences.", empty: "Our participation guide and program details are coming soon." },
  { slug: "board", title: "Community Board", intro: "A space for our community’s stories", description: "Find announcements and stories from MALMOIM.", empty: "No posts have been published yet. Our community board is being prepared." },
  { slug: "history", title: "Our History", intro: "Remember the connections we’ve made", description: "Discover MALMOIM’s past activities.", empty: "Our activity archive is being prepared for you." },
] as const;
export function getPublicPages(locale: PublicLocale) { return locale === "en" ? publicEnglishPages : publicPages; }
export function publicPath(locale: PublicLocale, slug = "") { return locale === "en" ? `/en${slug ? `/${slug}` : ""}` : `/${slug}`; }
