import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { BrandLogo } from '@/components/brand-logo';
import { CompactApplication } from '@/components/season9/compact-application';
import { LanguageLink } from '@/components/season9/language-link';
import { season9, season9Additional } from '@/lib/season9';
import './additional.css';

const title = '말모임 9기 추가 모집 | 새로운 대화에 초대합니다';
const description = '영어로 대화하고, 한국어를 나누고, 함께 친구가 되는 시간. 남은 6주 42,000원으로 말모임 9기에 함께하세요.';
export const metadata: Metadata = {
  title, description, alternates: { canonical: '/season9/additional', languages: { ko: '/season9/additional', en: '/season9/additional/en' } },
  openGraph: { title, description, url: '/season9/additional', locale: 'ko_KR', images: [{ url: '/season9/moments/conversation.webp', width: 1600, height: 1200, alt: '함께 대화하는 말모임 참여자들' }] },
  twitter: { card: 'summary_large_image', title, description, images: ['/season9/moments/conversation.webp'] },
};
const experiences = [
  { number: '01', title: '영어로 나누는 이야기', time: '45분', text: '활동지를 따라 소그룹으로 대화해요. 머릿속에만 있던 영어를 실제 대화로 꺼내 보세요.', photo: 'activity-sheets', alt: '활동지를 보며 테이블에서 대화하는 참여자들' },
  { number: '02', title: '서로에게 배우는 한국어', time: '45분', text: '이번에는 한국어로 이야기할 차례. 서로의 언어와 문화를 나누며 조금 더 가까워져요.', photo: 'korean-board', alt: '보드에 적힌 한국어를 함께 배우는 활동' },
  { number: '03', title: '함께 만드는 우리 사이', time: '40분', text: '이야기에서 끝나지 않는 만남. 함께 만드는 그룹 활동으로 새로운 추억을 쌓아요.', photo: 'making-together', alt: '테이블에 둘러앉아 함께 연을 만드는 참여자들' },
];
export default function Page() {
  return <div className="extra-page s9-site" lang="ko">
    <a className="extra-skip" href="#main">본문 바로가기</a>
    <header className="extra-nav"><Link href="/" className="extra-brand extra-brand-logo" aria-label="말모임 홈"><BrandLogo compact/></Link><nav aria-label="페이지 안내"><a href="#experience">어떤 모임인가요?</a><a href="#details">참여 안내</a><span className="extra-language"><LanguageLink english={false} basePath="/season9/additional"/></span><a className="extra-nav-cta" href="#application">신청하기 ↗</a></nav></header>
    <main id="main">
      <section className="extra-hero extra-wrap"><div className="extra-hero-copy"><p className="extra-eyebrow">MALMOIM SEASON 09 · 추가 모집</p><h1>아직 나누지 못한<br/>이야기가 <em>있으니까.</em></h1><p className="extra-lead">영어로 대화하고, 서로의 문화를 나누고.<br/>이번 주의 새로운 만남, 말모임에서 시작해요.</p><a className="extra-button" href="#application">9기 추가 참여 신청하기 <span aria-hidden="true">↗</span></a><p className="extra-note">혼자 와도 괜찮아요. 함께할 마음이면 충분해요.</p><p className="extra-note">더 많은 외국인 멤버와 함께하기 위해 추가 모집합니다.<br/>남은 {season9Additional.weeks}주 · {season9Additional.fee.toLocaleString('ko-KR')}원</p></div><figure className="extra-hero-photo"><Image src="/season9/moments/conversation.webp" alt="테이블에 둘러앉아 웃으며 대화하는 말모임 참여자들" width={1600} height={1200} preload sizes="(max-width: 760px) 100vw, 55vw"/><figcaption>다른 언어, 새로운 친구.<br/><strong>우리의 대화는 계속됩니다.</strong></figcaption><span className="extra-stamp" aria-hidden="true">Come to MALMOIM<br/>Meet the world ↗</span></figure></section>
      <div className="extra-ribbon"><span>LESS SMALL TALK, MORE CONNECTION.</span><span>언어를 넘어, 사람과 사람 사이.</span><span aria-hidden="true">LESS SMALL TALK, MORE CONNECTION.</span></div>
      <section id="experience" className="extra-wrap extra-experience"><div className="extra-section-heading"><p className="extra-eyebrow">A LITTLE LANGUAGE, A LOT OF CONNECTION</p><h2>공부하던 언어가<br/>함께하는 시간이 되는 곳.</h2><p>말모임은 한국인과 외국인 참여자가 함께하는 언어·문화 교류 모임이에요.<br/>유창함보다 중요한 건, 서로의 이야기에 귀 기울이는 마음이에요.</p></div><div className="extra-cards">{experiences.map(item => <article key={item.number}><div className="extra-card-photo"><Image src={`/season9/moments/${item.photo}.webp`} alt={item.alt} width={1200} height={900} sizes="(max-width: 760px) 100vw, 33vw"/><span>{item.number}</span></div><h3>{item.title}<small>{item.time}</small></h3><p>{item.text}</p></article>)}</div><p className="extra-note">모임은 총 2시간 30분이며, 중간 쉬는 시간 10분씩 2회가 포함돼요.</p></section>
      <section id="details" className="extra-details"><div className="extra-wrap extra-details-grid"><div><p className="extra-eyebrow">YOUR NEXT CHAPTER</p><h2>새로운 만남을 위한<br/>작은 한 걸음.</h2><p>더 많은 외국인 멤버와 함께하기 위해 추가 모집해요. 남은 6주 동안 언어와 문화를 나누며 새로운 친구를 만나보세요. 합류 가능한 반과 첫 참여 일정은 운영진이 안내해 드려요.</p><Link className="extra-text-link" href="/inquiries/new?event=season9&lang=ko">중간 참여 문의하기 ↗</Link></div><dl><div><dt>모임 시간</dt><dd>목요일 {season9.thursday.time}<br/>토요일 {season9.saturday.time}<small>희망반 주 1회 · 한국 시간 기준</small></dd></div><div><dt>만나는 곳</dt><dd>서울청년센터 은평<small>서울 은평구 통일로67길 9 · 장소 변경 시 별도 안내</small></dd></div><div><dt>참가비</dt><dd>{season9Additional.fee.toLocaleString('ko-KR')}원<small>남은 {season9Additional.weeks}주 · 희망반 주 1회</small></dd></div><div><dt>참가 확정</dt><dd>신청 → 운영진 확인·선발 → 확정·납부 안내<small>신청만으로 참가가 확정되지는 않아요. 활동 시작 후 환불은 불가해요.</small></dd></div></dl></div></section>
      <section className="extra-wrap extra-faq"><div><p className="extra-eyebrow">BEFORE WE SAY HELLO</p><h2>처음이라 궁금한 것들.</h2></div><div>{[
        ['혼자 신청해도 괜찮나요?', '네, 혼자 신청해도 참여할 수 있어요. 소그룹 대화와 함께하는 활동으로 서로 알아가요.'],
        ['영어를 유창하게 해야 하나요?', '유창함보다 서로 대화하려는 마음으로 함께해요. 활동지를 활용해 이야기를 나눠요. 참여 수준에 관한 구체적인 질문은 운영진에게 문의해 주세요.'],
        ['이미 시작했는데 참여할 수 있나요?', '네, 남은 6주 동안 참가비 42,000원으로 함께할 수 있어요. 신청 후 운영진이 합류 가능한 반과 첫 참여 일정을 안내해 드려요.'],
        ['신청 후에는 어떻게 진행되나요?', '운영진 확인·선발 후 입력하신 연락처로 참가 확정과 납부 안내를 보내드려요. 현재 접수 가능 여부는 아래 신청 폼에서 확인할 수 있어요.'],
      ].map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div></section>
      <section id="application" className="extra-application"><div className="extra-wrap extra-application-grid"><div><p className="extra-eyebrow">LET’S MEET AT MALMOIM</p><h2>다음 이야기에는<br/><em>당신도 함께.</em></h2><p>기본 정보와 희망반을 남겨주세요.<br/>운영진이 확인 후 안내해 드릴게요.</p><Link className="extra-text-link" href="/inquiries/new?event=season9&lang=ko">궁금한 점 문의하기 ↗</Link><span className="extra-text-link"><LanguageLink english={false} basePath="/season9/additional"/></span></div><CompactApplication locale="ko" additional/></div></section>
    </main><footer className="extra-wrap extra-footer"><Link className="extra-brand" href="/">말모임<span>MALMOIM</span></Link><p>Come to MALMOIM, Meet the world.</p><a href="https://www.instagram.com/cometomalmoim/" target="_blank" rel="noopener noreferrer">Instagram ↗</a></footer>
  </div>;
}
