"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { memberLogout } from "@/app/actions/auth";
import type { PublicLocale } from "@/lib/public-content";
import "./profile-menu.css";

function AccountMenu({ email, locale = "ko" }: { email: string; locale?: PublicLocale }) {
  const en = locale === "en";
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(memberLogout, { message: "" });
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  return <div className="public-account" ref={root}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}
    onKeyDown={event => { if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); } }}>
    <button ref={trigger} className="public-avatar" type="button" aria-expanded={open}
      aria-controls="public-account-panel" aria-label={en ? "Account" : "계정 메뉴"}
      onClick={() => setOpen(value => !value)}>
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="8" r="3.5"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/></svg>
    </button>
    {open && <div id="public-account-panel" className="public-account-panel">
      <p className="public-account-email">{email || (en ? "Signed in" : "로그인됨")}</p>
      <button type="button" disabled>{en ? "My page · Coming soon" : "마이페이지 · 준비 중"}</button>
      <form action={action} aria-busy={pending}>
        <input type="hidden" name="locale" value={locale} />
        <button type="submit" disabled={pending}>{pending ? (en ? "Logging out…" : "로그아웃 중…") : (en ? "Log out" : "로그아웃")}</button>
        {state.message && <p role="alert">{state.message}</p>}
      </form>
    </div>}
  </div>;
}

export function ProfileMenu(props: { email: string; locale?: PublicLocale }) {
  const pathname = usePathname();
  return <AccountMenu key={pathname} {...props} />;
}
