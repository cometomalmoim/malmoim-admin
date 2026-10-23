"use client";
import {Localized} from "@/components/public-translation";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import { displayDate, type HistoryPhoto } from "./history-data";

function DetailImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  return <Localized>{failed ? <p className="history-photo-error" role="status">사진을 불러오지 못했어요. 창을 닫고 다시 열어주세요.</p> : <Image unoptimized src={src} alt={alt} width={1200} height={800} onError={() => setFailed(true)} />}</Localized>;
}
export function HistoryPhotoDialog({ photo, close }: { photo: HistoryPhoto; close: () => void }) {
  const [index, setIndex] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const gesture = useRef<{ id: number; x: number; y: number } | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const photos = photo.slidePhotos ?? [{ src: photo.src, alt: photo.alt }, ...(photo.additionalPhotos ?? [])];
  useEffect(() => {
    const node = dialog.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    node?.showModal();
    return () => { node?.close(); if (previous?.isConnected) previous.focus(); };
  }, []);
  const move = (step: number) => setIndex((current) => (current + step + photos.length) % photos.length);
  return <Localized>{<dialog ref={dialog} className="history-photo-dialog" tabIndex={-1} aria-labelledby={titleId} aria-describedby={descriptionId} onCancel={(e) => { e.preventDefault(); close(); }} onKeyDown={(e) => {
    e.stopPropagation();
    if (photos.length > 1 && (e.key === "ArrowLeft" || e.key === "ArrowRight")) { e.preventDefault(); move(e.key === "ArrowLeft" ? -1 : 1); }
    if (e.key !== "Tab") return;
    const buttons = Array.from(dialog.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);
    const first = buttons[0]; const last = buttons.at(-1);
    if (!first || !last) return;
    if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { e.preventDefault(); first.focus(); }
  }}>
    <div className="history-photo-dialog-heading"><div><p>{photo.category === "regular" ? `정규 세션 · ${photo.cohort}기` : "특별 활동"}</p><h2 id={titleId} data-i18n-skip>{photo.title}</h2></div><button type="button" onClick={close}>닫기</button></div>
    <div className="history-photo-stage" onTouchStart={(event) => {
      const touch = event.touches.length === 1 ? event.touches[0] : null;
      gesture.current = touch ? { id: touch.identifier, x: touch.clientX, y: touch.clientY } : null;
    }} onTouchCancel={() => { gesture.current = null; }} onTouchEnd={(event) => {
      const start = gesture.current;
      gesture.current = null;
      if (!start || event.touches.length || photos.length < 2) return;
      const end = Array.from(event.changedTouches).find((touch) => touch.identifier === start.id);
      if (!end) return;
      const dx = end.clientX - start.x; const dy = end.clientY - start.y;
      if (Math.abs(dx) >= 48 && Math.abs(dx) > Math.abs(dy) * 1.5) move(dx < 0 ? 1 : -1);
    }}><DetailImage key={`${photo.id}-${index}`} src={photos[index].src} alt={photos[index].alt} /></div>
    <div className="history-photo-navigation">
      {photos.length > 1 && <button type="button" onClick={() => move(-1)} aria-label="이전 사진">← 이전</button>}
      <p role="status" aria-live="polite" aria-atomic="true">사진 {index + 1} / {photos.length}</p>
      {photos.length > 1 && <button type="button" onClick={() => move(1)} aria-label="다음 사진">다음 →</button>}
    </div>
    {photos.length > 1 && <div className="history-photo-thumbnails" role="group" aria-label="활동 사진 선택">{photos.map((item, i) => <button type="button" key={`${i}-${item.src}`} aria-label={`${i + 1}번 사진 보기`} aria-pressed={index === i} onClick={() => setIndex(i)}><Image unoptimized src={item.src} alt="" width={120} height={80} /></button>)}</div>}
    <time dateTime={photo.date}>{displayDate(photo.date)}</time><p id={descriptionId} className="history-photo-description" data-i18n-skip>{photo.description}</p>
  </dialog>}</Localized>;
}
