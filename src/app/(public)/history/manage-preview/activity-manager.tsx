"use client";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityDialog } from "./activity-dialog";
import { HistoryPhotoDialog } from "../history-photo-dialog";
import { ActivityForm } from "./activity-form";
import { toHistoryPhoto, cohorts, years, type Activity, type ActivityAsset } from "./activity-types";
const demoCover: ActivityAsset = { id: "demo-brand", url: "/brand/malmoim-logo.png", name: "[데모] 실제 활동 사진이 아닌 브랜드 로고", alt: "[데모] 사진 자리 표시용 말모임 로고", size: 0 };
const demos: Activity[] = [
  { id: "demo-regular", category: "regular", cohort: 9, title: "[데모] 정규 세션 입력 예시", date: "2026-01-01", description: "[데모] 화면 구성을 확인하기 위한 가상 기록입니다. 실제 9기 활동이나 날짜를 나타내지 않습니다.", cover: demoCover, additional: [] },
  { id: "demo-special", category: "special", year: 2025, title: "[데모] 특별 활동 입력 예시", date: "2025-01-01", description: "[데모] 연도별 분류를 확인하기 위한 가상 기록이며 실제 활동 기록이 아닙니다.", cover: demoCover, additional: [] },
];
export function ActivityManager() {
  const [items, setItems] = useState<Activity[]>(demos);
  const [editor, setEditor] = useState<Activity | "new" | null>(null);
  const [slidePreview, setSlidePreview] = useState<Activity | null>(null);
  const [deleting, setDeleting] = useState<Activity | null>(null);
  const [category, setCategory] = useState("all");
  const [group, setGroup] = useState("all");
  const [notice, setNotice] = useState("");
  const pool = useRef(new Set<string>());
  const retained = useRef(new Set<string>());
  const listHeading = useRef<HTMLHeadingElement>(null);
  const createButton = useRef<HTMLButtonElement>(null);
  const cancelDelete = useRef<HTMLButtonElement>(null);
  const makeAsset = useCallback((file: File): ActivityAsset => {
    const url = URL.createObjectURL(file); pool.current.add(url);
    return { id: crypto.randomUUID(), url, name: file.name, alt: `로컬 미리보기: ${file.name}`, size: file.size };
  }, []);
  const release = useCallback((assets: ActivityAsset[]) => {
    for (const asset of assets) if (pool.current.has(asset.url) && !retained.current.has(asset.url)) { URL.revokeObjectURL(asset.url); pool.current.delete(asset.url); }
  }, []);
  useEffect(() => { const urls = pool.current; return () => { urls.forEach((url) => URL.revokeObjectURL(url)); urls.clear(); }; }, []);
  useEffect(() => { if (deleting) cancelDelete.current?.focus(); }, [deleting]);
  function replaceItems(next: Activity[]) {
    retained.current = new Set(next.flatMap((item) => [item.cover, ...item.additional]).map((asset) => asset.url));
    for (const url of pool.current) if (!retained.current.has(url)) { URL.revokeObjectURL(url); pool.current.delete(url); }
    setItems(next);
  }
  const visible = items.filter((item) => (category === "all" || item.category === category) && (group === "all" || String(item.category === "regular" ? item.cohort : item.year) === group));
  return <>
    <div className="activity-page-heading"><p className="activity-eyebrow">DEVELOPMENT ONLY</p><h1>활동 사진 관리 <span>UI 미리보기</span></h1><p>운영 화면을 준비하는 개발용 데모입니다.</p></div>
    <aside className="activity-notice"><strong>관리자 인증이 연결되지 않은 화면입니다.</strong><p>모든 항목은 [데모]이며 기수·연도·날짜도 가상 예시입니다. 실제 활동 사진 대신 로고를 표시합니다. 변경은 이 탭의 메모리에만 남고 새로고침하면 초기화됩니다. 실제 DB·Storage 요청은 보내지 않습니다.</p></aside>
    <nav className="activity-links" aria-label="관련 미리보기"><Link href="/history">히스토리 보기</Link><Link href="/history/preview">후기 UI 미리보기</Link></nav>
    <div className="activity-toolbar"><h2 ref={listHeading} tabIndex={-1}>데모 활동 목록</h2><button ref={createButton} className="activity-primary" type="button" onClick={() => { setNotice(""); setEditor("new"); }}>활동 등록 UI 열기</button></div>
    <div className="activity-list-filters"><label htmlFor="manage-category">카테고리<select id="manage-category" value={category} onChange={(e) => { setCategory(e.target.value); setGroup("all"); }}><option value="all">전체</option><option value="regular">정규 세션</option><option value="special">특별 활동</option></select></label>
      {category !== "all" && <label htmlFor="manage-group">{category === "regular" ? "기수" : "연도"}<select id="manage-group" value={group} onChange={(e) => setGroup(e.target.value)}><option value="all">전체</option>{(category === "regular" ? cohorts : years).map((n) => <option key={n} value={n}>{n}{category === "regular" ? "기" : "년"}</option>)}</select></label>}
    </div>
    <p className="activity-status" role="status">{notice || `데모 ${visible.length}개 표시 · 실제 저장된 자료가 아닙니다.`}</p>
    {visible.length === 0 ? <div className="activity-empty"><h3>선택한 분류에 데모 항목이 없어요.</h3><p>다른 필터를 선택하거나 활동 등록 UI를 열어 입력을 시험해보세요.</p></div> : <div className="activity-list">{visible.map((item) => <article className="activity-card" key={item.id}><Image unoptimized src={item.cover.url} alt={item.cover.alt} width={420} height={240} /><div className="activity-card-body"><p className="activity-tag">[데모] {item.category === "regular" ? `정규 세션 · ${item.cohort}기` : `특별 활동 · ${item.year}년`}</p><h3>{item.title.startsWith("[데모]") ? item.title : `[데모] ${item.title}`}</h3><p><time dateTime={item.date}>예시 날짜 {item.date}</time> · 사진 {1 + item.additional.length}장</p><p className="activity-card-description">{item.description}</p><div className="activity-actions"><button type="button" aria-label={`${item.title} 사진 슬라이드 미리보기`} onClick={() => setSlidePreview(item)}>사진 슬라이드 미리보기</button><button type="button" aria-label={`${item.title} 수정`} onClick={() => { setNotice(""); setEditor(item); }}>수정</button><button type="button" className="activity-danger" aria-label={`${item.title} 삭제`} onClick={() => setDeleting(item)}>삭제</button></div></div></article>)}</div>}
    {slidePreview && <HistoryPhotoDialog key={slidePreview.id} photo={toHistoryPhoto(slidePreview)} close={() => setSlidePreview(null)} />}
    {editor && <ActivityForm activity={editor === "new" ? undefined : editor} makeAsset={makeAsset} release={release} close={() => setEditor(null)} save={(item) => {
      replaceItems(editor === "new" ? [item, ...items] : items.map((old) => old.id === item.id ? item : old));
      setEditor(null); setNotice("데모 목록에만 반영했습니다. 실제 저장·업로드는 하지 않았습니다. 현재 필터와 다른 분류라면 전체에서 확인해주세요.");
    }} />}
    {deleting && <ActivityDialog title="데모 항목을 삭제할까요?" close={() => setDeleting(null)}><p><strong>{deleting.title}</strong></p><p>이 탭의 데모 목록에서만 제거합니다. 실제 DB나 사진 파일을 삭제하지 않습니다.</p><div className="activity-actions"><button data-activity-initial-focus ref={cancelDelete} type="button" onClick={() => setDeleting(null)}>취소</button><button type="button" className="activity-danger" onClick={() => { replaceItems(items.filter((item) => item.id !== deleting.id)); setDeleting(null); setNotice("데모 목록에서만 제거했습니다. 실제 삭제 요청은 보내지 않았습니다."); requestAnimationFrame(() => (items.length > 1 ? listHeading.current : createButton.current)?.focus()); }}>데모 삭제 확인</button></div></ActivityDialog>}
  </>;
}
