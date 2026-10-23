import type { Metadata } from "next";
import Image from "next/image";
import { ProgramTabs } from "./program-tabs";
import "./about.css";
import "./about-brand.css";

const description = "영어를 잘 못해도, 한국어를 잘 못해도 괜찮아요. 말모임의 프로그램과 참여 안내를 만나보세요.";

export const metadata: Metadata = {
  title: "말모임 소개",
  description,
  alternates: { canonical: "/about" },
  openGraph: { title: "말모임 소개 | 말모임 MALMOIM", description, url: "/about" },
};

const questions = [
  ["영어 또는 한국어를 잘 못해도 참여할 수 있나요?", "물론이죠! 언어 실력과 관계없이 누구나 편하게 참여할 수 있어요. 서로 이야기하면서 자연스럽게 배우는 모임이니 부담 갖지 않으셔도 됩니다."],
  ["모임은 어떤 방식으로 진행되나요?", "한국인과 외국인이 4명씩 조를 이루어 한국어와 영어로 대화합니다. 다양한 주제로 이야기를 나누고, 일정 시간마다 조를 바꾸는 로테이션 방식으로 진행돼요. 한 번의 모임에서 여러 사람과 이야기할 수 있도록 구성되어 있습니다."],
  ["신청 취소나 환불이 가능한가요?", "신청 취소나 환불을 원하시는 경우 운영진에게 별도로 문의해 주세요."],
  ["정기 언어교환 외에 다른 활동도 있나요?", "네! 정규 세션 외에도 MT, 피크닉, 할로윈 파티 같은 특별 활동 이벤트를 진행합니다. 개인별 조건을 고려해 언어교환 파트너를 연결하는 1:1 언어교환 매칭 프로그램도 있어요."],
  ["매주 정해진 시간에 참여해야 하나요?", "정규 언어교환 세션은 매주 목요일 00:00~00:00 또는 토요일 00:00~00:00에 진행됩니다. 특별 활동 이벤트의 일정은 카카오톡 채팅방이나 인스타그램 등을 통해 별도로 안내할 예정입니다."],
  ["모임에 늦거나 중간에 나가도 되나요?", "중도 입장과 중도 퇴장 모두 가능하지만, 원활한 진행을 위해 가급적 정해진 시간에 맞춰 참여해 주세요. 개인 사정으로 늦거나 일찍 나가야 한다면 미리 운영진에게 알려주시면 감사하겠습니다."],
] as const;

