import { EventRegistrationForm } from '@/components/event-registration-form';
import type { Metadata } from "next";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import "../party.css";
import { PartyArt } from "../party-art";

import "@/components/landing-design.css";
export const metadata: Metadata = {
  metadataBase: new URL("https://malmoim.com"),
  title: "MALMOIM Halloween Party 2026 | October 31, Yeonsinnae",
  description: "Join MALMOIM for a Halloween social party on Saturday, October 31 at HIVE in Yeonsinnae, Seoul. Costumes, games and new connections. Registration is coming soon.",
  alternates: { canonical: "/2026halloweenparty/en", languages: { ko: "/2026halloweenparty", en: "/2026halloweenparty/en", "x-default": "/2026halloweenparty" } },
  robots: { index: true, follow: true },
  openGraph: { title: "MALMOIM Halloween Party 2026", description: "OCT 31 SAT · 7 PM–midnight · Optional after-party from midnight · HIVE, Yeonsinnae.", url: "/2026halloweenparty/en", locale: "en_US", type: "website" },
};
const schedule = [
  ["19:00", "Welcome in", "Doors open · Free time"],
  ["19:30", "Let’s break the ice", "Opening · Icebreakers"],
  ["20:00", "Let the conversations begin", "Mingling"],
  ["20:40", "Play, laugh, connect", "Group games"],
  ["21:30", "Pick your favorite costume", "Mingling · Costume voting"],
  ["22:10", "Time to shine", "Costume contest"],
  ["22:50", "Keep the night going", "After-party"],
  ["23:30", "Wrapping up the main event", "Closing · Wrap-up"],
  ["From midnight", "Optional after-party", "Join independently if you wish"],
];
export default function HalloweenParty() {
  return <div className="hw-page" lang="en"><a className="hw-skip" href="#hw-main">Skip to content</a>
    <header className="hw-header"><Link className="hw-brand" href="/" aria-label="MALMOIM home"><BrandLogo compact /></Link><nav aria-label="Party navigation"><a href="#party">The party</a><a href="#schedule">Schedule</a><a href="#apply" className="hw-nav-cta">Registration ↗</a><div className="hw-languages" aria-label="Choose language"><Link href="/2026halloweenparty" hrefLang="ko" lang="ko">한국어</Link><span aria-current="page" lang="en">English</span></div></nav></header>
    <main id="hw-main">
      <section className="hw-hero" aria-labelledby="hw-title"><div className="hw-wrap hw-hero-grid"><div className="hw-hero-copy"><span className="hw-pill">MALMOIM · HALLOWEEN SOCIAL PARTY</span><p className="hw-kicker">10.31 SAT / 2026</p><h1 id="hw-title">New faces.<br/>New <em>friends.</em></h1><p className="hw-intro">Bring a costume. Start a conversation.<br/>Spend Halloween night with MALMOIM.</p><a className="hw-button" href="#apply">Registration details <span aria-hidden="true">↗</span></a><p className="hw-small">MALMOIM Halloween Party 2026</p></div><div className="hw-hero-art"><PartyArt title="A pumpkin and ghost celebrating Halloween"/><span className="hw-art-note">A LITTLE SPOOKY. A LOT OF FUN.</span></div></div><div className="hw-facts hw-wrap"><div><span>WHEN</span><strong>Saturday, October 31</strong><p>Doors open at 7 PM · Optional after-party from midnight</p></div><div><span>WHERE</span><strong>HIVE, Yeonsinnae</strong><p>B1, 16-16 Yeonseo-ro 27-gil, Eunpyeong-gu, Seoul</p></div><div><span>DRESS CODE</span><strong>Costumes encouraged</strong><p>A simple accessory is welcome, too</p></div></div></section>
      <section id="party" className="hw-section hw-wrap"><p className="hw-eyebrow">MEET. PLAY. CONNECT.</p><h2>A little spooky.<br/>A lot to remember.</h2><p className="hw-lead">Share stories, play games and discover each other’s costumes.<br className="hw-desktop"/> A social night mixing scheduled activities with time to mingle.</p><div className="hw-programs">{[["01","A warm welcome","Opening & icebreakers","Start the evening by getting to know the people around you."],["02","Better together","Games & mingling","Enjoy a mix of group games and relaxed conversations."],["03","Your moment to shine","Costume contest","From a small accessory to a full costume, come share your Halloween style."]].map(([n,heading,title,body])=><article key={n}><span className="hw-number">{n}</span><p>{heading}</p><h3>{title}</h3><p>{body}</p></article>)}</div></section>
      <section className="hw-schedule-section" id="schedule"><div className="hw-wrap hw-schedule-grid"><div><p className="hw-eyebrow">ONE NIGHT, MANY MOMENTS</p><h2>An evening<br/>to connect.</h2><p className="hw-lead">Saturday, October 31 · 19:00–24:00<br/>Optional after-party from midnight</p><p className="hw-small">This is a planned schedule and may change on the day.</p></div><ol className="hw-timeline">{schedule.map(([time,title,type])=><li key={time}><time>{time}</time><div><span>{type}</span><h3>{title}</h3></div></li>)}</ol></div></section>
      <section className="hw-section hw-wrap hw-visit"><div><p className="hw-eyebrow">SEE YOU AT HIVE</p><h2>Meet us at<br/>HIVE, Yeonsinnae.</h2><p className="hw-lead">16-16 Yeonseo-ro 27-gil, Eunpyeong-gu, Seoul<br/>Basement level (B1)</p><a className="hw-text-link" href="https://map.naver.com/p/search/%EC%84%9C%EC%9A%B8%20%EC%9D%80%ED%8F%89%EA%B5%AC%20%EC%97%B0%EC%84%9C%EB%A1%9C27%EA%B8%B8%2016-16" target="_blank" rel="noopener noreferrer">Search the address on a map ↗</a></div><div className="hw-ticket"><span>MALMOIM HALLOWEEN 2026</span><strong>10.31</strong><p>SATURDAY / 19:00–24:00<br/>Optional after-party from midnight</p><hr/><dl><div><dt>Venue</dt><dd>HIVE, Yeonsinnae</dd></div><div><dt>Dress code</dt><dd>Costumes encouraged · Accessories welcome</dd></div><div><dt>Entry fee</dt><dd>To be announced</dd></div></dl></div></section>
      <section className="hw-apply-section" id="apply"><div className="hw-wrap hw-apply-grid"><div><p className="hw-eyebrow">JOIN THE NIGHT</p><h2>See you on Halloween.</h2><p className="hw-lead">We are preparing a simple form with your name,<br/>contact details and past MALMOIM participation.</p><span className="hw-status">Registration coming soon</span><p>Registration will open once the entry fee<br/>and privacy notice have been finalized.</p><a className="hw-text-link" href="mailto:cometomalmoim@gmail.com">Contact the organizers ↗</a></div><EventRegistrationForm english/></div></section>
      <section className="hw-section hw-wrap hw-faq"><p className="hw-eyebrow">GOOD TO KNOW</p><h2>Good to know</h2><details><summary>Do I need a costume?</summary><p>Costumes are encouraged. A simple accessory is welcome, too.</p></details><details><summary>When do doors open?</summary><p>Doors are scheduled to open at 7 PM on Saturday, October 31. After the main program, an optional, independently arranged after-party starts at midnight.</p></details><details><summary>What is the entry fee, and how do I register?</summary><p>The entry fee will be announced later. Registration is currently being prepared and will open once the details are finalized.</p></details></section>
    </main><footer className="hw-footer"><Link href="/">MALMOIM</Link><p>Come to MALMOIM, Meet the world.</p><a href="mailto:cometomalmoim@gmail.com">cometomalmoim@gmail.com</a></footer><a className="hw-mobile-cta" href="#apply">Halloween registration details ↗</a>
  </div>;
}
