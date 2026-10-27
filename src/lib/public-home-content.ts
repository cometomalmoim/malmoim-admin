import type { PublicLocale } from './public-content';
import { season9 } from './season9';
export type HomeWords = { ko: string; en: string };
export const homeWords = (words: HomeWords, locale: PublicLocale) => words[locale];
const words = (ko: string, en: string): HomeWords => ({ ko, en });
export const homePhotos = {
  hero: { src: '/home/moments/hero-group.webp', width: 1600, height: 1159, alt: words('모임 공간에서 함께 기념사진을 찍는 말모임 참여자들', 'MALMOIM participants posing for a group photo in the meeting space') },
  intro: { src: '/home/moments/intro-whiteboard.webp', width: 1220, height: 1600, alt: words('화이트보드를 들어 보이며 함께 활동하는 참여자들', 'Participants taking part in a group activity with a whiteboard') },
  session: { src: '/home/moments/regular-session.webp', width: 1600, height: 1200, alt: words('정규 세션에서 테이블에 둘러앉아 활동지를 들어 보이는 참여자들', 'Participants sitting around a table and holding up activity sheets during a regular session') },
  outdoors: { src: '/home/moments/outdoors-banner.webp', width: 1200, height: 1600, alt: words('나무가 있는 야외에서 말모임 현수막을 함께 들고 있는 참여자들', 'Participants holding a MALMOIM banner together outdoors among the trees') },
  party: { src: '/home/moments/party-table.webp', width: 1600, height: 1200, alt: words('식탁에 둘러앉아 함께 기념사진을 찍는 말모임 참여자들', 'MALMOIM participants gathered around a dining table for a photo') },
  festival: { src: '/home/moments/festival-booth.webp', width: 1600, height: 1200, alt: words('축제 현장의 말모임 체험 부스에서 함께 사진을 찍는 참여자들', 'Participants posing at the MALMOIM activity booth at a festival') },
  mt: { src: '/home/moments/mt-sparklers.webp', width: 1600, height: 900, alt: words('밤에 야외에서 스파클러를 들고 함께하는 참여자들', 'Participants spending an evening outdoors together with sparklers') },
  group: { src: '/home/moments/program-session.webp', width: 1600, height: 1200, alt: words('모임 공간에서 여러 소그룹으로 나뉘어 활동하는 참여자들', 'Participants taking part in small-group activities in the meeting space') },
  hanbok: { src: '/home/moments/gallery-hanbok.webp', width: 1600, height: 1200, alt: words('한복을 입고 청사초롱 장식 아래 함께 서 있는 참여자들', 'Participants wearing hanbok and posing together beneath lantern decorations') },
  conversation: { src: '/home/moments/gallery-conversation.webp', width: 1200, height: 1600, alt: words('테이블에 둘러앉아 활동지를 함께 보며 대화하는 참여자들', 'Participants talking around a table while looking at activity sheets together') },
  outing: { src: '/home/moments/gallery-outing.webp', width: 1200, height: 1600, alt: words('한옥 건물 앞에서 말모임 현수막을 들고 기념사진을 찍는 참여자들', 'Participants holding a MALMOIM banner for a group photo in front of a hanok building') },
} as const;
export const homeActivities = [
  { id: 'outdoors', label: words('특별 야외행사', 'Outdoor events'), title: words('새로운 장소에서\n함께하는 시간', 'New places.\nShared experiences.'), description: words('일상을 벗어나 다양한 장소에서 만나고 교류합니다.', 'Step out of the everyday to meet and connect in different places.'), photo: homePhotos.outdoors, tone: 'sky' },
  { id: 'party', label: words('파티', 'Parties'), title: words('함께여서\n더 즐거운 파티', 'Good company.\nGreat moments.'), description: words('새로운 사람들과 어울리며 즐거운 순간을 나눕니다.', 'Meet new people and share moments of joy together.'), photo: homePhotos.party, tone: 'yellow' },
  { id: 'festival', label: words('축제 참여 및 부스 운영', 'Festivals & community booths'), title: words('축제 속에서\n만나는 말모임', 'Meet MALMOIM\nat the festival.'), description: words('축제에 참여하고 부스를 운영하며 다양한 사람들을 만납니다.', 'Take part in festivals and run booths, connecting with people along the way.'), photo: homePhotos.festival, tone: 'cream' },
  { id: 'mt', label: words('MT', 'Community getaways'), title: words('더 가까워지는 우리', 'A little closer, together.'), description: words('함께 시간을 보내며 말모임의 새로운 추억을 만듭니다.', 'Spend time together and make new MALMOIM memories.'), photo: homePhotos.mt, tone: 'blue' },
] as const;
// Edit upcoming programs here. Existing application/registration logic remains in the Season 9 routes.
export const homePrograms = [{
  id: 'season9', visible: true, title: words('말모임 9기', 'MALMOIM Season 9'),
  description: words('언어를 나누는 대화가 새로운 만남의 시작이 됩니다.', 'A conversation in another language can be the start of a new friendship.'),
  image: homePhotos.group, duration: words('6주 프로그램', '6-week program'), fee: season9.fee,
  href: { ko: '/season9', en: '/season9/en' }, closesAt: season9.closesAt, intakeEnabled: season9.intakeEnabled,
}] as const;
export function isHomeProgramOpen(program: { visible: boolean; intakeEnabled: boolean; closesAt: string }, now: number) {
  return program.visible && program.intakeEnabled && now < Date.parse(program.closesAt);
}
export const homeContact = 'https://www.instagram.com/cometomalmoim/';
export const homeAudience = [
  { label: words('한국인 참여자', 'For Korean participants'), title: words('언어 너머의\n새로운 친구를 만나요.', 'New languages.\nNew friendships.'), points: [words('외국어를 자연스럽게 연습하고 싶은 분', 'Practice another language in real conversations'), words('다양한 나라의 친구들을 만나고 싶은 분', 'Make friends from different countries'), words('새로운 문화와 활동을 경험하고 싶은 분', 'Explore new cultures and experiences')] },
  { label: words('외국인 참여자', 'For international participants'), title: words('한국에서의 이야기를\n함께 만들어가요.', 'Make Korea part\nof your story.'), points: [words('한국어로 대화하며 연습하고 싶은 분', 'Build confidence speaking Korean'), words('한국인 친구를 만나고 싶은 분', 'Make Korean friends'), words('한국에서 다양한 경험과 교류를 하고 싶은 분', 'Share new experiences and connections in Korea')] },
];
