import { Suspense } from "react";
import { ProtectedAdmin } from "@/components/admin/protected-admin";
export const instant = false;
export default function AdminPage() { return <Suspense fallback={<main className="login-page" role="status">접근 권한 확인 중…</main>}><ProtectedAdmin /></Suspense>; }
