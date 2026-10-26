"use client";
import {Localized} from "@/components/public-translation";


import Image from "next/image";
import { HistoryPhotoDialog } from "./history-photo-dialog";
import { useRef, useState, type KeyboardEvent } from "react";
import { displayDate, type HistoryPhoto } from "./history-data";

import {HISTORY_COHORTS} from '@/lib/history-simple/categories';

const categories = [
  { id: "regular", label: "정규 활동", empty: "정규 세션 사진을 준비하고 있습니다.", filter: "기수" },
  { id: "special", label: "특별 활동", empty: "특별 활동 사진을 준비하고 있습니다.", filter: "연도" },
  { id: "other", label: "기타", empty: "공개된 사진이 아직 없습니다.", filter: "연도" },
] as const;
const PAGE_SIZE = 6;

function CategoryGallery({ category, photos }: { category: typeof categories[number]; photos: HistoryPhoto[] }) {
  const [detail, setDetail] = useState<HistoryPhoto | null>(null);
  const [filter, setFilter] = useState("all");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const items = photos.filter((photo) => photo.category === category.id);
  const filterValue = (photo: HistoryPhoto) => photo.category === "regular" ? String(photo.cohort) : photo.date.slice(0, 4);
  const options = category.id === "regular" ? Array.from(new Set([...HISTORY_COHORTS,...items.filter(p=>p.category==="regular").map(p=>p.cohort)])).sort((a,b)=>b-a).map(String) : Array.from(new Set(["2026","2025",...items.map(p=>p.date.slice(0,4))])).sort().reverse();
  const emptyMessage = filter === "all" ? category.empty : category.id === "regular" ? `${filter}기 정규 세션 사진이 아직 없습니다.` : `${filter}년 공개된 사진이 아직 없습니다.`;
  const filtered = items.filter((photo) => filter === "all" || filterValue(photo) === filter);
  const visible = filtered.slice(0, limit);

  return <Localized>{<>
    <div className="history-filters" role="group" aria-label={`${category.label} ${category.filter} 필터`}>
      {["all", ...options].map((option) => <button key={option} type="button" aria-pressed={filter === option} onClick={() => { setFilter(option); setLimit(PAGE_SIZE); }}>{option === "all" ? "전체" : `${option}${category.id === "regular" ? "기" : ""}`}</button>)}
    </div>
    <div className="history-results" aria-live="polite" aria-atomic="true">
      {filtered.length > 0 ? <p className="history-result-count">사진 {filtered.length}개 중 {visible.length}개 표시</p> : <div className="history-empty"><h3>{emptyMessage}</h3><p>공개할 활동 사진이 등록되면 이곳에서 만나보실 수 있습니다.</p></div>}
    </div>
    <div className="history-gallery">
      {visible.map((photo) => <article className="history-photo-card" key={photo.id}>
        <button type="button" className="history-photo-open" aria-label={`${photo.title} 사진 상세 보기`} onClick={() => setDetail(photo)}><Image unoptimized={photo.unoptimized} src={photo.src} alt={photo.alt} width={900} height={540} sizes="(max-width: 540px) calc(100vw - 40px), (max-width: 800px) 46vw, 350px" /></button>
        <h3 data-i18n-skip>{photo.title}</h3><time dateTime={photo.date}>{displayDate(photo.date)}</time><p data-i18n-skip>{photo.description}</p>
      </article>)}
    </div>
    {detail && <HistoryPhotoDialog key={detail.id} photo={detail} close={() => setDetail(null)} />}
    {filtered.length > limit && <button className="history-more" type="button" onClick={() => setLimit((current) => current + PAGE_SIZE)}>더 많은 사진 보기 <span aria-hidden="true">＋</span></button>}
  </>}</Localized>;
}

export function HistoryGallery({ photos }: { photos: HistoryPhoto[] }) {
  const [selected, setSelected] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  function handleKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    switch (event.key) {
      case "ArrowRight": next = (index + 1) % categories.length; break;
      case "ArrowLeft": next = (index - 1 + categories.length) % categories.length; break;
      case "Home": next = 0; break;
      case "End": next = categories.length - 1; break;
      default: return;
    }
    event.preventDefault(); setSelected(next); tabs.current[next]?.focus();
  }
  return <Localized>{<section className="history-photos" aria-label="말모임 활동 사진">
    <div className="history-archive-heading"><div><p className="history-label" lang="en">THE PHOTO ARCHIVE</p><h2>함께 쌓아가는 기록</h2></div><p>정규 세션부터 특별한 하루까지</p></div>
    <div className="history-tabs" role="tablist" aria-label="사진 분류">
      {categories.map((category, index) => <button key={category.id} type="button" role="tab" id={`history-tab-${category.id}`} aria-controls={`history-panel-${category.id}`} aria-selected={selected === index} tabIndex={selected === index ? 0 : -1} ref={(element) => { tabs.current[index] = element; }} onClick={() => setSelected(index)} onKeyDown={(event) => handleKey(event, index)}>{category.label}</button>)}
    </div>
    {categories.map((category, index) => <div key={category.id} id={`history-panel-${category.id}`} role="tabpanel" aria-labelledby={`history-tab-${category.id}`} hidden={selected !== index} tabIndex={0} className="history-tab-panel"><CategoryGallery key={selected} category={category} photos={photos} /></div>)}
  </section>}</Localized>;
}
