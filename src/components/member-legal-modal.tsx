"use client";

import { useEffect, useId, useRef } from "react";
import type { MemberLegalDocument } from "@/lib/member-legal";
import type { PublicLocale } from "@/lib/public-content";
import { MemberLegalContent } from "./member-legal-content";

export function MemberLegalModal({ open, onClose, document, locale, kind }: {
  open: boolean; onClose: () => void; document: MemberLegalDocument | null;
  locale: PublicLocale; kind: "privacy" | "terms";
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const title = kind === "privacy" ? (locale === "en" ? "Privacy Policy" : "개인정보 처리방침")
    : (locale === "en" ? "Terms of Use" : "이용약관");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    const trigger = window.document.activeElement;
    const previousOverflow = window.document.body.style.overflow;
    // Native modal dialogs make the background inert and keep Tab/Shift+Tab
    // within the dialog, including any links in a future approved document.
    dialog.showModal();
    window.document.body.style.overflow = "hidden";
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
    titleRef.current?.focus({ preventScroll: true });
    return () => {
      dialog.close();
      window.document.body.style.overflow = previousOverflow;
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus({ preventScroll: true });
    };
  }, [open]);

  return <dialog ref={dialogRef} className="member-legal-dialog" lang={locale}
    aria-modal="true" aria-labelledby={id + "-title"}
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => {
      if (event.target !== event.currentTarget) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
    }}>
    <header className="member-legal-modal-header">
      <h2 id={id + "-title"} ref={titleRef} tabIndex={-1}>{title}</h2>
      <button type="button" className="member-legal-close" aria-label={locale === "en" ? "Close document" : "문서 닫기"} onClick={onClose}>×</button>
    </header>
    <div ref={bodyRef} className="member-legal-modal-body" tabIndex={0} role="region" aria-label={locale === "en" ? "Document text" : "문서 내용"}>
      <MemberLegalContent document={document} locale={locale} kind={kind} idPrefix={id + "-"}/>
    </div>
    <footer className="member-legal-modal-footer">
      <button type="button" onClick={onClose}>{locale === "en" ? "Close" : "닫기"}</button>
    </footer>
  </dialog>;
}
