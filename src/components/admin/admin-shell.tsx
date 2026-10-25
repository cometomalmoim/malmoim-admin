"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {ApplicantListMemory,rememberedApplicantList} from "./applicant-list-memory";
import {PaymentNoticeHost} from "./payment-notice-host";
import { InquiryCount } from "./inquiry-count";
import { BrandLogo } from "../brand-logo";
import { LogoutForm } from "../logout-form";
import { adminGroups } from "@/lib/admin-navigation";
import "./admin.css";
import "./event-workspace.css";
import "./operations-layout.css";
export function AdminShell({ email, preview = false, current, title, children }: { email?: string; preview?: boolean; current: string; title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const router = useRouter();
  const base = preview ? "/preview/admin" : "/admin";
  function close() { setOpen(false); toggle.current?.focus(); }
  return <div className={`ops-shell ${['events','recruitment','participants','messages','inquiries'].includes(current)?'ops-event-workspace':''} ${current==='recruitment'?'ops-compact-applicants':''}`}><a className="ops-skip" href="#ops-main">본문 바로가기</a><button className="ops-mobile-toggle" ref={toggle} aria-expanded={open} aria-controls="ops-sidebar" onClick={() => setOpen(!open)}>메뉴 {open ? "닫기" : "열기"}</button>{open && <button className="ops-backdrop" aria-label="메뉴 닫기" onClick={close} />}
    {!preview&&<><ApplicantListMemory email={email}/><PaymentNoticeHost/></>}<aside id="ops-sidebar" className={`ops-sidebar ${open ? "is-open" : ""}`} onKeyDown={e => { if(e.key === "Escape") close(); }} aria-label="관리 메뉴"><div className="ops-brand"><BrandLogo compact /><strong>말모임 Admin</strong></div><nav>{adminGroups.map(group => <details key={group.title} open><summary>{group.title}</summary><div>{group.items.map(page => <Link key={page.slug} href={`${base}${page.slug ? `/${page.slug}` : ""}`} aria-current={current === page.slug ? "page" : undefined} onClick={() => setOpen(false)} onNavigate={event=>{if(!preview&&email&&page.slug==="recruitment"){const saved=rememberedApplicantList(email,"all");if(saved){event.preventDefault();router.push(saved);}}}}>{page.title}{page.slug === "inquiries" && !preview && <InquiryCount />}</Link>)}</div></details>)}</nav></aside>
    <div className="ops-content"><header className="ops-header"><span>{title}</span><div className="account"><div><strong>{email ?? "미리보기"}</strong><small>{preview ? "로그인 상태가 아닙니다" : "관리자"}</small></div>{preview ? <button disabled>로그아웃 · 준비 중</button> : <LogoutForm />}</div></header><main id="ops-main" className="ops-main" tabIndex={-1}>{preview && <div className="ops-banner">개발 전용 미리보기 · 실제 이벤트와 운영 데이터가 아닙니다.</div>}{children}</main></div>
  </div>;
}
