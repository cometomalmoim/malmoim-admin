import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { BrandLogo } from '@/components/brand-logo';
import { CompactApplication } from '@/components/season9/compact-application';
import { LanguageLink } from '@/components/season9/language-link';
import { season9, season9Additional } from '@/lib/season9';
import '../additional.css';

const title = 'Practice Korean. Make friends. | MALMOIM Season 9';
const description = 'International members welcome. Practice Korean, share your English and meet new friends in Seoul. Join the remaining 6 weeks of MALMOIM Season 9 for KRW 42,000 and apply in English.';
export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: '/season9/additional/en',
    languages: { ko: '/season9/additional', en: '/season9/additional/en' },
  },
  openGraph: {
    title, description, url: '/season9/additional/en', locale: 'en_US',
    images: [{ url: '/season9/moments/conversation.webp', width: 1600, height: 1200, alt: 'MALMOIM members sharing a conversation around a table' }],
  },
  twitter: { card: 'summary_large_image', title, description, images: ['/season9/moments/conversation.webp'] },
};
const experiences = [
  { number: '01', title: 'Share your English', time: '45 min', text: 'Help lead a small-group conversation with our activity sheets. Share stories, exchange ideas and get to know the people at your table.', photo: 'activity-sheets', alt: 'Members chatting in small groups with activity sheets' },
  { number: '02', title: 'Practice your Korean', time: '45 min', text: 'Now it’s your turn to practice. Learn with Korean members and try the words you’ve been studying in a real conversation.', photo: 'korean-board', alt: 'Members learning Korean together using a whiteboard' },
  { number: '03', title: 'Make memories together', time: '40 min', text: 'Keep the connection going through shared activities and cultural exchange. Make something together, beyond the small talk.', photo: 'making-together', alt: 'Members making kites together around a table' },
];
const faq = [
  ['Can I come on my own?', 'Absolutely. Join on your own and meet people through small-group conversations and shared activities.'],
  ['Do I need to speak Korean fluently?', 'You don’t need to be fluent in Korean. Bring your curiosity and a willingness to take part. Ask the organizers if you have questions about your language level.'],
  ['What will I do during the English part?', 'International members help lead small-group English conversations using activity sheets. You’ll also have time to practice Korean with Korean members. Contact the organizers about any preparation or language requirements.'],
  ['Can I join after the season has started?', 'Yes. Join the remaining 6 weeks for KRW 42,000. The Thursday group starts November 26 and the Saturday group starts November 28. Your place is confirmed after review.'],
  ['What happens after I apply?', 'The organizers review applications and send confirmation and payment guidance to the contact you provide. Submitting an application does not guarantee a place. The form above shows the current registration status.'],
];
export default function Page() {
  return <div className="extra-page extra-english s9-site" lang="en">
    <a className="extra-skip" href="#main">Skip to content</a>
    <header className="extra-nav">
      <Link href="/en" className="extra-brand extra-brand-logo" aria-label="MALMOIM home"><BrandLogo compact/></Link>
      <nav aria-label="Page navigation">
        <a href="#experience">The experience</a><a href="#details">The details</a>
        <span className="extra-language"><LanguageLink english basePath="/season9/additional"/></span>
        <a className="extra-nav-cta" href="#application">Apply in English ↗</a>
      </nav>
    </header>
    <main id="main">
      <section className="extra-hero extra-wrap">
        <div className="extra-hero-copy">
          <p className="extra-eyebrow">SEASON 09 · INTERNATIONAL MEMBERS WELCOME</p>
          <h1>More Korean.<br/>New friends.<br/><em>Your next chapter.</em></h1>
          <p className="extra-lead">Practice Korean. Share your English.<br/>Find new connections in Seoul.</p>
          <a className="extra-button" href="#application">Join Season 9 <span aria-hidden="true">↗</span></a>
          <p className="extra-note">Come on your own. Bring your curiosity.</p><p className="extra-note">We’re welcoming more international members to Season 9. Join us for the remaining {season9Additional.weeks} weeks — KRW {season9Additional.fee.toLocaleString('en-US')}.</p>
        </div>
        <figure className="extra-hero-photo">
          <Image src="/season9/moments/conversation.webp" alt="MALMOIM members laughing and talking around a table" width={1600} height={1200} preload sizes="(max-width: 760px) 100vw, 55vw"/>
          <figcaption>Different languages. New friends.<br/><strong>There’s more to talk about.</strong></figcaption>
          <span className="extra-stamp" aria-hidden="true">Come to MALMOIM<br/>Meet the world ↗</span>
        </figure>
      </section>
      <section id="application" className="extra-application">
        <div className="extra-wrap extra-application-grid">
          <div><p className="extra-eyebrow">LET’S MEET AT MALMOIM</p><h2>Your next conversation<br/><em>starts here.</em></h2><p>Tell us a little about yourself and your preferred group. The organizers will review your application and get in touch.</p><p className="extra-note">KRW 42,000 for the remaining 6 weeks. Thursday starts November 26; Saturday starts November 28. The organizers will confirm your place after reviewing your application.</p><Link className="extra-text-link" href="/inquiries/new?event=season9&lang=en">Have a question? Ask us ↗</Link><span className="extra-text-link"><LanguageLink english basePath="/season9/additional"/></span></div>
          <CompactApplication locale="en" additional/>
        </div>
      </section>
      <div className="extra-ribbon"><span>LESS SMALL TALK, MORE CONNECTION.</span><span>PRACTICE KOREAN. SHARE YOUR WORLD.</span><span aria-hidden="true">LESS SMALL TALK, MORE CONNECTION.</span></div>
      <section id="experience" className="extra-wrap extra-experience">
        <div className="extra-section-heading">
          <p className="extra-eyebrow">A LITTLE LANGUAGE, A LOT OF CONNECTION</p>
          <h2>Turn the Korean you study<br/>into conversations you share.</h2>
          <p>MALMOIM brings Korean and international members together for language and cultural exchange.<br/>Share your language, learn from each other and enjoy time together.</p>
        </div>
        <div className="extra-cards">{experiences.map(item => <article key={item.number}>
          <div className="extra-card-photo"><Image src={`/season9/moments/${item.photo}.webp`} alt={item.alt} width={1200} height={900} sizes="(max-width: 760px) 100vw, 33vw"/><span>{item.number}</span></div>
          <h3>{item.title}<small>{item.time}</small></h3><p>{item.text}</p>
        </article>)}</div>
        <p className="extra-note">Each gathering lasts 2 hours 30 minutes, including two 10-minute breaks.</p>
      </section>
      <section id="details" className="extra-details">
        <div className="extra-wrap extra-details-grid">
          <div><p className="extra-eyebrow">YOUR NEXT CHAPTER</p><h2>Make room for<br/>a new connection.</h2><p>We’re welcoming more international members for the remaining 6 weeks of Season 9. Practice Korean, share your English and get to know new people. Join the Thursday group from November 26 or the Saturday group from November 28.</p><Link className="extra-text-link" href="/inquiries/new?event=season9&lang=en">Ask about joining late ↗</Link></div>
          <dl>
            <div><dt>When</dt><dd>Thursday · starts November 26 · {season9.thursday.time}<br/>Saturday · starts November 28 · {season9.saturday.time}<small>Once a week in your chosen group · Korea Standard Time</small></dd></div>
            <div><dt>Where</dt><dd>Seoul Youth Center Eunpyeong<small>9, Tongil-ro 67-gil, Eunpyeong-gu, Seoul<br/>The organizers will notify you of any venue change.</small></dd></div>
            <div><dt>Fee</dt><dd>KRW {season9Additional.fee.toLocaleString('en-US')}<small>For the remaining {season9Additional.weeks} weeks · once a week in your chosen group.</small></dd></div>
            <div><dt>Next steps</dt><dd>Apply → review → confirmation & payment guidance<small>Your place is confirmed after review. Refunds are not available after the program starts.</small></dd></div>
          </dl>
        </div>
      </section>
      <section className="extra-wrap extra-faq">
        <div><p className="extra-eyebrow">BEFORE WE SAY HELLO</p><h2>A few things you<br/>might be wondering.</h2></div>
        <div>{faq.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div>
      </section>
    </main>
    <footer className="extra-wrap extra-footer"><Link className="extra-brand" href="/en">MALMOIM</Link><p>Come to MALMOIM, Meet the world.</p><a href="https://www.instagram.com/cometomalmoim/" target="_blank" rel="noopener noreferrer">Instagram ↗</a></footer>
  </div>;
}
