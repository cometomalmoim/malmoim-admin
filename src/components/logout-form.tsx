"use client";
import { useActionState } from "react";
import { logout } from "@/app/actions/auth";
export function LogoutForm() {
  const [state, action, pending] = useActionState(logout, { message: "" });
  return <form action={action}><button disabled={pending}>{pending ? "로그아웃 중…" : "로그아웃"}</button>{state.message && <p role="alert">{state.message}</p>}</form>;
}
