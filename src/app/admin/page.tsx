import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getAdminAccess } from "@/lib/auth";
import { AdminPreview } from "@/components/admin-preview";
import { LogoutForm } from "@/components/logout-form";
export const instant = false;
async function ProtectedDashboard() {
  const access = await getAdminAccess();
  if (access.status === "anonymous") redirect("/login");
  if (access.status !== "admin") return <main className="login-page"><section className="login-card"><span className="eyebrow">접근 제한</span><h1>관리자 접근 거부</h1><p className="notice">{access.status === "error" ? "관리자 권한을 확인할 수 없습니다. 관리자 등록과 연결 상태를 확인해주세요." : "이 계정은 관리자로 등록되어 있지 않습니다."}</p><div className="account"><LogoutForm /></div></section></main>;
  return <AdminPreview email={access.email} />;
}
export default function AdminPage() { return <Suspense fallback={<main className="login-page" role="status">접근 권한 확인 중…</main>}><ProtectedDashboard /></Suspense>; }
