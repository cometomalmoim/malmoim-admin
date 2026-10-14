"use client";
import { useActionState } from "react";
import { logout, memberLogout } from "@/app/actions/auth";
export function LogoutForm({ audience = "admin" }: { audience?: "admin" | "member" }) {
  const [state, action, pending] = useActionState(audience === "member" ? memberLogout : logout, { message: "" });
  return <form action={action}><button disabled={pending}>{pending ? "로그아웃 중…" : "로그아웃"}</button>{state.message && <p role="alert">{state.message}</p>}</form>;
}
