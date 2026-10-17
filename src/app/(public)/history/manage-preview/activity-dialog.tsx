"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";
export function ActivityDialog({ title, children, close, busy = false }: { title: string; children: ReactNode; close: () => void; busy?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const heading = useId();
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const node = ref.current; node?.showModal();
    node?.querySelector<HTMLElement>("[data-activity-initial-focus]")?.focus();
    return () => { node?.close(); if (previous?.isConnected) previous.focus(); };
  }, []);
  return <dialog ref={ref} className="activity-dialog" aria-labelledby={heading} tabIndex={-1} onCancel={(e) => { e.preventDefault(); if (!busy) close(); }} onKeyDown={(e) => {
    if (e.key !== "Tab") return;
    const controls = Array.from(ref.current?.querySelectorAll<HTMLElement>("button,input,select,textarea,a[href],[tabindex]") ?? []).filter((n) => !n.matches(":disabled") && n.tabIndex >= 0 && n.getClientRects().length > 0 && !n.closest("[hidden]"));
    const first = controls[0]; const last = controls.at(-1);
    if (!first || !last) { e.preventDefault(); ref.current?.focus(); }
    else if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (document.activeElement === last || document.activeElement === ref.current)) { e.preventDefault(); first.focus(); }
  }}><div className="activity-dialog-heading"><h2 id={heading}>{title}</h2><button type="button" onClick={close} disabled={busy}>닫기</button></div>{children}</dialog>;
}
