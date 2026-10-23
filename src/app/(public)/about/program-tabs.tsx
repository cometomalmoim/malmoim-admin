"use client";
import {Localized} from "@/components/public-translation";


import Image from "next/image";
import regularSessionPhoto from "../../../../public/about/about-regular-session.jpeg";
import { useRef, useState, type KeyboardEvent } from "react";

const programs = [
  {
    id: "session", number: "01", title: "정규 언어교환 세션",
    blocks: [],
    features: ["언어 교류", "새로운 친구", "정기 모임"], icons: ["language", "friends", "calendar"], image: regularSessionPhoto,
  },
  {
    id: "culture", number: "02", title: "특별 활동 이벤트",
    blocks: [
      { title: "정규 세션 외에도 다양한 활동", description: "언어교환 외에 함께 참여하는 특별 프로그램" },
      { title: "모임 밖에서도 이어지는 교류", description: "정규 세션과는 다른 환경에서 함께하는 활동" },
    ],
    features: ["MT", "피크닉", "할로윈 파티", "기타 이벤트"], icons: ["tent", "sun", "party-popper", "calendar-heart"], image: "/about/about-hero.png",
  },
  {
    id: "exchange", number: "03", title: "1:1 언어교환 매칭",
    blocks: [
      { title: "조건에 맞는 언어교환 파트너", description: "사용 가능한 언어와 학습 희망 언어를 기준으로 매칭" },
      { title: "원하는 방식으로 참여", description: "가능한 시간과 온라인·오프라인 선호도 고려" },
      { title: "신청부터 결과 확인까지", description: "매칭 신청 및 진행 상태·결과 확인을 위한 프로그램 구성" },
    ],
    features: ["사용·학습 언어", "가능한 시간", "온라인·오프라인", "매칭 상태·결과"], icons: ["language", "clock", "screen", "status"], image: "/about/about-program.png",
  },
] as const;

const sessionStages = [
  { number: "01", title: "영어 세션", duration: "45분", description: ["외국인 참가자가 리더가 되어", "말모임 활동지를 활용한 영어 자유 대화"] },
  { number: "02", title: "한국어 세션", duration: "45분", description: ["한국인 참가자가 리더가 되어", "말모임 활동지를 활용한 한국어 자유 대화"] },
  { number: "03", title: "단체 활동", duration: "40분", description: ["한국인 2명과 외국인 2명이 한 팀을 이루어", "함께 즐기는 다양한 단체 활동"] },
] as const;

type FeatureIconName = "status" | "tent" | "sun" | "party-popper" | "calendar-heart" | "language" | "friends" | "calendar" | "party" | "picnic" | "trip" | "clock" | "screen" | "location";

