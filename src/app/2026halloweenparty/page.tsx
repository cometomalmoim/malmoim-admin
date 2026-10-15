import type { Metadata } from "next";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import "./party.css";
import { PartyArt } from "./party-art";

import "@/components/landing-design.css";
export const metadata: Metadata = {
  metadataBase: new URL("https://malmoim.com"),
  title: "2026 말모임 할로윈 파티 | 10월 31일, 연신내",
  description: "10월 31일 토요일, 연신내 하이브에서 만나는 말모임 할로윈 소셜 파티. 코스튬, 게임, 그리고 새로운 만남을 함께해요. 참가 신청은 오픈 준비 중입니다.",
  alternates: { canonical: "/2026halloweenparty", languages: { ko: "/2026halloweenparty", en: "/2026halloweenparty/en", "x-default": "/2026halloweenparty" } },
  robots: { index: true, follow: true },
  openGraph: { title: "2026 말모임 할로윈 파티", description: "10.31 SAT · 19:00–24:00 · 24시 이후 자율 뒤풀이 · 연신내 하이브. 코스튬 하나, 새로운 이야기 하나.", url: "/2026halloweenparty", locale: "ko_KR", type: "website" },
};
const schedule = [
  ["19:00", "문을 열어요", "입장 · 자유 시간"],
  ["19:30", "처음 만나는 우리", "오프닝 · 아이스브레이킹"],
  ["20:00", "이야기가 시작되는 시간", "네트워킹"],
  ["20:40", "같이 웃고, 같이 즐기고", "레크리에이션 게임"],
  ["21:30", "오늘의 코스튬은?", "네트워킹 · 코스튬 투표"],
  ["22:10", "무대의 주인공", "코스튬 콘테스트"],
  ["22:50", "아직 끝나지 않은 밤", "애프터 파티"],
  ["23:30", "공식 프로그램 마무리", "클로징 · 정리"],
  ["24:00 이후", "자율 뒤풀이", "희망자 자율 참여"],
];
export default function HalloweenParty() {
  return <div className="hw-page"><a className="hw-skip" href="#hw-main">본문 바로가기</a>
    <header className="hw-header"><Link className="hw-brand" href="/" aria-label="말모임 홈페이지"><BrandLogo compact /></Link><nav aria-label="행사 메뉴"><a href="#party">파티 소개</a><a href="#schedule">타임테이블</a><a href="#apply" className="hw-nav-cta">신청 안내 ↗</a><div className="hw-languages" aria-label="언어 선택"><span aria-current="page" lang="ko">한국어</span><Link href="/2026halloweenparty/en" hrefLang="en" lang="en">English</Link></div></nav></header>
    <main id="hw-main">
      <section className="hw-hero" aria-labelledby="hw-title"><div className="hw-wrap hw-hero-grid"><div className="hw-hero-copy"><span className="hw-pill">MALMOIM · HALLOWEEN SOCIAL PARTY</span><p className="hw-kicker">10.31 SAT / 2026</p><h1 id="hw-title">낯선 얼굴도,<br/>오늘은 <em>친구.</em></h1><p className="hw-intro">코스튬 하나, 새로운 이야기 하나.<br/>말모임의 할로윈 밤에 함께해요.</p><a className="hw-button" href="#apply">참가 신청 안내 보기 <span aria-hidden="true">↗</span></a><p className="hw-small">2026 말모임 할로윈 파티</p></div><div className="hw-hero-art"><PartyArt/><span className="hw-art-note">A LITTLE SPOOKY. A LOT OF FUN.</span></div></div><div className="hw-facts hw-wrap"><div><span>WHEN</span><strong>10월 31일 토요일</strong><p>19:00 입장 · 24:00 이후 자율 뒤풀이</p></div><div><span>WHERE</span><strong>연신내 하이브 HIVE</strong><p>서울 은평구 연서로27길 16-16, 지하 1층</p></div><div><span>DRESS CODE</span><strong>코스튬 권장</strong><p>간단한 소품으로도 함께해요</p></div></div></section>
      <section id="party" className="hw-section hw-wrap"><p className="hw-eyebrow">MEET. PLAY. CONNECT.</p><h2>무서운 건 잠깐,<br/>즐거운 건 오래.</h2><p className="hw-lead">자유롭게 이야기하고, 함께 게임하고, 서로의 코스튬을 발견하는 밤.<br className="hw-desktop"/> 자유 시간과 프로그램을 번갈아 즐기는 소셜 파티예요.</p><div className="hw-programs">{[["01","처음이어도, 편안하게","오프닝 & 아이스브레이킹","파티의 시작은 서로 알아가는 시간으로 준비합니다."],["02","함께라서 더 재밌게","레크리에이션 & 네트워킹","게임과 자유로운 대화를 번갈아 즐겨요."],["03","오늘만큼은 주인공","코스튬 콘테스트","간단한 소품부터 나만의 코스튬까지. 서로의 스타일을 만나보세요."]].map(([n,heading,title,body])=><article key={n}><span className="hw-number">{n}</span><p>{heading}</p><h3>{title}</h3><p>{body}</p></article>)}</div></section>
      <section className="hw-schedule-section" id="schedule"><div className="hw-wrap hw-schedule-grid"><div><p className="hw-eyebrow">ONE NIGHT, MANY MOMENTS</p><h2>우리의 밤은<br/>이렇게 흘러요.</h2><p className="hw-lead">10월 31일 토요일 · 19:00–24:00<br/>24:00 이후 자율 뒤풀이</p><p className="hw-small">예정된 프로그램이며 현장 상황에 따라 변경될 수 있습니다.</p></div><ol className="hw-timeline">{schedule.map(([time,title,type])=><li key={time}><time>{time}</time><div><span>{type}</span><h3>{title}</h3></div></li>)}</ol></div></section>
      <section className="hw-section hw-wrap hw-visit"><div><p className="hw-eyebrow">SEE YOU AT HIVE</p><h2>이번 만남의 장소,<br/>연신내 하이브.</h2><p className="hw-lead">서울 은평구 연서로27길 16-16<br/>지하 1층</p><a className="hw-text-link" href="https://map.naver.com/p/search/%EC%84%9C%EC%9A%B8%20%EC%9D%80%ED%8F%89%EA%B5%AC%20%EC%97%B0%EC%84%9C%EB%A1%9C27%EA%B8%B8%2016-16" target="_blank" rel="noopener noreferrer">지도에서 주소 검색 ↗</a></div><div className="hw-ticket"><span>MALMOIM HALLOWEEN 2026</span><strong>10.31</strong><p>SATURDAY / 19:00–24:00<br/>24:00 이후 자율 뒤풀이</p><hr/><dl><div><dt>장소</dt><dd>연신내 하이브</dd></div><div><dt>복장</dt><dd>코스튬 권장 · 소품 가능</dd></div><div><dt>참가비</dt><dd>추후 안내</dd></div></dl></div></section>
      <section className="hw-apply-section" id="apply"><div className="hw-wrap hw-apply-grid"><div><p className="hw-eyebrow">JOIN THE NIGHT</p><h2>우리, 그날 만나요.</h2><p className="hw-lead">이름과 연락처, 말모임 참가 이력으로<br/>간단하게 신청할 수 있도록 준비 중이에요.</p><span className="hw-status">신청 오픈 준비 중</span><p>참가비와 개인정보 수집 안내가 확정되면<br/>이곳에서 정식 접수를 시작합니다.</p><a className="hw-text-link" href="mailto:cometomalmoim@gmail.com">행사 문의 ↗</a></div><form className="hw-form" aria-label="할로윈 참가 신청 준비 화면"><h3>2026 할로윈 파티 참가 신청</h3><p>아래는 신청 항목 안내입니다. 아직 입력·제출할 수 없습니다.</p><fieldset disabled><label htmlFor="hw-name">이름<input id="hw-name" name="name" autoComplete="name" placeholder="성함을 입력해주세요" required maxLength={100}/></label><label htmlFor="hw-contact">연락처<input id="hw-contact" name="contact" type="tel" autoComplete="tel" placeholder="연락 가능한 전화번호" required maxLength={30}/></label><label htmlFor="hw-history">말모임 참가 이력<select id="hw-history" name="history" defaultValue="" required><option value="" disabled>선택해주세요</option><option value="new">참가한 적 없음</option><option value="returning">참가한 적 있음</option></select></label><label htmlFor="hw-history-detail">참가한 기수·활동명 <small>(선택)</small><input id="hw-history-detail" name="history_detail" maxLength={300} placeholder="참가 경험이 있다면 작성해주세요"/></label><label className="hw-consent"><input type="checkbox" name="privacy_consent" required/><span>개인정보 수집·이용 동의 <small>정식 접수 전 수집 목적·보유기간을 안내합니다.</small></span></label><button type="button" disabled>신청 오픈 준비 중</button></fieldset></form></div></section>
      <section className="hw-section hw-wrap hw-faq"><p className="hw-eyebrow">GOOD TO KNOW</p><h2>궁금한 이야기</h2><details><summary>코스튬을 꼭 준비해야 하나요?</summary><p>코스튬은 권장 사항이며, 간단한 소품으로도 참여할 수 있습니다.</p></details><details><summary>몇 시부터 입장하나요?</summary><p>10월 31일 토요일 19시부터 입장 예정이며, 공식 프로그램 이후 24시부터는 희망자에 한해 자율 뒤풀이로 이어집니다.</p></details><details><summary>참가비와 신청 방법은 어떻게 되나요?</summary><p>참가비는 추후 안내합니다. 현재 신청 폼은 준비 중이며, 접수 조건이 확정되면 정식 신청을 시작합니다.</p></details></section>
    </main><footer className="hw-footer"><Link href="/">MALMOIM · 말모임</Link><p>Come to MALMOIM, Meet the world.</p><a href="mailto:cometomalmoim@gmail.com">cometomalmoim@gmail.com</a></footer><a className="hw-mobile-cta" href="#apply">할로윈 파티 신청 안내 ↗</a>
  </div>;
}
