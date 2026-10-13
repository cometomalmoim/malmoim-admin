"use client";
import { useActionState, useState } from "react";
import { login } from "@/app/actions/auth";
export function LoginForm() {
  const [visible, setVisible] = useState(false);
  const [state, action, pending] = useActionState(login, { message: "" });
  return <form action={action} aria-busy={pending}>
    <label htmlFor="email">이메일</label><input id="email" name="email" type="email" autoComplete="username" placeholder="이메일을 입력해주세요" required maxLength={254} readOnly={pending} />
    <label htmlFor="password">비밀번호</label><div className="password-field"><input id="password" name="password" type={visible ? "text" : "password"} autoComplete="current-password" placeholder="비밀번호를 입력해주세요" required readOnly={pending} /><button type="button" onClick={() => setVisible(!visible)} aria-controls="password" aria-pressed={visible}>{visible ? "숨기기" : "보기"}</button></div>
    <button className="primary" type="submit" disabled={pending}>{pending ? "로그인 중…" : "로그인"}</button>
    {state.message && <p className="notice" role="alert">{state.message}</p>}
  </form>;
}
