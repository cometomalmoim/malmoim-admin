'use client';

import { useEffect, useId, useRef, useState } from 'react';

export function VenueMap({ english = false }: { english?: boolean }) {
 const dialog = useRef<HTMLDialogElement>(null);
 const titleId = useId();
 const [open, setOpen] = useState(false);
 const query = encodeURIComponent('서울청년센터 은평 서울 은평구 통일로67길 9');
 useEffect(() => {
  if (!open) return;
  const previous = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  return () => { document.body.style.overflow = previous; };
 }, [open]);
 return <>
  <button className="s9-map-button" type="button" aria-haspopup="dialog" onClick={() => { dialog.current?.showModal(); setOpen(true); }}>{english ? 'View map' : '지도 보기'} ↗</button>
  <dialog className="s9-map-dialog" ref={dialog} aria-labelledby={titleId} onClose={() => setOpen(false)} onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
   <header><h2 id={titleId}>{english ? 'Seoul Youth Center Eunpyeong' : '서울청년센터 은평'}</h2><button type="button" onClick={() => dialog.current?.close()}>{english ? 'Close' : '닫기'} ×</button></header>
   <p>{english ? '9, Tongil-ro 67-gil, Eunpyeong-gu, Seoul' : '서울 은평구 통일로67길 9'}</p>
   {open && <iframe title={english ? 'Venue map' : '행사 장소 지도'} src={`https://maps.google.com/maps?q=${query}&output=embed`} referrerPolicy="no-referrer" loading="lazy" />}
   <a href={`https://map.naver.com/p/search/${query}`} target="_blank" rel="noopener noreferrer">{english ? 'Open in Naver Map / Directions' : '네이버 지도에서 길찾기'} ↗</a>
  </dialog>
 </>;
}
