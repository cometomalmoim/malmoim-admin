"use client";
import { useEffect, useId, useRef, useState } from "react";
import { LogoutForm } from "./logout-form";
import "./profile-menu.css";

export function ProfileMenu({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        trigger.current?.focus();
      }
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape, true);
    };
  }, [open]);

  return <div className="public-profile" ref={root} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <button ref={trigger} type="button" className="public-profile-trigger"
      aria-label="내 프로필" aria-expanded={open} aria-controls={panelId}
      onClick={() => setOpen(value => !value)}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="8" r="3.5" /><path d="M5 21v-2a7 7 0 0 1 14 0v2" />
      </svg>
    </button>
    {open && <section id={panelId} className="public-profile-panel" aria-label="내 계정">
      <p className="public-profile-caption">로그인한 계정</p>
      <p className="public-profile-email">{email}</p>
      <button type="button" disabled className="public-profile-mypage">마이페이지 <span>준비 중</span></button>
      <LogoutForm audience="member" />
    </section>}
  </div>;
}
