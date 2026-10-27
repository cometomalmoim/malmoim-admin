import type { PublicLocale } from './public-content';
import { season9 } from './season9';
export type HomeWords = { ko: string; en: string };
export const homeWords = (words: HomeWords, locale: PublicLocale) => words[locale];
const words = (ko: string, en: string): HomeWords => ({ ko, en });
export const homePhotos = {
  hero: { src: '/home/moments/conversation.webp', width: 1600, height: 1200, alt: words('테이블에 둘러앉아 함께 웃으며 대화하는 말모임 참여자들', 'MALMOIM participants laughing and talking around a table') },
  intro: { src: '/home/moments/table-talk.webp', width: 1200, height: 1600, alt: words('활동지를 펼쳐 놓고 서로의 이야기에 귀 기울이는 참여자들', 'Participants listening to one another with activity sheets on the table') },
  session: { src: '/home/moments/session.webp', width: 1600, height: 1200, alt: words('화이트보드와 활동지를 활용해 소그룹으로 대화하는 참여자들', 'A small group talking with activity sheets and a whiteboard') },
  outdoors: { src: '/home/moments/outdoors.webp', width: 1600, height: 1200, alt: words('나무가 있는 야외에서 말모임 현수막을 들고 함께 기념사진을 찍는 참여자들', 'Participants holding a MALMOIM banner for a group photo outdoors') },
  night: { src: '/home/moments/night-together.webp', width: 1600, height: 900, alt: words('밤에 야외에서 스파클러를 들고 함께 시간을 보내는 참여자들', 'Participants spending an evening together outdoors with sparklers') },
  table: { src: '/home/moments/at-the-table.webp', width: 1600, height: 1200, alt: words('식탁에 둘러앉아 함께 기념사진을 찍는 참여자들', 'Participants gathered around a dining table for a photo') },
  making: { src: '/home/moments/making.webp', width: 1200, height: 1600, alt: words('함께 웃으며 종이와 막대로 연을 만드는 참여자들', 'Participants smiling while making a kite with paper and sticks') },
  group: { src: '/home/moments/group.webp', width: 1600, height: 1159, alt: words('모임 공간에서 함께 단체사진을 찍는 참여자들', 'Participants posing together in the meeting space') },
} as const;
export const homeActivities = [
  { id: 'outdoors', label: words('특별 야외행사', 'Outdoor events'), title: words('새로운 장소에서\n함께하는 시간', 'New places.\nShared experiences.'), description: words('일상을 벗어나 다양한 장소에서 만나고 교류합니다.', 'Step out of the everyday to meet and connect in different places.'), motif: 'OUT\n& ABOUT', tone: 'sky' },
  { id: 'party', label: words('파티', 'Parties'), title: words('함께여서\n더 즐거운 파티', 'Good company.\nGreat moments.'), description: words('새로운 사람들과 어울리며 즐거운 순간을 나눕니다.', 'Meet new people and share moments of joy together.'), motif: 'HELLO,\nFRIENDS!', tone: 'yellow' },
  { id: 'festival', label: words('축제 참여 및 부스 운영', 'Festivals & community booths'), title: words('축제 속에서\n만나는 말모임', 'Meet MALMOIM\nat the festival.'), description: words('축제에 참여하고 부스를 운영하며 다양한 사람들을 만납니다.', 'Take part in festivals and run booths, connecting with people along the way.'), motif: 'MEET\nMALMOIM', tone: 'cream' },
  { id: 'mt', label: words('MT', 'Community getaways'), title: words('더 가까워지는 우리', 'A little closer, together.'), description: words('함께 시간을 보내며 말모임의 새로운 추억을 만듭니다.', 'Spend time together and make new MALMOIM memories.'), motif: 'CLOSER\nTOGETHER', tone: 'blue' },
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
