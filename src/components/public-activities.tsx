"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { publicActivities, type ActivityCategory } from "@/lib/public-activities";
import type { PublicLocale } from "@/lib/public-content";
import styles from "./public-activities.module.css";

export function PublicActivities({ locale }: { locale: PublicLocale }) {
  const [filter, setFilter] = useState<"all" | ActivityCategory>("all");
  const en = locale === "en";
  const categories = { all: en ? "All" : "전체", study: en ? "Studies" : "스터디", event: en ? "Events" : "이벤트" };
  const activities = publicActivities.filter(item => filter === "all" || item.category === filter);

  return <section className={styles.directory} aria-label={en ? "Studies and events" : "스터디·이벤트 목록"}>
    <div className={styles.toolbar}>
      <div className={styles.filters} role="group" aria-label={en ? "Filter by category" : "카테고리 필터"}>
        {(["all", "study", "event"] as const).map(category => <button key={category} type="button" aria-pressed={filter === category} onClick={() => setFilter(category)}>{categories[category]}</button>)}
      </div>
      <p role="status">{en ? `${activities.length} ${activities.length === 1 ? "activity" : "activities"}` : `${activities.length}개의 활동`}</p>
    </div>
    <p className={styles.guidance}>{en ? "All times are in Korea Standard Time (KST). Check each detail page for current application availability." : "모든 일정은 한국시간 기준입니다. 현재 신청 가능 여부는 각 상세 페이지에서 확인해주세요."}</p>
    <ul className={styles.grid}>
      {activities.map(activity => <li key={activity.id}>
        <Link href={activity.href} className={styles.card} aria-labelledby={`${activity.id}-title`}>
          <div className={`${styles.visual} ${activity.category === "event" ? styles.eventVisual : ""}`}>
            {activity.image ? <Image src={activity.image} alt="" fill sizes="(max-width: 700px) 100vw, (max-width: 1280px) 50vw, 592px" /> : <span className={styles.placeholder} aria-hidden="true">MALMOIM<br />{activity.category === "study" ? "LEARN TOGETHER" : "MEET TOGETHER"}</span>}
            <span className={styles.visualCaption}>{activity.imageCaption[locale]}</span>
          </div>
          <div className={styles.body}>
            <div className={styles.badges}><span className={activity.category === "study" ? styles.studyBadge : styles.eventBadge}>{categories[activity.category]}</span><span className={styles.status}>{activity.status[locale]}</span></div>
            <h2 id={`${activity.id}-title`}>{activity.title[locale]}</h2>
            <p className={styles.description}>{activity.description[locale]}</p>
            <dl className={styles.facts}>
              <div><dt>{en ? "When" : "일정"}</dt><dd>{activity.schedule.map((line, i) => <span key={i}>{line[locale]}</span>)}</dd></div>
              <div><dt>{en ? "Where" : "장소"}</dt><dd>{activity.location[locale]}{activity.address && <small>{activity.address[locale]}</small>}</dd></div>
              <div><dt>{en ? "Fee" : "참가비"}</dt><dd>{activity.price[locale]}</dd></div>
            </dl>
            <p className={styles.note}>{activity.note[locale]}</p>
            <span className={styles.cta}>{en ? "View details" : "자세히 보기"}<span aria-hidden="true">↗</span></span>
          </div>
        </Link>
      </li>)}
    </ul>
  </section>;
}