function FeatureIcon({ name }: { name: FeatureIconName }) {
  const paths: Record<FeatureIconName, React.ReactNode> = {
    status: <><rect x="4" y="3" width="16" height="19" rx="2" /><path d="M9 3V1h6v2M8 9h8M8 13h4m-3 4 2 2 5-5" /></>,
    tent: <><path d="m3 21 9-18 9 18H3Zm4 0 5-10 5 10M12 3V1" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></>,
    "party-popper": <><path d="m3 21 4-14 10 10-14 4Zm3-9 6 6M15 3v3m3 3h3M11 2l1 2m8-1-3 3m3 7 2 1" /></>,
    "calendar-heart": <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 2v6M17 2v6M3 11h18M12 19s-4-2.5-4-4.5a2 2 0 0 1 4-1 2 2 0 0 1 4 1C16 16.5 12 19 12 19Z" /></>,
    language: <><path d="M3 5h12M9 2v3M5 5c0 5 3 8 8 10M13 5c0 5-4 9-10 11M14 21l4-11 4 11m-6-4h4" /></>,
    friends: <><circle cx="9" cy="7" r="3" /><path d="M2 21v-3a7 7 0 0 1 14 0v3M16 4a3 3 0 0 1 0 6m3 11v-3a7 7 0 0 0-2-5" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 2v6M17 2v6M3 11h18m-13 5 2 2 4-4" /></>,
    party: <><path d="m3 21 4-14 10 10-14 4Zm3-9 6 6M15 3v3m3 3h3M11 2l1 2m8-1-3 3m3 7 2 1" /></>,
    picnic: <><path d="M3 11h18l-2 10H5L3 11Zm4 0 5-8 5 8M9 15v3m6-3v3" /></>,
    trip: <><path d="m2 20 7-12 5 8 3-5 5 9H2ZM6 13l3 2 3-2M15 3h6m-3-3v6" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 6v6l4 3" /></>,
    location: <><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    screen: <><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8m-4-4v4" /><circle cx="12" cy="8" r="2" /><path d="M8 14a4 4 0 0 1 8 0" /></>,
  };
  return <Localized>{<svg className="about-program-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name]}</svg>}</Localized>;
}

export function ProgramTabs() {
  const [selected, setSelected] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    switch (event.key) {
      case "ArrowRight": next = (index + 1) % programs.length; break;
      case "ArrowLeft": next = (index - 1 + programs.length) % programs.length; break;
      case "Home": next = 0; break;
      case "End": next = programs.length - 1; break;
      default: return;
    }
    event.preventDefault();
    setSelected(next);
    tabs.current[next]?.focus();
  }

  return <Localized>{(
    <div className="about-programs">
      <div className="about-program-header">
        <div className="about-section-heading"><p className="about-label">PROGRAM</p><h2 id="about-programs-title">프로그램 안내</h2><p>언어와 문화를 나누는 다양한 프로그램이 있어요.</p></div>
      <div className="about-tabs" role="tablist" aria-label="말모임 프로그램">
        {programs.map((program, index) => <button key={program.id} ref={(element) => { tabs.current[index] = element; }} id={`about-tab-${program.id}`} type="button" role="tab" aria-selected={selected === index} aria-controls={`about-panel-${program.id}`} tabIndex={selected === index ? 0 : -1} onClick={() => setSelected(index)} onKeyDown={(event) => handleKeyDown(event, index)}>{program.title}</button>)}
      </div>
      </div>
      <div className="about-program-panels">
      {programs.map((program, index) => <div key={program.id} id={`about-panel-${program.id}`} className="about-tab-panel" role="tabpanel" aria-labelledby={`about-tab-${program.id}`} data-inactive={selected !== index ? "" : undefined} inert={selected !== index} aria-hidden={selected !== index} tabIndex={selected === index ? 0 : -1}><div className={`about-program-layout${program.id === "session" ? " about-session-layout" : ""}`}>
        <figure className={`about-program-photo${program.id === "session" ? " about-session-photo" : ""}`}>
          {/* Only the session photo is an actual activity record; the other images remain illustrative. */}
          <Image className="about-image" src={program.image} alt={program.id === "session" ? "테이블에 둘러앉아 대화하는 말모임 정규 언어교환 세션 참가자들" : program.id === "culture" ? "여러 사람이 함께 대화하는 모습을 표현한 AI 생성 임시 이미지" : "두 사람이 마주 앉아 대화하는 모습을 표현한 AI 생성 임시 이미지"} width={program.id === "session" ? 4000 : 1448} height={program.id === "session" ? 2252 : 1086} sizes={program.id === "session" ? "(max-width: 480px) calc(100vw - 40px), (max-width: 800px) calc(100vw - 48px), 1024px" : "(max-width: 480px) calc(100vw - 40px), (max-width: 800px) calc(100vw - 48px), (max-width: 1160px) 43vw, 489px"} />
          {program.id !== "session" && <figcaption>AI 생성 임시 이미지 · 실제 활동 사진이 아닙니다.</figcaption>}
        </figure>
        <div className={`about-program-copy${program.id === "session" ? " about-session-copy" : ""}`}>
          {program.id === "session" ? (
            <div className="about-session-heading">
              <p className="about-program-number">PROGRAM {program.number}</p>
              <h3>{program.title}</h3>
            </div>
          ) : (
            <>
          <p className="about-program-number">PROGRAM {program.number}</p>
          <h3>{program.title}</h3>
            </>
          )}
          {program.id === "session" ? (
            <div className="about-session-body">
              <div className="about-session-description">
                <p>한국인과 외국인이 서로의 언어를 배우고<br />함께 어울리는 정기 언어교환 모임</p>
              </div>
              <ol className="about-session-stages" aria-label="정규 세션 진행 순서">
                {sessionStages.map((stage) => <li key={stage.number}>
                  <span className="about-session-stage-number" aria-hidden="true">{stage.number}.</span>
                  <div>
                    <h4>{stage.title}<span className="about-session-duration">| {stage.duration}</span></h4>
                    <p>{stage.description[0]}<br />{stage.description[1]}</p>
                  </div>
                </li>)}
              </ol>
            </div>
          ) : (
          <div className="about-program-blocks">
            {program.blocks.map((block) => <div className="about-program-block" key={block.title}>
              <h4>{block.title}</h4>
              <p>{block.description}</p>
            </div>)}
          </div>
          )}
          {program.id !== "session" && (
            <ul className="about-program-features" aria-label={`${program.title} 특징`}>
              {program.features.map((feature, featureIndex) => <li key={feature}><FeatureIcon name={program.icons[featureIndex]} /><span>{feature}</span></li>)}
            </ul>
          )}
        </div>
      </div></div>)}
      </div>
    </div>
  )}</Localized>;
}
