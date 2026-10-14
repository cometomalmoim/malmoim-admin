import { Suspense } from "react";
import { ProtectedAdmin } from "@/components/admin/protected-admin";
export const instant = false;
async function AdminRoute({ params }: { params: Promise<{ segments: string[] }> }) {
  const { segments } = await params;
  return <ProtectedAdmin segments={segments} />;
}
export default function Page({ params }: { params: Promise<{ segments: string[] }> }) { return <Suspense fallback={<main className="login-page" role="status">접근 권한 확인 중…</main>}><AdminRoute params={params} /></Suspense>; }