export default function AboutPage() {
  return (
    <main id="public-main" className="about-page" tabIndex={-1}>
      <section className="about-hero" aria-labelledby="about-title">
        <div className="about-hero-copy">
          <p className="about-label">한국인, 외국인 모두 함께하는 언어교환 모임</p>
          <h1 id="about-title">언어로 만나는,<br /><span>더 넓은 세상.</span></h1>
          <div className="about-hero-intro">
            <p><strong>영어를 잘 못해도, 한국어를 잘 못해도 괜찮아요.</strong></p>
            <p>다양한 사람들과 편하게 대화하고,<br />새로운 친구를 만날 수 있는 곳.</p>
            <p><strong>언어교환 커뮤니티, 말모임</strong>입니다.</p>
          </div>
          <a className="about-anchor" href="#about-recruitment" aria-label="9기 신청하기 — 모집 안내로 이동">9기 신청하기 →</a>
          <p className="about-hero-welcome">
            <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" /></svg>처음 참여해도 OK</span>
            <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M18 21a8 8 0 0 0-16 0M22 20a6 6 0 0 0-4-5.65" /><circle cx="10" cy="8" r="5" /><path d="M16 3.13a5 5 0 0 1 0 9.75" /></svg>다양한 국적의 친구들</span>
          </p>
        </div>
        <figure className="about-photo">
          <div className="about-hero-visual">
          <Image className="about-image" src="/about/about-hero-real.jpeg" alt="말모임 현수막 앞에서 실내 단체사진을 촬영한 참가자들" width={2958} height={2142} sizes="(max-width: 480px) calc(100vw - 40px), (max-width: 800px) calc(100vw - 48px), (max-width: 1160px) 54vw, 646px" loading="eager" />
          </div>
        </figure>
      </section>

      <section className="about-section" aria-labelledby="about-programs-title">
        <ProgramTabs />
      </section>

      <section className="about-section about-location" aria-labelledby="about-location-title">
        <div className="about-section-heading"><p className="about-label" lang="en">LOCATION</p><h2 id="about-location-title">오시는 길</h2><p>말모임 정규 세션 진행 장소</p></div>
        <div className="about-location-layout">
          <div className="about-location-photo">
            <Image src="/about/location-eunpyeong.jpeg" alt="서울청년센터 은평 간판과 오른쪽 계단 입구" width={1023} height={1280} sizes="(max-width: 800px) min(360px, calc(100vw - 40px)), (max-width: 1000px) 43vw, 400px" />
          </div>
          <div className="about-location-card">
            <dl className="about-location-blocks">
              <div className="about-location-block">
                <svg className="about-location-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></svg>
                <dt>활동 장소</dt>
                <dd><strong>서울청년센터 은평</strong><p>서울 은평구 통일로67길 9, B동 4층</p></dd>
              </div>
              <div className="about-location-block">
                <svg className="about-location-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><rect x="5" y="2" width="14" height="17" rx="4" /><path d="M5 10h14M12 2v8M8 19l-2 3m10-3 2 3" /><circle cx="8.5" cy="14.5" r=".5" /><circle cx="15.5" cy="14.5" r=".5" /></svg>
                <dt>가장 가까운 지하철역</dt>
                <dd><strong>불광역 (3호선·6호선)</strong><p>7번 출구 · 도보 약 3분</p></dd>
              </div>
            </dl>
            <div className="about-map-actions">
              <a className="about-map-link about-map-primary" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent("서울청년센터 은평 서울 은평구 통일로67길 9")}`} target="_blank" rel="noopener noreferrer"><span>구글 지도에서 보기</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M14 3h7v7m0-7L10 14" /><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" /></svg><span className="about-map-new-window">(새 창)</span></a>
              <a className="about-map-link about-map-secondary" href={`https://map.naver.com/p/search/${encodeURIComponent("서울청년센터 은평 서울 은평구 통일로67길 9")}`} target="_blank" rel="noopener noreferrer"><span>네이버 지도에서 보기</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M14 3h7v7m0-7L10 14" /><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" /></svg><span className="about-map-new-window">(새 창)</span></a>
            </div>
          </div>
        </div>
      </section>

      <section id="about-recruitment" className="about-section about-recruitment" aria-labelledby="about-recruitment-title">
        <div className="about-recruitment-banner">
          <div className="about-recruitment-top">
            <div className="about-recruitment-copy">
              <p className="about-recruitment-label" lang="en">NEXT RECRUIT · 9TH</p>
              <h2 id="about-recruitment-title">말모임 9기 모집</h2>
              <p>6주 동안 한국어와 영어로 대화하며 새로운 사람들과 교류해 보세요.</p>
            </div>
            <dl className="about-recruitment-info">
              <div><svg className="about-recruitment-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 2v6M17 2v6M3 11h18m-13 5 2 2 4-4" /></svg><dt>모집 기간</dt><dd><time dateTime="2026-10-19">2026.10.19</time> ~ <time dateTime="2026-10-31">10.31</time></dd></div>
              <div><svg className="about-recruitment-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 2v6M17 2v6M3 11h18m-7 3 4 2-4 2v-4Z" /></svg><dt>활동 일정</dt><dd><time dateTime="2026-11-05">2026.11.05</time>부터 6주간</dd></div>
              <div><svg className="about-recruitment-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false"><path d="M4 7h15l-3-3m3 3-3 3M20 17H5l3 3m-3-3 3-3" /></svg><dt>진행 요일</dt><dd>매주 목요일 또는 토요일</dd></div>
              <div><svg className="about-recruitment-icon about-recruitment-price-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false"><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 10c0 1.7 3.6 3 8 3s8-1.3 8-3M4 15c0 1.7 3.6 3 8 3s8-1.3 8-3" /></svg><dt>참가비</dt><dd>50,000원 / 6주</dd></div>
            </dl>
          </div>
          <button className="about-recruitment-apply" type="button" disabled aria-describedby="about-recruitment-status">신청 링크 준비 중</button>
          <p id="about-recruitment-status" className="about-recruitment-status">신청 링크가 준비되면 안내하겠습니다. 현재 이 페이지에서는 신청을 접수하지 않습니다.</p>
        </div>
      </section>

      <section className="about-section about-faq" aria-labelledby="about-faq-title">
        <div className="about-section-heading"><p className="about-label">자주 묻는 질문</p><h2 id="about-faq-title">궁금한 점이 있나요?</h2></div>
        <div className="about-faq-grid">
          {[questions.slice(0, 3), questions.slice(3)].map((column, index) => (
            <div className="about-faq-column" key={index}>
              {column.map(([question, answer]) => <details key={question}><summary><span>{question}</span><span className="about-faq-indicator" aria-hidden="true" /></summary><p>{answer}</p></details>)}
            </div>
          ))}
        </div>
      </section>

      <aside className="about-contact" aria-label="신청 및 문의 안내">
        <p id="about-contact-status">신청 링크와 문의 채널 확인 중</p>
        <div><button type="button" disabled aria-describedby="about-contact-status">신청 준비 중</button><button type="button" disabled aria-describedby="about-contact-status">문의 준비 중</button></div>
      </aside>
    </main>
  );
}
