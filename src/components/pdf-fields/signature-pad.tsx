'use client';
import { useRef, type PointerEvent } from 'react';
import type { Ink, InkPoint } from '@/lib/pdf-signing';
import { inkPath } from '@/lib/pdf-signing';
import styles from './pdf-signing-preview.module.css';

export function SignaturePad({ value, onChange }: { value: Ink; onChange: (ink: Ink) => void }) {
  const drawing = useRef<{ pointer: number; before: Ink; stroke: InkPoint[] } | null>(null);
  const point = (e: PointerEvent<SVGSVGElement>) => { const r = e.currentTarget.getBoundingClientRect(); return { x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)) }; };
  function end(e: PointerEvent<SVGSVGElement>, cancel = false) {
    const draft = drawing.current;
    if (!draft || draft.pointer !== e.pointerId) return;
    drawing.current = null;
    onChange(cancel ? draft.before : [...draft.before, draft.stroke]);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  }
  return <div><svg className={styles.pad} viewBox="0 0 900 300" role="img" aria-label="손가락 또는 마우스로 서명하는 영역" onPointerDown={e => {
    if (!e.isPrimary || e.button !== 0 || drawing.current || value.length >= 80 || value.flat().length >= 4000) return;
    e.preventDefault(); const stroke = [point(e)]; drawing.current = { pointer: e.pointerId, before: value, stroke }; onChange([...value, stroke]); e.currentTarget.setPointerCapture(e.pointerId);
  }} onPointerMove={e => {
    const draft = drawing.current;
    if (!draft || draft.pointer !== e.pointerId || draft.before.flat().length + draft.stroke.length >= 4000) return;
    const p = point(e), previous = draft.stroke.at(-1)!;
    if (Math.hypot(p.x - previous.x, p.y - previous.y) < .002) return;
    draft.stroke.push(p); onChange([...draft.before, [...draft.stroke]]);
  }} onPointerUp={e => end(e)} onPointerCancel={e => end(e, true)} onLostPointerCapture={e => end(e, true)}><path d={inkPath(value)} fill="none" stroke="#142b31" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" /></svg><div className={styles.padTools}><span>손가락이나 마우스로 작성하세요. 실제 서명 대신 테스트용 모양을 사용하세요.</span><button type="button" onClick={() => { drawing.current = null; onChange([]); }}>서명 지우기</button></div></div>;
}
